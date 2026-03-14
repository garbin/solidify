import type { GraphQLResolveInfo } from "graphql"
import { singularize } from "inflected"
import type { Model } from "../../model.js"
import { Loader } from "../loader.js"

// ============================================================================
// Utility Functions
// ============================================================================

function generateForeignKey(tableName: string): string {
  return `${singularize(tableName)}Id`
}

function generateMappingKey(tableName: string): string {
  return singularize(tableName)
}

function validateLoader(loader: unknown): asserts loader is Loader {
  if (!(loader instanceof Loader)) {
    throw new Error("Can not get loader")
  }
}

function validateParentModel(
  root: unknown,
): asserts root is { constructor: typeof Model } {
  if (!(root as { constructor?: unknown }).constructor) {
    throw new Error("Batch fetch preset only works within a parent model")
  }
}

// ============================================================================
// Data Assemblers
// ============================================================================

interface AssembleConfig {
  attrName: string
  parentForeignKey: string
  mappingKey?: string
  asserter: (child: unknown, parent: unknown) => boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assembleOneToMany(
  children: any[],
  parents: any[],
  config: AssembleConfig,
): any[][] {
  const { attrName, parentForeignKey, mappingKey, asserter } = config

  return parents.map((parent) => {
    return children.filter((child) => {
      const isMatch =
        child[attrName] === parent[parentForeignKey] && asserter(child, parent)

      if (isMatch && mappingKey) {
        child[mappingKey] = parent
        return true
      }
      return isMatch
    })
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assembleOneToOne(
  children: any[],
  parents: any[],
  config: AssembleConfig,
): (any | undefined)[] {
  const { attrName, parentForeignKey, asserter } = config

  return parents.map((parent) => {
    return children.find((child) => {
      return (
        child[attrName] === parent[parentForeignKey] && asserter(child, parent)
      )
    })
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assembleManyToMany(
  children: any[],
  parents: any[],
  parentIdColumn: string,
): any[][] {
  return parents.map((parent) => {
    return children.filter((child) => {
      return child._pivot_foreign_key === parent[parentIdColumn]
    })
  })
}

interface BelongsToAssembleConfig {
  foreignKey: string
  uniqueKey: string
  itemIdColumn: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assembleBelongsTo(
  items: any[],
  parents: any[],
  config: BelongsToAssembleConfig,
): (any | undefined)[] {
  const { foreignKey, uniqueKey, itemIdColumn } = config

  return parents.map((parent) => {
    return items.find((item) => {
      const itemKey = itemIdColumn || uniqueKey
      return item[itemKey] === parent[foreignKey]
    })
  })
}

// ============================================================================
// Query Builders
// ============================================================================

interface HasManyQueryConfig {
  model: typeof Model
  foreignKey: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parents: any[]
  parentForeignKey: string
  modify?: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where: (builder: any, context: unknown) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (builder: any) => Promise<any[]>
  context: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildHasManyQuery(config: HasManyQueryConfig): Promise<any[]> {
  const {
    model,
    foreignKey,
    parents,
    parentForeignKey,
    modify,
    where,
    query,
    context,
  } = config

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseQuery = model.query().where((builder: any) => {
    builder.whereIn(
      foreignKey,
      parents.map((parent) => parent[parentForeignKey]),
    )

    if (modify) {
      builder.where(modify)
    }

    return where(builder, context)
  })

  return await query(baseQuery)
}

interface ManyToManyQueryConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  relation: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parents: any[]
  parentIdColumn: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildManyToManyQuery(
  config: ManyToManyQueryConfig,
): Promise<any[]> {
  const { relation, parents, parentIdColumn } = config

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = relation.modelClass.query()

  query.select(
    `${relation.modelClass.tableName}.*`,
    `${relation.join.through.from} as _pivot_foreign_key`,
  )

  const throughTable = relation.join.through.from.split(".")[0]
  query.join(
    throughTable,
    `${relation.modelClass.tableName}.${relation.modelClass.idColumn}`,
    relation.join.through.to,
  )

  query.whereIn(
    relation.join.through.from,
    parents.map((parent) => parent[parentIdColumn]),
  )

  return await query
}

interface BelongsToQueryConfig {
  model: typeof Model
  uniqueKey: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parents: any[]
  foreignKey: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildBelongsToQuery(
  config: BelongsToQueryConfig,
): Promise<any[]> {
  const { model, uniqueKey, parents, foreignKey } = config

  return await model.query().whereIn(
    uniqueKey,
    parents.map((parent) => parent[foreignKey]),
  )
}

// ============================================================================
// Batch Loaders
// ============================================================================

interface LoadOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getLoader?: (ctx: any) => Loader
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assemble: (items: any[], parents: any[]) => any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch: (parents: any[]) => Promise<any[]>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function load(
  options: LoadOptions,
): (root: any, args: any, ctx: any, info: GraphQLResolveInfo) => Promise<any> {
  return async (root, _args, ctx, _info) => {
    const {
      getLoader = (ctx: { loader: Loader }) => ctx.loader,
      name,
      assemble,
      fetch,
    } = options

    const loader = getLoader(ctx)
    validateLoader(loader)

    const data = await loader
      .acquire(name, (parents) =>
        fetch(parents as unknown[]).then((items) =>
          assemble(items, parents as unknown[]),
        ),
      )
      .load(root)

    return data
  }
}

interface FetchConfig {
  parent?: typeof Model
  parentForeignKey?: string
  foreignKey?: string
  mappingKey?: string
  attrName?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where?: (builder: any, context: unknown) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: (builder: any) => Promise<any[]>
  list?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assembleAsserter?: (child: any, parent: any) => boolean
  model?: typeof Model
  modify?: Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveFetchConfig(root: any, options: FetchConfig) {
  const parent = options.parent || root.constructor
  const parentForeignKey = options.parentForeignKey || "id"
  const foreignKey =
    options.foreignKey || generateForeignKey(root.constructor.tableName)
  const mappingKey =
    options.mappingKey || generateMappingKey(root.constructor.tableName)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultAsserter = (child: any, parent: any) => {
    return child != null && parent != null
  }

  return {
    parent,
    parentForeignKey,
    foreignKey,
    mappingKey,
    attrName: options.attrName || foreignKey,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: options.where || ((q: any) => q),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: options.query || ((q: any) => q),
    list: options.list !== undefined ? options.list : true,
    assembleAsserter: options.assembleAsserter || defaultAsserter,
    model: options.model,
    modify: options.modify,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fetch(
  options: FetchConfig = {},
): (root: any, args: any, ctx: any, info: GraphQLResolveInfo) => Promise<any> {
  return async (root, args, ctx, info) => {
    validateParentModel(root)

    const config = resolveFetchConfig(root, options)

    if (!config.model) {
      throw new Error("Model is required for fetch operation")
    }

    return await load({
      name: `${(config.parent as typeof Model).name}-${config.model.name}`,

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async fetch(parents: any[]) {
        return await buildHasManyQuery({
          model: config.model!,
          foreignKey: config.foreignKey,
          parents,
          parentForeignKey: config.parentForeignKey,
          modify: config.modify,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          where: config.where as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          query: config.query as any,
          context: { root, args, ctx, info },
        })
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assemble(children: any[], parents: any[]) {
        const assembleConfig: AssembleConfig = {
          attrName: config.attrName,
          parentForeignKey: config.parentForeignKey,
          mappingKey: config.mappingKey,
          asserter: config.assembleAsserter,
        }

        return config.list
          ? assembleOneToMany(children, parents, assembleConfig)
          : assembleOneToOne(children, parents, assembleConfig)
      },
    })(root, args, ctx, info)
  }
}

// ============================================================================
// Relation Loaders
// ============================================================================

export function hasMany(
  model: typeof Model,
  options: Omit<FetchConfig, "model" | "list"> = {},
) {
  return fetch({
    list: true,
    model,
    ...options,
  })
}

export function hasOne(
  model: typeof Model,
  options: Omit<FetchConfig, "model" | "list"> = {},
) {
  return fetch({
    model,
    list: false,
    ...options,
  })
}

interface BelongsToConfig {
  parent?: typeof Model
  foreignKey?: string
  uniqueKey?: string
}

export function belongsTo(model: typeof Model, options: BelongsToConfig = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (root: any, args: any, ctx: any, info: GraphQLResolveInfo) => {
    validateParentModel(root)

    const parent = options.parent || root.constructor
    const foreignKey = options.foreignKey || generateForeignKey(model.tableName)
    const uniqueKey = options.uniqueKey || model.idColumn

    return await load({
      name: `${(parent as typeof Model).name}-${model.name}`,

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async fetch(parents: any[]) {
        return await buildBelongsToQuery({
          model,
          uniqueKey: uniqueKey as string,
          parents,
          foreignKey,
        })
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assemble(items: any[], parents: any[]) {
        return assembleBelongsTo(items, parents, {
          foreignKey,
          uniqueKey: uniqueKey as string,
          itemIdColumn: model.idColumn as string,
        })
      },
    })(root, args, ctx, info)
  }
}

interface BelongsToManyConfig {
  relation: string
}

export function belongsToMany(options: BelongsToManyConfig) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (root: any, args: any, ctx: any, info: GraphQLResolveInfo) => {
    validateParentModel(root)

    const selfModel = root.constructor as typeof Model
    const relationName = options.relation

    if (!selfModel.relations) {
      throw new Error(
        `Model '${selfModel.name}' does not have relations defined`,
      )
    }

    const relation = selfModel.relations[relationName]

    if (!relation) {
      throw new Error(
        `Relation '${relationName}' not found in ${selfModel.name}.relations`,
      )
    }

    return await load({
      name: `${selfModel.name}-${(relation as { modelClass: typeof Model }).modelClass.name}-many-to-many`,

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async fetch(parents: any[]) {
        return await buildManyToManyQuery({
          relation,
          parents,
          parentIdColumn: selfModel.idColumn as string,
        })
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assemble(children: any[], parents: any[]) {
        return assembleManyToMany(
          children,
          parents,
          selfModel.idColumn as string,
        )
      },
    })(root, args, ctx, info)
  }
}

export const batch = {
  load,
  fetch,
  hasMany,
  hasOne,
  belongsTo,
  belongsToMany,
}
