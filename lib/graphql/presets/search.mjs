import { includes, isArray, isEmpty, isFunction, trimStart } from "lodash-es"
import { model, type } from "../type.mjs"

/**
 * @description Base64 encoding and decoding utility.
 */
const base64 = {
  encode: (text) => Buffer.from(String(text), "utf-8").toString("base64"),
  decode: (text) => Buffer.from(text, "base64").toString("utf-8"),
}

// --- Type Definition Helpers -------------------------------------------------

function createSearchTypes(searchable, cursor) {
  return Object.entries(searchable).map(
    ([searchTypeName, searchTypeConfig]) => {
      const resolve =
        searchTypeConfig.resolve ||
        connectionResolver({
          model: searchTypeConfig.model,
          query: (_ctx) => searchTypeConfig.model.query(),
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

const createSearchEnum = (name, types) =>
  type("EnumType", {
    name: `${name}SearchType`,
    values: types.reduce((values, item) => {
      values[item.name] = { value: item.resolve }
      return values
    }, {}),
  })

const createSearchUnion = (name, types) =>
  type("UnionType", {
    name: `${name}SearchItem`,
    types: types.map((type) => type.type),
    resolveType(value) {
      for (const item of types) {
        if (value instanceof item.model) {
          return item.type.name
        }
      }
    },
  })

const createEdgeType = (name, ItemType) =>
  type("ObjectType", {
    name: `${name}SearchItemEdge`,
    fields: {
      node: { type: ItemType },
      cursor: {
        type: type("String"),
        resolve: (edge) => base64.encode(edge.cursor),
      },
    },
  })

const createPageInfoType = (name) =>
  type("ObjectType", {
    name: `${name}PageInfo`,
    fields: {
      startCursor: {
        type: type("String"),
        resolve: (pageInfo) =>
          pageInfo.startCursor ? base64.encode(pageInfo.startCursor) : null,
      },
      endCursor: {
        type: type("String"),
        resolve: (pageInfo) =>
          pageInfo.endCursor ? base64.encode(pageInfo.endCursor) : null,
      },
      hasNextPage: { type: type("Boolean") },
    },
  })

const createConnectionType = (name, EdgeType, PageInfoType) =>
  type("ObjectType", {
    name: `${name}SearchConnection`,
    fields: {
      total: { type: type("Int") },
      edges: { type: type("List", EdgeType) },
      pageInfo: { type: PageInfoType },
    },
  })

/**
 * @description Main function to build a GraphQL search connection field.
 */
export function search(searchable, options = {}) {
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
    async resolve(root, args, ctx, info) {
      const decodedArgs = {
        ...args,
        after: args.after ? base64.decode(args.after) : null,
        before: args.before ? base64.decode(args.before) : null,
        first: Number(args.first) || null,
        last: Number(args.last) || null,
      }

      const resolver = decodedArgs.type
      return await resolver(root, decodedArgs, ctx, info)
    },
  }
}

/**
 * @description Parse cursor string into structured data
 */
function parseCursor(cursorString) {
  if (!cursorString) return null

  try {
    const parsed = JSON.parse(cursorString)
    // If successfully parsed as JSON and it's an object with 'values', return it
    if (typeof parsed === "object" && parsed !== null && parsed.values) {
      return parsed
    }
    // Otherwise, treat the original string as a plain cursor value
    return { value: cursorString }
  } catch {
    // If JSON parse fails, treat as plain string cursor (most common case for single column)
    return { value: cursorString }
  }
}

/**
 * @description Generate cursor string from values
 */
function generateCursor(values) {
  if (typeof values === "string" || typeof values === "number") {
    return String(values)
  }
  return JSON.stringify(values)
}

/**
 * @description A robust resolver for creating connections from a query.
 * Supports both keyset-based and offset-based pagination.
 */
export function connectionResolver(options) {
  const {
    model,
    query: buildQuery = (_ctx) => model.query(),
    searchable = [],
    sortable = [],
    filterable = [],
    limit: defaultLimit = 10,
    // Simplified cursor configuration
    // For keyset: { cursorColumn: 'id' } or { cursorColumn: ['createdAt', 'id'] }
    // For offset: { useOffset: true }
    cursorColumn = "id",
    useOffset = false,
  } = options

  // Normalize cursor column to array
  const cursorColumns = Array.isArray(cursorColumn)
    ? cursorColumn
    : [cursorColumn]

  return async (
    parent,
    { first, after, keyword, orderBy, filterBy = {}, query: searchQuery },
    ctx,
  ) => {
    first = first || defaultLimit

    // 1. Parse user-provided orderBy
    let orderFields = []
    if (orderBy && sortable.length > 0) {
      const isDesc = orderBy.startsWith("-")
      const field = isDesc ? trimStart(orderBy, "-") : orderBy
      if (includes(sortable, field)) {
        orderFields = [{ column: field, direction: isDesc ? "DESC" : "ASC" }]
      }
    }

    // If no valid orderBy provided, use default: id DESC (most universal)
    if (orderFields.length === 0) {
      // Use the first cursor column as default sort
      orderFields = [{ column: cursorColumns[0], direction: "DESC" }]
    }

    // For keyset pagination, ensure all cursor columns are in orderBy
    if (!useOffset) {
      const orderFieldNames = orderFields.map((f) => f.column)
      cursorColumns.forEach((col) => {
        if (!orderFieldNames.includes(col)) {
          orderFields.push({ column: col, direction: "DESC" })
        }
      })
    }

    // 2. Build Base Query (with filters and search keywords)
    searchQuery = searchQuery || buildQuery(ctx, parent)
    searchQuery.where((builder) => {
      // Filtering logic
      if (!isEmpty(filterBy) && filterable) {
        if (isArray(filterable)) {
          filterable.forEach((filterItem) => {
            if (isFunction(filterItem)) {
              filterItem({ query: builder, filterBy })
            } else if (typeof filterItem === "string" && filterBy[filterItem]) {
              builder.where({ [filterItem]: filterBy[filterItem] })
            }
          })
        } else if (isFunction(filterable)) {
          filterable({ query: builder, filterBy })
        }
      }

      // Keyword search logic
      if (searchable.length && keyword) {
        const knex = model.knex()
        builder.where(function () {
          const like = ["pg", "postgres"].includes(knex.client.config.client)
            ? "ILIKE"
            : "LIKE"
          searchable.forEach((field, index) => {
            index
              ? this.orWhere(field, like, `%${keyword}%`)
              : this.where(field, like, `%${keyword}%`)
          })
        })
      }
    })

    // 3. Get total count
    const total = await searchQuery.resultSize()
    const limit = first + 1 // Fetch one extra to determine hasNextPage

    // 4. Apply pagination
    if (useOffset) {
      // Offset-based pagination
      const offset = after ? Number(after) : 0
      searchQuery.offset(offset).limit(limit)
    } else {
      // Keyset-based pagination
      if (after) {
        const cursorData = parseCursor(after)

        // For single column cursor, use simple comparison
        if (cursorColumns.length === 1) {
          const column = orderFields[0].column
          const direction = orderFields[0].direction
          const comparison = direction === "ASC" ? ">" : "<"
          // Handle both new format {values: {...}} and old format {value: ...} or plain string
          let cursorValue
          if (cursorData.values) {
            cursorValue = cursorData.values[column]
          } else if (cursorData.value !== undefined) {
            cursorValue = cursorData.value
          } else {
            // Plain string/number cursor (backward compatibility)
            cursorValue = cursorData
          }

          if (cursorValue !== undefined) {
            searchQuery.where(column, comparison, cursorValue)
          }
        } else {
          // For multi-column cursor, build complex WHERE clause
          // This implements row value comparison: (col1, col2) > (val1, val2)
          // Which translates to: col1 > val1 OR (col1 = val1 AND col2 > val2)
          if (cursorData.values) {
            searchQuery.where(function () {
              orderFields.forEach((field, index) => {
                const comparison = field.direction === "ASC" ? ">" : "<"
                const cursorValue = cursorData.values[field.column]

                if (cursorValue === undefined) return // Skip if cursor value missing

                if (index === 0) {
                  // First condition: just compare first column
                  this.where(field.column, comparison, cursorValue)
                } else {
                  // Subsequent conditions: previous columns equal AND current column compared
                  this.orWhere(function () {
                    // Add equality conditions for all previous columns
                    let allPreviousValid = true
                    orderFields.slice(0, index).forEach((prevField) => {
                      const prevValue = cursorData.values[prevField.column]
                      if (prevValue !== undefined) {
                        this.where(prevField.column, prevValue)
                      } else {
                        allPreviousValid = false
                      }
                    })
                    // Add comparison for current column only if all previous are valid
                    if (allPreviousValid) {
                      this.where(field.column, comparison, cursorValue)
                    }
                  })
                }
              })
            })
          }
        }
      }
      searchQuery.limit(limit)
    }

    // 5. Apply ordering
    orderFields.forEach((field) => {
      searchQuery.orderByRaw(`${field.column} ${field.direction} NULLS LAST`)
    })

    const nodes = await searchQuery

    // 6. Generate cursors
    let cursorGenerator
    if (useOffset) {
      const offset = after ? Number(after) : 0
      cursorGenerator = {
        node: ({ index }) => generateCursor(offset + index + 1),
        start: () => generateCursor(offset + 1),
        end: ({ nodes }) => generateCursor(offset + nodes.length),
      }
    } else {
      cursorGenerator = {
        node: ({ node }) => {
          if (cursorColumns.length === 1) {
            // For single column, just encode the value directly as a string
            return generateCursor(String(node[cursorColumns[0]]))
          }
          // For multi-column cursors, encode all values as an object
          const values = {}
          cursorColumns.forEach((col) => {
            values[col] = node[col]
          })
          return generateCursor({ values })
        },
        start: ({ nodes }) => {
          if (nodes.length === 0) return null
          if (cursorColumns.length === 1) {
            return generateCursor(String(nodes[0][cursorColumns[0]]))
          }
          const values = {}
          cursorColumns.forEach((col) => {
            values[col] = nodes[0][col]
          })
          return generateCursor({ values })
        },
        end: ({ nodes }) => {
          if (nodes.length === 0) return null
          const lastNode = nodes[nodes.length - 1]
          if (cursorColumns.length === 1) {
            return generateCursor(String(lastNode[cursorColumns[0]]))
          }
          const values = {}
          cursorColumns.forEach((col) => {
            values[col] = lastNode[col]
          })
          return generateCursor({ values })
        },
      }
    }

    // 7. Format results
    return relayResult(
      nodes,
      { first, total: Number(total), after: after || 0 },
      cursorGenerator,
    )
  }
}

/**
 * @description Formats a list of nodes into a Relay-compliant connection object.
 */
export function relayResult(nodes, meta, cursorConfig) {
  const { first, total, after } = meta
  let hasNextPage = false
  let nodesInPage = nodes

  if (first && nodes.length > first) {
    hasNextPage = true
    nodesInPage = nodes.slice(0, first)
  }

  const edges = nodesInPage.map((node, index) => ({
    node,
    cursor: cursorConfig.node({ node, index, after }),
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
