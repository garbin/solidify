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
import { Model } from "./model.mjs"

import { cursor2page } from "./pagination.mjs"

export class Router {
  routes = []
  middleHandlers = []
  methods = ["get", "post", "patch", "delete", "put"]
  constructor() {
    return new Proxy(this, {
      get(target, method) {
        if (target[method]) {
          return target[method]
        } else if (target.methods.includes(method)) {
          return (url, handler, options = {}) => {
            target.routes.push({
              method: method.toUpperCase(),
              url,
              handler: compose(...target.middleHandlers, handler),
              ...options,
            })
            return this
          }
        }
      },
    })
  }

  use(...middleHandlers) {
    this.middleHandlers = this.middleHandlers.concat(middleHandlers)
    return this
  }

  plugin() {
    return async (app) => {
      for (const route of this.routes) {
        app.route(route)
      }
    }
  }
}

export class RESTfulRouter extends Router {
  model = null
  options = {}
  routes = []
  metadata = {
    rootPath: null,
    itemPath: null,
    idColumn: null,
    idType: null,
  }

  constructor(model, options = {}) {
    if (!(model.prototype instanceof Model)) {
      throw new Error("Invalid model provided to RESTfulRouter")
    }
    const proxy = super()
    this.model = model
    this.metadata.idColumn = options.idColumn || model.idColumn
    this.metadata.idType = options.idType || "\\d+"
    this.metadata.rootPath = options.rootPath || `/${model.tableName}`
    this.metadata.itemPath = `${this.metadata.rootPath}/:${this.metadata.idColumn}`
    this.metadata.query = options.query || (() => model.query())
    return proxy
  }

  create(...args) {
    const { handlers, options } = extract(args)
    this.post(
      this.metadata.rootPath,
      compose(...handlers, async (request, reply) => {
        const query =
          request.requestContext.get("query") || this.metadata.query()
        const attributes =
          request.requestContext.get("attributes") || request.body
        const item = await query.insertGraphAndFetch(attributes)
        reply.code(201).send(item)
      }),
      options,
    )
    return this
  }

  list(...args) {
    const { handlers, options } = extract(args, {
      select: null,
      join: null,
      eager: null,
      sortable: [],
      searchable: [],
      filterable: [],
      pagination: undefined,
    })
    this.get(
      this.metadata.rootPath,
      compose(...handlers, async (request, reply) => {
        const query =
          request.requestContext.get("query") || this.metadata.query()
        const {
          q: keywords,
          sort: orderBy = first(options.sortable),
          ...filters
        } = request.query
        options.select && query.select(...options.select)
        options.join && query.leftJoinRelated(options.join)

        options.eager && query.withGraphFetched(...options.eager)
        query.where((builder) => {
          if (!isEmpty(filters) && options.filterable) {
            const filter = (field, parser) => {
              if (filters[field]) {
                if (!isFunction(field)) {
                  parser =
                    parser || ((value) => builder.where({ [field]: value }))
                  parser(filters[field])
                } else {
                  field({ filters, query: builder })
                }
              }
            }
            const applyFilters = isArray(options.filterable)
              ? () =>
                  options.filterable.forEach((item) => {
                    if (isFunction(item)) {
                      item({ filter, query: builder, filters })
                    } else {
                      filter(item)
                    }
                  })
              : options.filterable
            applyFilters({ filter, query: builder, filters })
          }

          if (keywords && options.searchable) {
            const knex = this.model.knex()
            const like = ["pg", "postgres"].includes(knex.client.config.client)
              ? "ILIKE"
              : "LIKE"
            builder.where(function () {
              const search = (field, parser, or) => {
                parser =
                  parser ||
                  ((keywords, like, query) =>
                    query[or ? "orWhere" : "where"](
                      field,
                      like,
                      `%${keywords}%`,
                    ))
                parser(keywords, like, this)
              }
              const applySearch = isArray(options.searchable)
                ? () =>
                    options.searchable.forEach((field, index) => {
                      search(field, null, index !== 0)
                    })
                : options.searchable
              applySearch({ search, query: builder, keywords, knex })
            })
          }
          return builder
        })

        if (options.sortable.length) {
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
          ...cursor2page(request.pagination.offset, request.pagination.limit),
        )
        reply
          .paginate({ ...request.pagination, length: result.total })
          .send(result.results)
      }),
      options,
    )
    return this
  }

