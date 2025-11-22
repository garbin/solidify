import { fastifyRequestContext } from "@fastify/request-context"
import Fastify from "fastify"

export { Fastify }
export class WebServer extends Fastify {
  constructor(options, ...args) {
    super(options, ...args)
    this.register(fastifyRequestContext)
  }
}
