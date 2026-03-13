// @ts-nocheck
import { fastifyRequestContext } from "@fastify/request-context"
import Fastify from "fastify"

// Re-export Fastify for convenience
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
export class WebServer extends Fastify {
  /**
   * Create a WebServer instance.
   * @param options - Fastify options
   * @param args - Additional Fastify constructor arguments
   */
  constructor(options?: Fastify.FastifyServerOptions, ...args: unknown[]) {
    super(options, ...(args as []))
    this.register(fastifyRequestContext)
  }
}
