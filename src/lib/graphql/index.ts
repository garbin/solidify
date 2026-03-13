import { makeExecutableSchema } from "@graphql-tools/schema"
import type { FastifyPluginAsync } from "fastify"
import fp from "fastify-plugin"
import {
  typeDefs as scalarsDefs,
  resolvers as scalarsResolvers,
} from "graphql-scalars"
import mercurius from "mercurius"

export * from "./loader.js"
export * as presets from "./presets/index.js"
export * from "./type.js"

export interface GraphQLPluginOptions {
  typeDefs?: string
  resolvers?: Record<string, unknown>
  graphiql?: boolean
  [key: string]: unknown
}

export function plugin({
  typeDefs,
  resolvers,
  ...config
}: GraphQLPluginOptions): FastifyPluginAsync {
  return fp(
    async (app) => {
      if (typeDefs && resolvers) {
        config.schema = makeExecutableSchema({
          typeDefs: [...scalarsDefs, typeDefs],
          resolvers: { ...scalarsResolvers, ...resolvers },
        })
      }
      app.register(mercurius, config)
    },
    { name: "solidify/graphql" },
  )
}
