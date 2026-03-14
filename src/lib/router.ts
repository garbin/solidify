import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteOptions,
} from "fastify"
import httpErrors from "http-errors"
import {
  compact,
  defaults,
  first,
  includes,
  isArray,
  isEmpty,
  isFunction,
  last,
  trimStart,
} from "lodash-es"
import type { RelationType } from "objection"
import { Model } from "./model.js"
import { cursor2page } from "./pagination.js"

declare module "@fastify/request-context" {
  interface RequestContext {
    get<T = unknown>(key: string): T | undefined
    set<T>(key: string, value: T): void
  }
}

// ============================================================================
// Types
// ============================================================================

export type RouteHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void
export type MiddlewareHandler = RouteHandler

export interface RouteDefinition extends Partial<RouteOptions> {
  method: HTTPMethods
  url: string
  handler: RouteHandler
}

export interface ListOptions extends Record<string, unknown> {
  select?: string[]
  join?: string
  eager?: unknown
  sortable?: string[]
  searchable?: string[] | ((context: SearchContext) => void)
  filterable?: string[] | ((context: FilterContext) => void)
}

export interface ItemOptions extends Record<string, unknown> {
  select?: string[]
  eager?: unknown
  join?: string
}

export interface UpdateOptions extends Record<string, unknown> {
  patch?: boolean
  after?: RouteHandler
}

export interface DestroyOptions extends Record<string, unknown> {
  after?: RouteHandler
}

export interface RouterOptions {
  idColumn?: string
  idType?: string
  rootPath?: string
  query?: () => ReturnType<typeof Model.query>
}

export interface SearchContext {
  search: (field: string, parser?: SearchParser | null, or?: boolean) => void
  query: unknown
  keywords: string
  knex: unknown
}

export interface FilterContext {
  filter: (field: string | Function, parser?: FilterParser) => void
  query: unknown
  filters: Record<string, string>
}

export type SearchParser = (
  keywords: string,
  like: string,
  query: unknown,
) => void
export type FilterParser = (value: string) => void

function getIdParamSchema(
  idColumn: string,
  idType: string,
): Record<string, unknown> {
  if (idType === "\\d+") {
    return {
      type: "object",
      properties: {
        [idColumn]: { type: "integer", minimum: 1 },
      },
      required: [idColumn],
    }
  }
  return {
    type: "object",
    properties: {
      [idColumn]: { type: "string", minLength: 1 },
    },
    required: [idColumn],
  }
}

function getIdValue(
  request: FastifyRequest,
  idColumn: string,
): string | number {
  const params = request.params as Record<string, string>
  const value = params[idColumn]
  if (!value) {
    throw new httpErrors.BadRequest(`Missing ${idColumn} parameter`)
  }
  return value
}

function compose(
  ...funcs: (MiddlewareHandler | undefined | null)[]
): RouteHandler {
  return async (request, reply) => {
    for (const func of compact(funcs)) {
      await func(request, reply)
    }
  }
}

interface ExtractResult<T = Record<string, unknown>> {
  handlers: RouteHandler[]
  options: T
}

function extract<T extends Record<string, unknown> = Record<string, unknown>>(
  args: (RouteHandler | Record<string, unknown>)[] = [],
  defaultOptions: T = {} as T,
): ExtractResult<T> {
  const options = !isFunction(last(args))
    ? (defaults(args.pop() as Record<string, unknown>, defaultOptions) as T)
    : defaultOptions
  const handlers = compact(args) as RouteHandler[]
  return { handlers, options }
}

// ============================================================================
// Router Class
// ============================================================================

export class Router {
  routes: RouteDefinition[] = []
  middleHandlers: MiddlewareHandler[] = []

  private addRoute(
    method: HTTPMethods,
    url: string,
    handler: RouteHandler,
    options: Partial<RouteDefinition> = {},
  ): this {
    this.routes.push({
      method,
      url,
      handler: compose(...this.middleHandlers, handler),
      ...options,
    })
    return this
  }

  get(
    url: string,
    handler: RouteHandler,
    options: Partial<RouteDefinition> = {},
  ): this {
    return this.addRoute("GET", url, handler, options)
  }

  post(
    url: string,
    handler: RouteHandler,
    options: Partial<RouteDefinition> = {},
  ): this {
    return this.addRoute("POST", url, handler, options)
  }

  put(
    url: string,
    handler: RouteHandler,
    options: Partial<RouteDefinition> = {},
  ): this {
    return this.addRoute("PUT", url, handler, options)
  }

  patch(
    url: string,
    handler: RouteHandler,
    options: Partial<RouteDefinition> = {},
  ): this {
    return this.addRoute("PATCH", url, handler, options)
  }

  delete(
    url: string,
    handler: RouteHandler,
    options: Partial<RouteDefinition> = {},
  ): this {
    return this.addRoute("DELETE", url, handler, options)
  }

