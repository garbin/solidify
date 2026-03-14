import type { GraphQLResolveInfo } from "graphql"
import { includes, isArray, isEmpty, isFunction, trimStart } from "lodash-es"
import type { Model } from "../../model.js"
import { model, type } from "../type.js"

const base64 = {
  encode: (text: string | number): string =>
    Buffer.from(String(text), "utf-8").toString("base64"),
  decode: (text: string): string =>
    Buffer.from(text, "base64").toString("utf-8"),
}

// ============================================================================
// Type Definition Helpers
// ============================================================================

interface SearchTypeConfig {
  model: typeof Model
  resolve?: (
    root: unknown,
    args: unknown,
    ctx: unknown,
    info: GraphQLResolveInfo,
  ) => Promise<unknown>
  compose?: (resolve: unknown) => unknown
  resolverOptions?: Record<string, unknown>
}

interface SearchTypeEntry {
  name: string
  model: typeof Model
  resolve: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: any
}

function createSearchTypes(
  searchable: Record<string, SearchTypeConfig>,
  cursor: unknown,
): SearchTypeEntry[] {
  return Object.entries(searchable).map(
    ([searchTypeName, searchTypeConfig]) => {
      const resolve =
        searchTypeConfig.resolve ||
        connectionResolver({
          model: searchTypeConfig.model,
          query: (_ctx: unknown) => searchTypeConfig.model.query(),
          cursor,
          ...searchTypeConfig.resolverOptions,
        })

      return {
        name: searchTypeName,
        model: searchTypeConfig.model,
        resolve: searchTypeConfig.compose
          ? searchTypeConfig.compose(resolve)
          : resolve,
        type: model(searchTypeConfig.model),
      }
    },
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createSearchEnum = (name: string, types: SearchTypeEntry[]): any =>
  type("EnumType", {
    name: `${name}SearchType`,
    values: types.reduce((values: Record<string, unknown>, item) => {
      values[item.name] = { value: item.resolve }
      return values
    }, {}),
  })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createSearchUnion = (name: string, types: SearchTypeEntry[]): any =>
  type("UnionType", {
    name: `${name}SearchItem`,
    types: types.map((t) => t.type),
    resolveType(value: unknown) {
      for (const item of types) {
        if (value instanceof item.model) {
          return item.type.name
        }
      }
      return null
    },
  })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createEdgeType = (name: string, ItemType: any): any =>
  type("ObjectType", {
    name: `${name}SearchItemEdge`,
    fields: {
      node: { type: ItemType },
      cursor: {
        type: type("String"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve: (edge: any) => base64.encode(edge.cursor),
      },
    },
  })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createPageInfoType = (name: string): any =>
  type("ObjectType", {
    name: `${name}PageInfo`,
    fields: {
      startCursor: {
        type: type("String"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve: (pageInfo: any) =>
          pageInfo.startCursor ? base64.encode(pageInfo.startCursor) : null,
      },
      endCursor: {
        type: type("String"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve: (pageInfo: any) =>
          pageInfo.endCursor ? base64.encode(pageInfo.endCursor) : null,
      },
      hasNextPage: { type: type("Boolean") },
    },
  })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createConnectionType = (
  name: string,
  EdgeType: any,
  PageInfoType: any,
): any =>
  type("ObjectType", {
    name: `${name}SearchConnection`,
    fields: {
      total: { type: type("Int") },
      edges: { type: type("List", EdgeType) },
      pageInfo: { type: PageInfoType },
    },
  })

// ============================================================================
// Search Function
// ============================================================================

export interface SearchOptions {
  cursor?: unknown
  args?: Record<string, unknown>
  name?: string
}

export function search(
  searchable: Record<string, SearchTypeConfig>,
  options: SearchOptions = {},
): Record<string, unknown> {
  const { cursor, args = {}, name = "" } = options

  const types = createSearchTypes(searchable, cursor)

  const SearchType = createSearchEnum(name, types)
  const SearchItem = createSearchUnion(name, types)
  const SearchItemEdge = createEdgeType(name, SearchItem)
  const PageInfo = createPageInfoType(name)
  const SearchConnection = createConnectionType(name, SearchItemEdge, PageInfo)

  return {
    type: SearchConnection,
    args: {
      type: { type: type("NonNull", SearchType) },
      first: { type: type("Int") },
      last: { type: type("Int") },
      after: { type: type("String") },
      before: { type: type("String") },
      keyword: { type: type("String") },
      orderBy: { type: type("String") },
      filterBy: { type: type("JSON") },
      ...args,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async resolve(root: any, args: any, ctx: any, info: GraphQLResolveInfo) {
      const decodedArgs = {
        ...args,
        after: args.after ? base64.decode(args.after) : null,
        before: args.before ? base64.decode(args.before) : null,
        first: Number(args.first) || null,
        last: Number(args.last) || null,
      }

      const resolver = decodedArgs.type
      return await (
        resolver as (
          root: unknown,
          args: unknown,
          ctx: unknown,
          info: GraphQLResolveInfo,
        ) => Promise<unknown>
      )(root, decodedArgs, ctx, info)
    },
  }
}

// ============================================================================
// Cursor Utilities
// ============================================================================

interface CursorData {
  values?: Record<string, unknown>
  value?: unknown
}

function parseCursor(cursorString: string | null): CursorData | null {
  if (!cursorString) return null

  try {
    const parsed = JSON.parse(cursorString)
    if (typeof parsed === "object" && parsed !== null && parsed.values) {
      return parsed
    }
    return { value: cursorString }
  } catch {
    return { value: cursorString }
  }
}

function generateCursor(
  values: string | number | Record<string, unknown>,
): string {
  if (typeof values === "string" || typeof values === "number") {
    return String(values)
  }
  return JSON.stringify(values)
}

// ============================================================================
// Connection Resolver
// ============================================================================

export interface ConnectionResolverOptions {
  model: typeof Model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: (ctx: any, parent: any) => any
  searchable?: string[]
  sortable?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterable?:
    | string[]
    | ((context: { query: any; filterBy: Record<string, unknown> }) => void)
  limit?: number
  cursorColumn?: string | string[]
  useOffset?: boolean
  cursor?: unknown
}

interface OrderField {
  column: string
  direction: "ASC" | "DESC"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function connectionResolver(
  options: ConnectionResolverOptions,
): (
  parent: any,
  args: any,
  ctx: any,
  info: GraphQLResolveInfo,
) => Promise<any> {
  const {
    model,
    query: buildQuery = (_ctx: unknown) => model.query(),
    searchable = [],
    sortable = [],
    filterable = [],
    limit: defaultLimit = 10,
    cursorColumn = "id",
    useOffset = false,
  } = options

  const cursorColumns = Array.isArray(cursorColumn)
    ? cursorColumn
    : [cursorColumn]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (parent: any, args: any, ctx: any, info: GraphQLResolveInfo) => {
    let {
      first,
      after,
      keyword,
      orderBy,
      filterBy = {},
      query: searchQuery,
    } = args
    first = first || defaultLimit

    let orderFields: OrderField[] = []
    if (orderBy && (sortable as string[]).length > 0) {
      const isDesc = orderBy.startsWith("-")
      const field = isDesc ? trimStart(orderBy, "-") : orderBy
      if (includes(sortable, field)) {
        orderFields = [{ column: field, direction: isDesc ? "DESC" : "ASC" }]
      }
    }

    if (orderFields.length === 0) {
      orderFields = [{ column: cursorColumns[0], direction: "DESC" }]
    }

    if (!useOffset) {
      const orderFieldNames = orderFields.map((f) => f.column)
      cursorColumns.forEach((col) => {
        if (!orderFieldNames.includes(col)) {
          orderFields.push({ column: col, direction: "DESC" })
        }
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = searchQuery || buildQuery(ctx, parent)
    query.where((builder: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedBuilder = builder as any
      if (!isEmpty(filterBy) && filterable) {
        if (isArray(filterable)) {
          ;(filterable as string[]).forEach((filterItem) => {
            if (isFunction(filterItem)) {
              ;(
                filterItem as (context: {
                  query: unknown
                  filterBy: Record<string, unknown>
                }) => void
              )({ query: typedBuilder, filterBy })
            } else if (typeof filterItem === "string" && filterBy[filterItem]) {
              typedBuilder.where({ [filterItem]: filterBy[filterItem] })
            }
          })
        } else if (isFunction(filterable)) {
          filterable({ query: typedBuilder, filterBy })
        }
      }

      if (searchable.length && keyword) {
        const knex = model.knex()
        typedBuilder.where(function (this: unknown) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ctx = this as any
          const like = ["pg", "postgres"].includes(knex.client.config.client)
            ? "ILIKE"
            : "LIKE"
          searchable.forEach((field, index) => {
            index
              ? ctx.orWhere(field, like, `%${keyword}%`)
              : ctx.where(field, like, `%${keyword}%`)
          })
        })
      }
    })

    const total = await query.resultSize()
    const limit = first + 1

    if (useOffset) {
      const offset = after ? Number(after) : 0
      query.offset(offset).limit(limit)
    } else {
      if (after) {
        const cursorData = parseCursor(after)

        if (cursorColumns.length === 1 && cursorData) {
          const column = orderFields[0].column
          const direction = orderFields[0].direction
          const comparison = direction === "ASC" ? ">" : "<"
          let cursorValue: unknown
          if (cursorData.values) {
            cursorValue = cursorData.values[column]
          } else if (cursorData.value !== undefined) {
            cursorValue = cursorData.value
          } else {
            cursorValue = cursorData
          }

          if (cursorValue !== undefined) {
            query.where(column, comparison, cursorValue)
          }
        } else if (cursorData?.values) {
          query.where(function (this: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ctx = this as any
            orderFields.forEach((field, index) => {
              const comparison = field.direction === "ASC" ? ">" : "<"
              const cursorValue = cursorData.values![field.column]

              if (cursorValue === undefined) return

              if (index === 0) {
                ctx.where(field.column, comparison, cursorValue)
              } else {
                ctx.orWhere(function (this: unknown) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const subCtx = this as any
                  let allPreviousValid = true
                  orderFields.slice(0, index).forEach((prevField) => {
                    const prevValue = cursorData.values![prevField.column]
                    if (prevValue !== undefined) {
                      subCtx.where(prevField.column, prevValue)
                    } else {
                      allPreviousValid = false
                    }
                  })
                  if (allPreviousValid) {
                    subCtx.where(field.column, comparison, cursorValue)
                  }
                })
              }
            })
          })
        }
      }
      query.limit(limit)
    }

    orderFields.forEach((field) => {
      const safeDirection = field.direction === "DESC" ? "DESC" : "ASC"
      query.orderByRaw(`?? ${safeDirection} NULLS LAST`, [field.column])
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes: any[] = await query

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cursorGenerator: any
    if (useOffset) {
      const offset = after ? Number(after) : 0
      cursorGenerator = {
        node: ({ index }: { index: number }) =>
          generateCursor(offset + index + 1),
        start: () => generateCursor(offset + 1),
        end: ({ nodes }: { nodes: unknown[] }) =>
          generateCursor(offset + nodes.length),
      }
    } else {
      cursorGenerator = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node: ({ node }: { node: any }) => {
          if (cursorColumns.length === 1) {
            return generateCursor(String(node[cursorColumns[0]]))
          }
          const values: Record<string, unknown> = {}
          cursorColumns.forEach((col) => {
            values[col] = node[col]
          })
          return generateCursor({ values })
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        start: ({ nodes }: { nodes: any[] }) => {
          if (nodes.length === 0) return null
          if (cursorColumns.length === 1) {
            return generateCursor(String(nodes[0][cursorColumns[0]]))
          }
          const values: Record<string, unknown> = {}
          cursorColumns.forEach((col) => {
            values[col] = nodes[0][col]
          })
          return generateCursor({ values })
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        end: ({ nodes }: { nodes: any[] }) => {
          if (nodes.length === 0) return null
          const lastNode = nodes[nodes.length - 1]
          if (cursorColumns.length === 1) {
            return generateCursor(String(lastNode[cursorColumns[0]]))
          }
          const values: Record<string, unknown> = {}
          cursorColumns.forEach((col) => {
            values[col] = lastNode[col]
          })
          return generateCursor({ values })
        },
      }
    }

    return relayResult(
      nodes,
      { first, total: Number(total), after: after || 0 },
      cursorGenerator,
    )
  }
}

// ============================================================================
// Relay Result Formatter
// ============================================================================

interface RelayMeta {
  first: number
  total: number
  after: number | string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function relayResult(
  nodes: any[],
  meta: RelayMeta,
  cursorConfig: any,
): any {
  const { first, total } = meta
  let hasNextPage = false
  let nodesInPage = nodes

  if (first && nodes.length > first) {
    hasNextPage = true
    nodesInPage = nodes.slice(0, first)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edges = nodesInPage.map((node: any, index: number) => ({
    node,
    cursor: cursorConfig.node({ node, index, after: meta.after }),
  }))

  return {
    total,
    edges,
    pageInfo: {
      startCursor:
        edges.length > 0
          ? cursorConfig.start({ nodes: nodesInPage, edges })
          : null,
      endCursor:
        edges.length > 0
          ? cursorConfig.end({ nodes: nodesInPage, edges })
          : null,
      hasNextPage,
    },
  }
}
