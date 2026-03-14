import type { GraphQLResolveInfo } from "graphql"
import type { Model } from "../../model.js"
import { model, type } from "../type.js"

export interface MutationConfig {
  query?: unknown
  resolve?: (
    root: unknown,
    args: { input: unknown },
    ctx: unknown,
    info: GraphQLResolveInfo,
  ) => Promise<unknown>
  mutationName?: string
  args?: Record<string, unknown>
  compose?: (resolve: unknown) => unknown
}

export class Mutation {
  modelClass!: typeof Model
  mutations: Record<string, unknown> = {}

  constructor(modelClass: typeof Model) {
    this.modelClass = modelClass
  }

  create(config: MutationConfig = {}): this {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = config.query || this.modelClass.query()
    const resolve =
      config.resolve ||
      (async (
        _root: unknown,
        { input }: { input: unknown },
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ) => {
        return await (query as any).insertAndFetch(input)
      })
    this.mutations[config.mutationName || `create${this.modelClass.name}`] = {
      type: model(this.modelClass),
      args: Object.assign(
        { input: { type: type("NonNull", type("JSON")) } },
        config.args,
      ),
      resolve: config.compose ? config.compose(resolve) : resolve,
    }
    return this
  }

  update(config: MutationConfig = {}): this {
    const resolve =
      config.resolve ||
      (async (
        _root: unknown,
        { input }: { input: { id: unknown; patch: unknown } },
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: any = config.query || this.modelClass.query()
        const { id, patch } = input
        const item = await query
          .findOne({ [this.modelClass.idColumn as string]: id })
          .throwIfNotFound()

        const result = await item.$query().patchAndFetch(patch)
        return result
      })
    this.mutations[config.mutationName || `update${this.modelClass.name}`] = {
      type: model(this.modelClass),
      args: Object.assign(
        { input: { type: type("NonNull", type("JSON")) } },
        config.args,
      ),
      resolve: config.compose ? config.compose(resolve) : resolve,
    }
    return this
  }

  destroy(config: MutationConfig = {}): this {
    const resolve =
      config.resolve ||
      (async (
        _root: unknown,
        { input }: { input: { id: unknown } },
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: any = config.query || this.modelClass.query()
        const { id } = input
        const item = await query
          .findOne({ [this.modelClass.idColumn as string]: id })
          .throwIfNotFound()
        await item.$query().delete()
        return item
      })
    this.mutations[config.mutationName || `destroy${this.modelClass.name}`] = {
      type: model(this.modelClass),
      args: Object.assign(
        { input: { type: type("NonNull", type("JSON")) } },
        config.args,
      ),
      resolve: config.compose ? config.compose(resolve) : resolve,
    }
    return this
  }
}

export function mutation(modelClass: typeof Model): Mutation {
  return new Mutation(modelClass)
}
