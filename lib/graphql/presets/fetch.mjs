import { model, type } from "../type.mjs"

export function fetch(items, options = {}) {
  const { args, name = "" } = options
  const itemsArray = Object.entries(items).map(([fetchName, fetchConfig]) => {
    const resolve =
      fetchConfig.resolve ||
      (async (_root, { id }, ctx, _info) => {
        const query = ctx.query || fetchConfig.model.query()
        const item = await query
          .findOne({ [fetchConfig.idColumn || fetchConfig.model.idColumn]: id })
          .throwIfNotFound()
        return item
      })
    return {
      name: fetchName,
      model: fetchConfig.model,
      resolve: fetchConfig.compose ? fetchConfig.compose(resolve) : resolve,
      type: model(fetchConfig.model),
    }
  })
  const FetchType = type("EnumType", {
    name: `${name}FetchType`,
    values: itemsArray.reduce((values, item) => {
      const resolve = item.resolve
      values[item.name] = { value: resolve }
      return values
    }, {}),
  })
  const FetchableItem = type("UnionType", {
    name: `${name}FetchableItem`,
    types: itemsArray.map((item) => item.type),
    resolveType: (model) => {
      for (const item of itemsArray) {
        if (model instanceof item.model) {
          return item.type.name
        }
      }
    },
  })

  return {
    type: FetchableItem,
    args: Object.assign(
      {
        type: { type: type("NonNull", FetchType) },
        id: { type: type("NonNull", type("ID")) },
      },
      args,
    ),
    resolve: async (root, args, ctx, info) => {
      const { type } = args
      const result = await type(root, args, ctx, info)
      return result
    },
  }
}
