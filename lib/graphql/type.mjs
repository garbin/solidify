import * as builtin from "graphql"
import * as scalars from "graphql-scalars"
import { get, isArray, isFunction } from "lodash-es"
import { Model } from "../model.mjs"

import { presets } from "./index.mjs"

export const dbTypeToGraphQLMaps = {
  string: "String",
  enum: "String",
  increments: "Int",
  integer: "Int",
  tinyint: "Int",
  mediumint: "Int",
  bigInteger: "BigInt",
  text: "String",
  float: "Float",
  decimal: "Float",
  boolean: "Boolean",
  date: "Date",
  datetime: "DateTime",
  time: "Time",
  timestamp: "Timestamp",
  json: "JSON",
  jsonb: "JSON",
  uuid: "UUID",
}

export const models = {}
export function model(modelClass) {
  if (models[modelClass.name]) return models[modelClass.name]
  if (!(modelClass.prototype instanceof Model)) {
    throw new Error("model is not instanceof Model")
  }
  models[modelClass.name] = type("ObjectType", {
    name: modelClass.name,
    fields: (_) => {
      const fields = {}
      for (const [field, config] of Object.entries(modelClass.fields)) {
        const { graphql = {} } = config
        if (!graphql.type) {
          if (get(config, "constraints.primary")) {
            graphql.type = type("NonNull", type("ID"))
          } else {
            const [colType] = isArray(config.type) ? config.type : [config.type]
            graphql.type = get(config, "constraints.notNullable")
              ? type("NonNull", type(dbTypeToGraphQLMaps[colType]))
              : type(dbTypeToGraphQLMaps[colType])
          }
        }
        fields[field] = { ...graphql }
      }
      for (const [field, _type] of Object.entries(modelClass.virtualFields)) {
        fields[field] = { type: type(dbTypeToGraphQLMaps[_type]) }
      }
      for (const [relation, info] of Object.entries(modelClass.relations)) {
        const { modelClass: relatedModel, ...options } = info
        if (info.relation === Model.HasManyRelation) {
          fields[relation] = {
            type: type("List", model(relatedModel)),
            resolve: presets.batch.hasMany(relatedModel, options),
          }
        } else if (info.relation === Model.HasOneRelation) {
          fields[relation] = {
            type: model(relatedModel),
            resolve: presets.batch.hasOne(relatedModel, options),
          }
        } else if (info.relation === Model.BelongsToOneRelation) {
          fields[relation] = {
            type: model(relatedModel),
            resolve: presets.batch.belongsTo(relatedModel, options),
          }
        } else if (info.relation === Model.ManyToManyRelation) {
          fields[relation] = {
            type: type("List", model(relatedModel)),
            resolve: presets.batch.belongsToMany({
              ...options,
              relation: relation,
            }),
          }
        }
      }
      return fields
    },
  })
  return models[modelClass.name]
}

export function type(name, ...args) {
  const Type = builtin[`GraphQL${name}`] || scalars[`GraphQL${name}`]
  if (!Type) {
    throw new Error(`GraphQL type '${name}' does not exist`)
  }
  return isFunction(Type) ? new Type(...args) : Type
}
