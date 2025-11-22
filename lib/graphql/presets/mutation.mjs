import { model, type } from "../type.mjs"

export class Mutation {
  modelClass = null
  mutations = {}
  constructor(modelClass) {
    this.modelClass = modelClass
  }

  create(config = {}) {
    const query = config.query || this.modelClass.query()
    const resolve =
      config.resolve ||
      (async (_root, { input }, _ctx, _info) => {
        return await query.insertAndFetch(input)
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

  update(config = {}) {
    const resolve =
      config.resolve ||
      (async (_root, { input }, _ctx, _info) => {
        const query = config.query || this.modelClass.query()
        const { id, patch } = input
        const item = await query
          .findOne({ [this.modelClass.idColumn]: id })
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

  destroy(config = {}) {
    const resolve =
      config.resolve ||
      (async (_root, { input }, _ctx, _info) => {
        const query = config.query || this.modelClass.query()
        const { id } = input
        const item = await query
          .findOne({ [this.modelClass.idColumn]: id })
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
export function mutation(modelClass) {
  return new Mutation(modelClass)
}
