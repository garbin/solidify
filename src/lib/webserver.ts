import { fastifyRequestContext } from "@fastify/request-context"
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify"

export { Fastify }

/**
 * WebServer core class - internal implementation
 */
class WebServerCore {
  protected _instance: FastifyInstance

  constructor(options?: FastifyServerOptions) {
    this._instance = Fastify(options)
    this._instance.register(fastifyRequestContext)
  }

  get instance(): FastifyInstance {
    return this._instance
  }
}

// Property names that should NOT be proxied (WebServerCore's own properties)
const ownProperties = new Set(["instance", "_instance", "constructor"])

/**
 * Enhanced Fastify server with request context support.
 * Automatically registers @fastify/request-context for per-request storage.
 * All Fastify methods are automatically available through Proxy.
 *
 * @example
 * ```typescript
 * const server = new WebServer({ logger: true })
 * // All Fastify methods work:
 * server.decorate('myProp', 'value')
 * server.addHook('onRequest', async (request) => { ... })
 * server.decorateRequest('config', null)
 * // Escape hatch for direct access:
 * const fastify = server.instance
 * ```
 */
export const WebServer = new Proxy(WebServerCore, {
  construct(target, args) {
    const webServer = new target(args[0])

    return new Proxy(webServer as unknown as FastifyInstance, {
      get(obj, prop: string) {
        // If it's an own property of WebServerCore, return it directly
        if (ownProperties.has(prop)) {
          const value = (obj as unknown as Record<string, unknown>)[prop]
          if (typeof value === "function") {
            return value.bind(obj)
          }
          return value
        }

        // Otherwise, forward to the Fastify instance
        const core = obj as unknown as WebServerCore
        const instance = core.instance
        const value = (instance as unknown as Record<string, unknown>)[prop]

        // Bind methods to the Fastify instance
        if (typeof value === "function") {
          return value.bind(instance)
        }

        return value
      },
    })
  },
})

// Export type for TypeScript users
export type WebServerType = FastifyInstance & {
  instance: FastifyInstance
}