  item(...args) {
    const { handlers, options } = extract(args, {
      select: null,
      eager: null,
      join: null,
    })
    this.get(
      this.metadata.itemPath,
      compose(...handlers, async (request, reply) => {
        const query =
          request.requestContext.get("query") || this.metadata.query()
        if (options.select) query.select(...options.select)
        if (options.join) query.leftJoinRelated(options.join)
        options.eager && query.withGraphFetched(...options.eager)
        reply.send(
          await query
            .findOne({
              [`${this.model.tableName}.${this.metadata.idColumn}`]:
                request.params[this.metadata.idColumn],
            })
            .throwIfNotFound(),
        )
      }),
    )
    return this
  }

  update(...args) {
    const { handlers, options } = extract(args, { patch: true })
    const update = async (request, reply) => {
      const attributes =
        request.requestContext.get("attributes") || request.body
      const query = request.requestContext.get("query") || this.metadata.query()
      const where = {
        [this.metadata.idColumn]: request.params[this.metadata.idColumn],
      }
      const item = await query.findOne(where)
      if (!(item instanceof this.model)) {
        throw new httpErrors.NotFound(
          `Item #${this.idColumn} = ${request.params[this.metadata.idColumn]} can not be found`,
        )
      }
      const result = await item.$query().patchAndFetch(attributes)
      if (options.after) await options.after(request, reply)
      reply.code(202).send(result)
    }
    this.put(this.metadata.itemPath, compose(...handlers, update), options)
    this.patch(this.metadata.itemPath, compose(...handlers, update), options)

    return this
  }

  destroy(...args) {
    const { handlers, options } = extract(args)

    this.delete(
      this.metadata.itemPath,
      compose(...handlers, async (request, reply) => {
        const query =
          request.requestContext.get("query") || this.metadata.query()
        const where = {
          [this.metadata.idColumn]: request.params[this.metadata.idColumn],
        }
        const item = await query.findOne(where)
        if (!(item instanceof Model)) {
          throw new httpErrors.NotFound(
            `Item #${this.metadata.idColumn} = ${request.params[this.idColumn]} can not be found`,
          )
        }
        request.requestContext.set("deleted", item)
        await item.$query().delete()
        if (options.after) await options.after(request, reply)
        reply.code(204).send()
      }),
    )
    return this
  }

  crud() {
    return this.create().list().item().update().destroy()
  }

  child(childModel, router, options = {}) {
    const relation = this.model.findRelation(childModel, [
      Model.HasManyRelation,
      Model.HasOneRelation,
      Model.ManyToManyRelation,
    ])
    if (!relation.name) {
      throw new httpErrors.InternalServerError("Relation not found")
    }

    const childRoute = new RESTfulRouter(childModel, {
      rootPath: `${this.metadata.rootPath}/:${relation.info.foreignKey}/${childModel.tableName}`,
      ...options,
    })
    childRoute.use(async (request, _reply) => {
      const parent = await this.model
        .query()
        .findOne({
          [this.metadata.idColumn]: request.params[relation.info.foreignKey],
        })
        .throwIfNotFound()
      request.requestContext.set("query", parent.$relatedQuery(relation.name))
    })
    router(childRoute)
    this.routes = this.routes.concat(childRoute.routes)
    return this
  }
}

function compose(...funcs) {
  return async (request, reply) => {
    for (const func of compact(funcs)) {
      await func(request, reply)
    }
  }
}

function extract(args = [], defaultOptions = {}) {
  const options = !isFunction(last(args))
    ? defaults(args.pop(), defaultOptions)
    : defaultOptions
  const handlers = compact(args)
  return { handlers, options }
}
