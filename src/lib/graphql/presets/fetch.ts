import type { GraphQLResolveInfo } from "graphql"
import type { Model } from "../../model.js"
import { model, type } from "../type.js"

export interface FetchItemConfig {
  model: typeof Model
  idColumn?: string
  resolve?: (
    root: unknown,
    args: { id: string },
    ctx: unknown,
    info: GraphQLResolveInfo,
  ) => Promise<unknown>
  compose?: (resolve: unknown) => unknown
}

export interface FetchOptions {
  args?: Record<string, unknown>
  name?: string
}

export function fetch(
  items: Record<string, FetchItemConfig>,
  options: FetchOptions = {},
): Record<string, unknown> {
  const { args, name = "" } = options
  const itemsArray = Object.entries(items).map(([fetchName, fetchConfig]) => {
    const resolve =
      fetchConfig.resolve ||
      (async (
        _root: unknown,
        { id }: { id: string },
        ctx: unknown,
        _info: GraphQLResolveInfo,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query = (ctx as any).query || fetchConfig.model.query()
        const item = await query
          .findOne({
            [fetchConfig.idColumn || (fetchConfig.model.idColumn as string)]:
              id,
          })
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
    values: itemsArray.reduce((values: Record<string, unknown>, item) => {
      values[item.name] = { value: item.resolve }
      return values
    }, {}),
  })
  const FetchableItem = type("UnionType", {
    name: `${name}FetchableItem`,
    types: itemsArray.map((item) => item.type),
    resolveType: (modelInstance: unknown) => {
      for (const item of itemsArray) {
        if (modelInstance instanceof item.model) {
          return item.type.name
        }
      }
      return null
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
    resolve: async (
      root: unknown,
      args: { type: unknown },
      ctx: unknown,
      info: GraphQLResolveInfo,
    ) => {
      const { type: resolveType } = args
      const result = await (
        resolveType as (
          root: unknown,
          args: unknown,
          ctx: unknown,
          info: GraphQLResolveInfo,
        ) => Promise<unknown>
      )(root, args, ctx, info)
      return result
    },
  }
}
