// @ts-nocheck
import { singularize } from "inflected"
import Knex, { type Config } from "knex"
import { fromPairs, has, isArray, isEmpty, pick, toPairs } from "lodash-es"
import {
  Model as BaseModel,
  Validator as BaseValidator,
  type Pojo,
  type QueryContext,
  type Relation,
  type RelationMappings,
  type ValidatorArgs,
} from "objection"
import yup from "yup"

// ============================================================================
// Types
// ============================================================================

export type FieldType =
  | "increments"
  | "integer"
  | "tinyint"
  | "mediumint"
  | "bigint"
  | "bigInteger"
  | "string"
  | "text"
  | "boolean"
  | "float"
  | "decimal"
  | "date"
  | "datetime"
  | "time"
  | "timestamp"
  | "uuid"
  | "json"
  | "jsonb"
  | "enum"
  | "enu"
  | string

export interface FieldConfig {
  type: FieldType | [FieldType, ...unknown[]]
  constraints?: {
    primary?: boolean
    unique?: boolean
    notNullable?: boolean
    nullable?: boolean
    unsigned?: boolean
    defaultTo?: unknown
    references?: string
    onDelete?: string
    onUpdate?: string
    comment?: string
    [key: string]: unknown
  }
  validator?: Record<string, unknown>
  formatter?: (value: unknown) => unknown
  parser?: (value: unknown) => unknown
  timestamp?: "insert" | "update"
  graphql?: { type?: string; [key: string]: unknown }
}

export type FieldsConfig = Record<string, FieldConfig>

export interface JoinConfig {
  foreignKey?: string
  uniqueKey?: string
  throughTable?: string
  parentForeignKey?: string
  [key: string]: unknown
}

export interface MigrationOptions {
  drop?: boolean
  knex?: Knex
}

// ============================================================================
// Utility Functions
// ============================================================================

function getFieldsConfig(
  fields: FieldsConfig,
  configName: string,
): Record<string, unknown> {
  const pairs = toPairs(fields)
  const hasConfigFields = pairs.filter(
    ([, meta]) => !!(meta as Record<string, unknown>)[configName],
  )
  return fromPairs(
    hasConfigFields.map(([field, meta]) => [
      field,
      (meta as Record<string, unknown>)[configName],
    ]),
  )
}

// ============================================================================
// Re-exports from Objection
// ============================================================================

export {
  AjvValidator,
  CheckViolationError,
  ConstraintViolationError,
  compose,
  DataError,
  DBError,
  ForeignKeyViolationError,
  fn,
  NotFoundError,
  raw,
  ref,
  transaction,
  UniqueViolationError,
  ValidationError,
} from "objection"

// ============================================================================
// Validator Builder Functions
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YupSchema = any

function createEnumValidator(args: unknown[]): YupSchema {
  return yup.mixed().oneOf(...(args as [unknown[]]))
}

function createIntegerValidator(): ReturnType<typeof yup.number> {
  return yup.number().integer()
}

function createNumberValidator(): ReturnType<typeof yup.number> {
  return yup.number()
}

function createStringValidator(args: unknown[]): ReturnType<typeof yup.string> {
  let validator = yup.string()
  if (args[0] && typeof args[0] === "number") {
    validator = validator.max(args[0])
  }
  return validator
}

function createUuidValidator(): ReturnType<typeof yup.string> {
  return yup
    .string()
    .trim()
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[8|9|a|b][0-9a-f]{3}-[0-9a-f]{12}$/i,
      "Invalid UUID format",
    )
}

function createDateValidator(): ReturnType<typeof yup.date> {
  return yup.date()
}

function createTimestampValidator(): ReturnType<typeof yup.date> {
  return yup.date().transform(function (castValue, originalValue) {
    return this.isType(castValue)
      ? castValue
      : new Date(originalValue as string | number | Date)
  })
}

function createJsonValidator(args: unknown[]): YupSchema {
  return yup
    .mixed()
    .test("is-object-or-array", "must be an object or array", (value) => {
      if (value == null) return true
      return (
        Array.isArray(value) ||
        (typeof value === "object" && !Array.isArray(value))
      )
    })
    .when([], () =>
      yup.lazy((value) => {
        if (value == null) {
          return yup.mixed()
        }
        if (Array.isArray(value)) {
          return yup.array()
        }
        if (typeof value === "object") {
          let objSchema = yup.object()
          if (args.length && args[0]) {
            objSchema = objSchema.shape(args[0] as Record<string, YupSchema>)
          }
          return objSchema
        }
        return yup.mixed()
      }),
    )
}

