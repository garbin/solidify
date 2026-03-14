import { fastifyRequestContext } from "@fastify/request-context"
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify"

export { Fastify }

/**
 * Enhanced Fastify server with request context support.
 * Automatically registers @fastify/request-context for per-request storage.
 *
 * @example
 * ```typescript
 * const server = new WebServer({ logger: true })
 * // In a handler:
 * request.requestContext.set('user', user)
 * const user = request.requestContext.get('user')
 * ```
 */
export class WebServer {
  private _instance: FastifyInstance

  constructor(options?: FastifyServerOptions) {
    this._instance = Fastify(options)
    this._instance.register(fastifyRequestContext)
  }

  get inject() {
    return this._instance.inject.bind(this._instance)
  }
  get register() {
    return this._instance.register.bind(this._instance)
  }
  get get() {
    return this._instance.get.bind(this._instance)
  }
  get post() {
    return this._instance.post.bind(this._instance)
  }
  get put() {
    return this._instance.put.bind(this._instance)
  }
  get delete() {
    return this._instance.delete.bind(this._instance)
  }
  get patch() {
    return this._instance.patch.bind(this._instance)
  }
  get head() {
    return this._instance.head.bind(this._instance)
  }
  get options() {
    return this._instance.options.bind(this._instance)
  }
  get all() {
    return this._instance.all.bind(this._instance)
  }
  get route() {
    return this._instance.route.bind(this._instance)
  }
  get listen() {
    return this._instance.listen.bind(this._instance)
  }
  get close() {
    return this._instance.close.bind(this._instance)
  }
  get ready() {
    return this._instance.ready.bind(this._instance)
  }
  get log() {
    return this._instance.log
  }
  get server() {
    return this._instance.server
  }
  get instance(): FastifyInstance {
    return this._instance
  }
}
