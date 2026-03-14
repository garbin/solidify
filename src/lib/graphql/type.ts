import * as builtin from "graphql"
import * as scalars from "graphql-scalars"
import { get, isArray, isFunction } from "lodash-es"
import { type FieldConfig, type FieldsConfig, Model } from "../model.js"
import { presets } from "./index.js"

export const dbTypeToGraphQLMaps: Record<string, string> = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const models: Record<string, any> = {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function model(modelClass: typeof Model): any {
  if (models[modelClass.name]) return models[modelClass.name]
  if (!(modelClass.prototype instanceof Model)) {
    throw new Error("model is not instanceof Model")
  }
  models[modelClass.name] = type("ObjectType", {
    name: modelClass.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: (_: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields: Record<string, any> = {}
      for (const [field, config] of Object.entries(
        modelClass.fields as FieldsConfig,
      )) {
        const fieldConfig = config as FieldConfig
        const graphql = fieldConfig.graphql || {}
        if (!graphql.type) {
          if (get(fieldConfig, "constraints.primary")) {
            graphql.type = type("NonNull", type("ID"))
          } else {
            const [colType] = isArray(fieldConfig.type)
              ? fieldConfig.type
              : [fieldConfig.type]
            graphql.type = get(fieldConfig, "constraints.notNullable")
              ? type("NonNull", type(dbTypeToGraphQLMaps[colType as string]))
              : type(dbTypeToGraphQLMaps[colType as string])
          }
        }
        fields[field] = { ...graphql }
      }
      for (const [field, fieldType] of Object.entries(
        modelClass.virtualFields,
      )) {
        fields[field] = { type: type(dbTypeToGraphQLMaps[fieldType]) }
      }
      for (const [relation, info] of Object.entries(modelClass.relations)) {
        const relationInfo = info as {
          modelClass: typeof Model
          relation:
            | typeof Model.HasManyRelation
            | typeof Model.HasOneRelation
            | typeof Model.BelongsToOneRelation
            | typeof Model.ManyToManyRelation
          [key: string]: unknown
        }
        const { modelClass: relatedModel, ...options } = relationInfo
        if (relationInfo.relation === Model.HasManyRelation) {
          fields[relation] = {
            type: type("List", model(relatedModel)),
            resolve: presets.batch.hasMany(
              relatedModel,
              options as Parameters<typeof presets.batch.hasMany>[1],
            ),
          }
        } else if (relationInfo.relation === Model.HasOneRelation) {
          fields[relation] = {
            type: model(relatedModel),
            resolve: presets.batch.hasOne(
              relatedModel,
              options as Parameters<typeof presets.batch.hasOne>[1],
            ),
          }
        } else if (relationInfo.relation === Model.BelongsToOneRelation) {
          fields[relation] = {
            type: model(relatedModel),
            resolve: presets.batch.belongsTo(
              relatedModel,
              options as Parameters<typeof presets.batch.belongsTo>[1],
            ),
          }
        } else if (relationInfo.relation === Model.ManyToManyRelation) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function type(name: string, ...args: unknown[]): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Type =
    (builtin as any)[`GraphQL${name}`] || (scalars as any)[`GraphQL${name}`]
  if (!Type) {
    throw new Error(`GraphQL type '${name}' does not exist`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return isFunction(Type) ? new (Type as any)(...args) : Type
}