function createBaseValidator(
  type: FieldType | [FieldType, ...unknown[]],
): YupSchema {
  const [_type, ...args] = isArray(type) ? type : [type]

  switch (_type) {
    case "enum":
    case "enu":
      return createEnumValidator(args)

    case "increments":
    case "integer":
    case "tinyint":
    case "mediumint":
    case "bigint":
    case "bigInteger":
      return createIntegerValidator()

    case "float":
    case "decimal":
      return createNumberValidator()

    case "text":
    case "string":
      return createStringValidator(args)

    case "uuid":
      return createUuidValidator()

    case "date":
    case "datetime":
    case "time":
      return createDateValidator()

    case "timestamp":
      return createTimestampValidator()

    case "json":
    case "jsonb":
      return createJsonValidator(args)

    default:
      return (
        (yup as Record<string, (...args: unknown[]) => YupSchema>)[_type]?.(
          ...args,
        ) ?? yup.mixed()
      )
  }
}

function applyConstraints(
  validator: YupSchema,
  constraints: Record<string, unknown> = {},
): YupSchema {
  if (has(constraints, "unsigned") && constraints.unsigned) {
    validator =
      (validator as ReturnType<typeof yup.number>).positive?.() ?? validator
  }

  if (has(constraints, "nullable") && constraints.nullable) {
    validator = validator.nullable()
  }

  if (has(constraints, "notNullable") && constraints.notNullable) {
    validator = validator.nullable(false)
  }

  if (has(constraints, "defaultTo") && constraints.defaultTo !== undefined) {
    validator = validator.default(constraints.defaultTo as () => unknown)
  }

  return validator
}

function applyCustomRules(
  validator: YupSchema,
  customRules: Record<string, unknown> = {},
): YupSchema {
  for (const rule in customRules) {
    const args = isArray(customRules[rule])
      ? customRules[rule]
      : [customRules[rule]]
    const method = (
      validator as Record<string, (...args: unknown[]) => YupSchema>
    )[rule]
    if (typeof method === "function") {
      validator = method.call(validator, ...args)
    }
  }
  return validator
}

function buildValidator(fields: FieldsConfig): Record<string, YupSchema> {
  const schema: Record<string, YupSchema> = {}

  for (const field in fields) {
    const { type, constraints, validator: customRules } = fields[field]

    let validator = createBaseValidator(type)
    validator = applyConstraints(validator, constraints)
    validator = applyCustomRules(validator, customRules)

    schema[field] = validator
  }

  return schema
}

