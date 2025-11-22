import { makeExecutableSchema } from "@graphql-tools/schema"
import fp from "fastify-plugin"
import {
  typeDefs as scalarsDefs,
  resolvers as scalarsResolvers,
} from "graphql-scalars"
import mercurius from "mercurius"

export * from "./loader.mjs"
export * as presets from "./presets/index.mjs"
export * from "./type.mjs"

export function plugin({ typeDefs, resolvers, ...config }) {
  return fp(
    async (app, _options) => {
      try {
        if (typeDefs && resolvers) {
          config.schema = makeExecutableSchema({
            typeDefs: [...scalarsDefs, typeDefs],
            resolvers: { ...scalarsResolvers, ...resolvers },
          })
        }
        app.register(mercurius, config)
      } catch (e) {
        app.log.fatal(e)
        app.errorHandler(e)
      }
    },
    { name: "swiftify/graphql" },
  )
}