  use(...middleHandlers: MiddlewareHandler[]): this {
    this.middleHandlers = this.middleHandlers.concat(middleHandlers)
    return this
  }

  plugin(): FastifyPluginAsync {
    return async (app: FastifyInstance) => {
      for (const route of this.routes) {
        app.route(route as RouteOptions)
      }
    }
  }
}

// ============================================================================
// RESTfulRouter Class
// ============================================================================

export class RESTfulRouter extends Router {
  model!: typeof Model
  options: RouterOptions = {}
  routes: RouteDefinition[] = []

  metadata = {
    rootPath: null as string | null,
    itemPath: null as string | null,
    idColumn: null as string | null,
    idType: null as string | null,
    query: null as (() => ReturnType<typeof Model.query>) | null,
  }

  constructor(model: typeof Model, options: RouterOptions = {}) {
    super()
    if (!(model.prototype instanceof Model)) {
      throw new Error("Invalid model provided to RESTfulRouter")
    }
    this.model = model
    this.metadata.idColumn = options.idColumn || (model.idColumn as string)
    this.metadata.idType = options.idType || "\\d+"
    this.metadata.rootPath = options.rootPath || `/${model.tableName}`
    this.metadata.itemPath = `${this.metadata.rootPath}/:${this.metadata.idColumn}`
    this.metadata.query = options.query || (() => model.query())
  }