// ============================================================================
// Table Schema Builder Functions
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyColumnConstraints(
  column: any,
  constraints: Record<string, unknown>,
): any {
  const buildOrder = [
    "unsigned",
    "nullable",
    "notNullable",
    "primary",
    "unique",
    "foreign",
    "references",
    "inTable",
    "onDelete",
    "onUpdate",
    "deferrable",
    "defaultTo",
    "collate",
    "comment",
  ]

  for (const constraint of buildOrder) {
    if (has(constraints, constraint) && constraints[constraint] !== undefined) {
      column = applyConstraint(column, constraint, constraints[constraint])
    }
  }

  return column
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyConstraint(
  column: any,
  constraintName: string,
  constraintValue: unknown,
): any {
  if (isArray(constraintValue)) {
    return column[constraintName](...constraintValue)
  } else if (constraintValue === true) {
    return column[constraintName]()
  } else {
    return column[constraintName](constraintValue)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createColumn(
  table: any,
  fieldName: string,
  fieldConfig: FieldConfig,
): any {
  const { type, constraints = {} } = fieldConfig
  const [_type, ...args] = isArray(type) ? type : [type]

  if (!table[_type]) {
    throw new Error(`Column type '${_type}' is not supported by knex.`)
  }

  let column = table[_type](fieldName, ...args)
  column = applyColumnConstraints(column, constraints)

  return column
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyTableConstraints(
  table: any,
  constraints:
    | Record<string, unknown[]>
    | Array<{ type: string; args: unknown[] }>,
): void {
  if (isArray(constraints)) {
    for (const constraint of constraints) {
      table[constraint.type](...constraint.args)
    }
  } else {
    for (const constraint in constraints) {
      table[constraint](...constraints[constraint])
    }
  }
}

// ============================================================================
// Relation Mapping Helper Functions
// ============================================================================

function belongsToOneRelation(
  currentModel: typeof Model,
  relatedModel: typeof Model,
  join: JoinConfig = {},
): unknown {
  if (Array.isArray(relatedModel.idColumn)) {
    throw new Error(
      "Composite keys are not supported in belongsToOne shortcut currently",
    )
  }

  const { foreignKey, uniqueKey, ...rest } = join
  const _uniqueKey = uniqueKey || (relatedModel.idColumn as string)
  const _foreignKey = foreignKey || relatedModel.foreignKeyName

  return {
    relation: BaseModel.BelongsToOneRelation,
    modelClass: relatedModel,
    foreignKey: _foreignKey,
    uniqueKey: _uniqueKey,
    join: {
      from: `${currentModel.tableName}.${_foreignKey}`,
      to: `${relatedModel.tableName}.${_uniqueKey}`,
      ...rest,
    },
  } as Relation
}

function hasManyRelation(
  currentModel: typeof Model,
  relatedModel: typeof Model,
  join: JoinConfig = {},
  graphql: Record<string, unknown> = {},
): unknown {
  if (Array.isArray(currentModel.idColumn)) {
    throw new Error(
      "Composite keys are not supported in hasMany shortcut currently",
    )
  }

  const { foreignKey = currentModel.foreignKeyName, ...rest } = join

  return {
    relation: BaseModel.HasManyRelation,
    modelClass: relatedModel,
    foreignKey,
    join: {
      from: `${currentModel.tableName}.${currentModel.idColumn as string}`,
      to: `${relatedModel.tableName}.${foreignKey}`,
      ...rest,
    },
    ...graphql,
  } as Relation
}

function hasOneRelation(
  currentModel: typeof Model,
  relatedModel: typeof Model,
  join: JoinConfig = {},
  graphql: Record<string, unknown> = {},
): unknown {
  if (Array.isArray(currentModel.idColumn)) {
    throw new Error(
      "Composite keys are not supported in hasOne shortcut currently",
    )
  }

  const {
    foreignKey = currentModel.foreignKeyName,
    parentForeignKey = currentModel.idColumn as string,
    ...rest
  } = join

  return {
    relation: BaseModel.HasOneRelation,
    modelClass: relatedModel,
    foreignKey,
    parentForeignKey,
    ...graphql,
    join: {
      from: `${currentModel.tableName}.${parentForeignKey}`,
      to: `${relatedModel.tableName}.${foreignKey}`,
      ...rest,
    },
  } as Relation
}

function manyToManyRelation(
  currentModel: typeof Model,
  relatedModel: typeof Model,
  join: JoinConfig = {},
): unknown {
  if (
    Array.isArray(currentModel.idColumn) ||
    Array.isArray(relatedModel.idColumn)
  ) {
    throw new Error(
      "Composite keys are not supported in manyToMany shortcut currently",
    )
  }

  const {
    throughTable,
    foreignKey = currentModel.foreignKeyName,
    ...rest
  } = join

  if (isEmpty(throughTable)) {
    throw new Error("throughTable must be provided for manyToMany relation")
  }

  return {
    relation: BaseModel.ManyToManyRelation,
    modelClass: relatedModel,
    foreignKey,
    join: {
      from: `${currentModel.tableName}.${currentModel.idColumn as string}`,
      through: {
        from: `${throughTable}.${foreignKey}`,
        to: `${throughTable}.${relatedModel.foreignKeyName}`,
      },
      to: `${relatedModel.tableName}.${relatedModel.idColumn as string}`,
      ...rest,
    },
  } as Relation
}

// ============================================================================
// Enhanced Model Class
// ============================================================================

/**
 * Enhanced Objection.js Model class with field definitions, validation, and migrations.
 *
 * @example
 * ```typescript
 * class User extends Model {
 *   static tableName = 'users'
 *   static fields = {
 *     id: { type: 'increments', constraints: { primary: true } },
 *     name: { type: 'string', validator: { required: true } },
 *     email: { type: 'string', validator: { email: true } },
 *     createdAt: { type: 'timestamp', timestamp: 'insert' }
 *   }
 * }
 * ```
 */
export class Model extends BaseModel {
  static relations: Record<string, unknown> = {}
  static fields: FieldsConfig = {}
  static constraints:
    | Record<string, unknown[]>
    | Array<{ type: string; args: unknown[] }> = {}

  static get foreignKeyName(): string {
    return `${singularize(this.tableName)}Id`
  }

  static get virtualFields(): Record<string, string> {
    return {}
  }

  static get virtualAttributes(): string[] {
    return Object.keys(this.virtualFields)
  }

  static get formatter(): Record<string, (value: unknown) => unknown> {
    return getFieldsConfig(this.fields, "formatter") as Record<
      string,
      (value: unknown) => unknown
    >
  }

  static get parser(): Record<string, (value: unknown) => unknown> {
    return getFieldsConfig(this.fields, "parser") as Record<
      string,
      (value: unknown) => unknown
    >
  }

  static get validator(): Record<string, YupSchema> {
    return buildValidator(this.fields)
  }

  static connect(knexConfig: Config): Knex {
    const knex = Knex(knexConfig)
    Model.knex(knex)
    return knex
  }

  $formatDatabaseJson(json: Pojo): Pojo {
    const formatter = (this.constructor as typeof Model).formatter
    Object.keys(formatter).forEach((column) => {
      if (column in json) {
        json[column] = formatter[column](json[column])
      }
    })

    return super.$formatDatabaseJson(json)
  }

  $parseDatabaseJson(json: Pojo): Pojo {
    const parser = (this.constructor as typeof Model).parser
    Object.keys(parser).forEach((column) => {
      if (column in json) {
        json[column] = parser[column](json[column])
      }
    })

    return super.$parseDatabaseJson(json)
  }

  async $beforeInsert(queryContext: QueryContext): Promise<void> {
    await super.$beforeInsert(queryContext)

    const timestamps = getFieldsConfig(
      (this.constructor as typeof Model).fields,
      "timestamp",
    )
    const now = new Date()

    for (const field in timestamps) {
      if (timestamps[field] === "insert") {
        ;(this as Record<string, unknown>)[field] =
          (this as Record<string, unknown>)[field] ?? now
      }
    }
  }

  async $beforeUpdate(
    opt: { patch?: boolean },
    queryContext: QueryContext,
  ): Promise<void> {
    await super.$beforeUpdate(opt, queryContext)

    const timestamps = getFieldsConfig(
      (this.constructor as typeof Model).fields,
      "timestamp",
    )
    const now = new Date()

    for (const field in timestamps) {
      if (timestamps[field] === "update") {
        ;(this as Record<string, unknown>)[field] =
          (this as Record<string, unknown>)[field] ?? now
      }
    }
  }

  static get relationMappings(): RelationMappings {
    return this.relations as unknown as RelationMappings
  }

  static findRelation(
    child: typeof Model,
    types: string | string[],
  ): { name: string; info: Relation } {
    const typeList = Array.isArray(types) ? types : [types]

    const result = toPairs(this.relations).find(
      ([, relationInfo]) =>
        (relationInfo as Relation).modelClass === child &&
        typeList.includes((relationInfo as Relation).relation as string),
    )

    if (!result) {
      throw new Error(`Relation ${child} can not be found`)
    }

    const [name, info] = result
    return { name, info }
  }

  static async upsert(where: Pojo, data: Pojo): Promise<Model> {
    return (await this.query().upsertGraph(
      { ...where, ...data },
      { insertMissing: true },
    )) as Model
  }

  static createValidator(): Validator {
    return new Validator(this.validator)
  }

  static belongsTo(modelClass: typeof Model, join: JoinConfig = {}): unknown {
    return belongsToOneRelation(this, modelClass, join)
  }

  static belongsToOne(
    modelClass: typeof Model,
    join: JoinConfig = {},
  ): unknown {
    return belongsToOneRelation(this, modelClass, join)
  }

  static hasMany(
    modelClass: typeof Model,
    join: JoinConfig = {},
    graphql: Record<string, unknown> = {},
  ): unknown {
    return hasManyRelation(this, modelClass, join, graphql)
  }

  static hasOne(
    modelClass: typeof Model,
    join: JoinConfig = {},
    graphql: Record<string, unknown> = {},
  ): unknown {
    return hasOneRelation(this, modelClass, join, graphql)
  }

  static manyToMany(modelClass: typeof Model, join: JoinConfig = {}): unknown {
    return manyToManyRelation(this, modelClass, join)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async createTable(schema?: any): Promise<void> {
    const _schema = schema || this.knex().schema

    return await _schema.createTable(this.tableName, (table: unknown) => {
      for (const field in this.fields) {
        createColumn(table, field, this.fields[field])
      }

      applyTableConstraints(table, this.constraints)
    })
  }
}

// ============================================================================
// Enhanced Validator Class
// ============================================================================

export class Validator extends BaseValidator {
  schema: Record<string, YupSchema>

  constructor(schema: Record<string, YupSchema>) {
    super(schema)
    this.schema = schema
  }

  validate({
    json,
    options = {},
  }: ValidatorArgs & { json: Pojo; options?: { patch?: boolean } }): Pojo {
    if (!this.schema) return json

    const schemaToValidate = options.patch
      ? pick(this.schema, Object.keys(json))
      : this.schema

    const validator = yup.object().shape(schemaToValidate)

    return validator.validateSync(json, { abortEarly: false })
  }
}

// ============================================================================
// Database Migration Utilities
// ============================================================================

export async function knexMigration(
  models: (typeof Model)[],
  options: MigrationOptions = {},
): Promise<void> {
  const { drop = false, knex = Model.knex() } = options

  for (const model of models) {
    if (drop) {
      await knex.schema.dropTableIfExists(model.tableName)
    } else {
      await model.createTable(knex.schema)
    }
  }
}