  create(...args: (RouteHandler | Record<string, unknown>)[]): this {
    const { handlers, options } = extract(args)
    this.post(
      this.metadata.rootPath!,
      compose(...handlers, async (request, reply) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: any =
          request.requestContext.get("query") || this.metadata.query!()
        const attributes =
          request.requestContext.get("attributes") || request.body
        const item = await query.insertGraphAndFetch(
          attributes as Record<string, unknown>,
        )
        reply.code(201).send(item)
      }),
      options,
    )
    return this
  }

  list(...args: (RouteHandler | ListOptions)[]): this {
    const { handlers, options } = extract<ListOptions>(args, {
      select: undefined,
      join: undefined,
      eager: undefined,
      sortable: [],
      searchable: [],
      filterable: [],
    })
    this.get(
      this.metadata.rootPath!,
      compose(...handlers, async (request, reply) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: any =
          request.requestContext.get("query") || this.metadata.query!()
        const {
          q: keywords,
          sort: orderBy = first(options.sortable),
          ...filters
        } = request.query as Record<string, string>
        options.select && query.select(...options.select)
        options.join && query.leftJoinRelated(options.join)

        options.eager && query.withGraphFetched(...(options.eager as [unknown]))
        query.where((builder: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const typedBuilder = builder as any
          if (!isEmpty(filters) && options.filterable) {
            const filter = (
              field: string | Function,
              parser?: FilterParser,
            ) => {
              const fieldName = typeof field === "string" ? field : null
              if (fieldName && filters[fieldName]) {
                if (!isFunction(field)) {
                  parser =
                    parser ||
                    ((value: string) =>
                      typedBuilder.where({ [fieldName]: value }))
                  parser(filters[fieldName])
                } else {
                  ;(field as Function)({ filters, query: typedBuilder })
                }
              }
            }
            const applyFilters = isArray(options.filterable)
              ? () =>
                  (options.filterable as string[]).forEach((item) => {
                    if (isFunction(item)) {
                      item({ filter, query: typedBuilder, filters })
                    } else {
                      filter(item)
                    }
                  })
              : options.filterable
            ;(applyFilters as Function)({
              filter,
              query: typedBuilder,
              filters,
            })
          }

          if (keywords && options.searchable) {
            const knex = this.model.knex()
            const like = ["pg", "postgres"].includes(knex.client.config.client)
              ? "ILIKE"
              : "LIKE"
            typedBuilder.where(function (this: unknown) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const ctx = this as any
              const search = (
                field: string,
                parser?: SearchParser | null,
                or?: boolean,
              ) => {
                parser =
                  parser ||
                  ((keywords: string, like: string, query: unknown) =>
                    (query as any)[or ? "orWhere" : "where"](
                      field,
                      like,
                      `%${keywords}%`,
                    ))
                parser(keywords, like, ctx)
              }
              const applySearch = isArray(options.searchable)
                ? () =>
                    (options.searchable as string[]).forEach((field, index) => {
                      search(field, null, index !== 0)
                    })
                : options.searchable
              ;(applySearch as Function)({
                search,
                query: typedBuilder,
                keywords,
                knex,
              })
            })
          }
          return typedBuilder
        })

        if (options.sortable && options.sortable.length) {
          let [orderByField, orderByDirection] = [options.sortable[0], "ASC"]

          if (orderBy) {
            const orderByTrimed = trimStart(orderBy, "-")
            if (includes(options.sortable, orderByTrimed)) {
              orderByField = orderByTrimed
              orderByDirection = orderBy.startsWith("-") ? "DESC" : "ASC"
            }
          }
          query.orderBy(orderByField, orderByDirection)
        }
        const result = await query.page(
          ...cursor2page(
            request.pagination!.offset,
            request.pagination!.limit as number,
          ),
        )
        reply
          .paginate({ ...request.pagination!, length: result.total } as {
            offset: number
            last: number | "*"
            length: number
            unit?: string
          })
          .send(result.results)
      }),
      options as Partial<RouteDefinition>,
    )
    return this
  }

  item(...args: (RouteHandler | ItemOptions)[]): this {
    const { handlers, options } = extract<ItemOptions>(args, {
      select: undefined,
      eager: undefined,
      join: undefined,
    })
    this.get(
      this.metadata.itemPath!,
      compose(...handlers, async (request, reply) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: any =
          request.requestContext.get("query") || this.metadata.query!()
        if (options.select) query.select(...options.select)
        if (options.join) query.leftJoinRelated(options.join)
        options.eager && query.withGraphFetched(...(options.eager as [unknown]))
        const idValue = getIdValue(request, this.metadata.idColumn!)
        reply.send(
          await query
            .findOne({
              [`${this.model.tableName}.${this.metadata.idColumn}`]: idValue,
            })
            .throwIfNotFound(),
        )
      }),
      {
        schema: {
          params: getIdParamSchema(
            this.metadata.idColumn!,
            this.metadata.idType!,
          ),
        },
      } as Partial<RouteDefinition>,
    )
    return this
  }

  update(...args: (RouteHandler | UpdateOptions)[]): this {
    const { handlers, options } = extract<UpdateOptions>(args, { patch: true })
    const idSchema = getIdParamSchema(
      this.metadata.idColumn!,
      this.metadata.idType!,
    )
    const update = async (request: FastifyRequest, reply: FastifyReply) => {
      const attributes =
        request.requestContext.get("attributes") || request.body
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: any =
        request.requestContext.get("query") || this.metadata.query!()
      const idValue = getIdValue(request, this.metadata.idColumn!)
      const item = await query.findOne({
        [this.metadata.idColumn!]: idValue,
      })
      if (!(item instanceof this.model)) {
        throw new httpErrors.NotFound("Resource not found")
      }
      const result = await item
        .$query()
        .patchAndFetch(attributes as Record<string, unknown>)
      if (options.after) await options.after(request, reply)
      reply.code(202).send(result)
    }
    this.put(this.metadata.itemPath!, compose(...handlers, update), {
      schema: { params: idSchema },
    } as Partial<RouteDefinition>)
    this.patch(this.metadata.itemPath!, compose(...handlers, update), {
      schema: { params: idSchema },
    } as Partial<RouteDefinition>)

    return this
  }

  destroy(...args: (RouteHandler | DestroyOptions)[]): this {
    const { handlers, options } = extract<DestroyOptions>(args)

    this.delete(
      this.metadata.itemPath!,
      compose(...handlers, async (request, reply) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: any =
          request.requestContext.get("query") || this.metadata.query!()
        const idValue = getIdValue(request, this.metadata.idColumn!)
        const item = await query.findOne({
          [this.metadata.idColumn!]: idValue,
        })
        if (!(item instanceof Model)) {
          throw new httpErrors.NotFound("Resource not found")
        }
        request.requestContext.set("deleted", item)
        await item.$query().delete()
        if (options.after) await options.after(request, reply)
        reply.code(204).send()
      }),
      {
        schema: {
          params: getIdParamSchema(
            this.metadata.idColumn!,
            this.metadata.idType!,
          ),
        },
      } as Partial<RouteDefinition>,
    )
    return this
  }

  crud(): this {
    return this.create().list().item().update().destroy()
  }

  child(
    childModel: typeof Model,
    router: (childRouter: RESTfulRouter) => void,
    options: RouterOptions = {},
  ): this {
    const relation = this.model.findRelation(childModel, [
      Model.HasManyRelation as unknown as string,
      Model.HasOneRelation as unknown as string,
      Model.ManyToManyRelation as unknown as string,
    ])
    if (!relation.name) {
      throw new httpErrors.InternalServerError("Relation not found")
    }

    const childRoute = new RESTfulRouter(childModel, {
      rootPath: `${this.metadata.rootPath}/:${relation.info.foreignKey as string}/${childModel.tableName}`,
      ...options,
    })
    childRoute.use(async (request, _reply) => {
      const parent = await this.model
        .query()
        .findOne({
          [this.metadata.idColumn!]: (request.params as Record<string, string>)[
            relation.info.foreignKey as string
          ],
        })
        .throwIfNotFound()
      request.requestContext.set("query", parent.$relatedQuery(relation.name))
    })
    router(childRoute)
    this.routes = this.routes.concat(childRoute.routes)
    return this
  }
}
