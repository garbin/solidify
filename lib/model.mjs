import { singularize } from "inflected"
import Knex from "knex"
import { fromPairs, has, isArray, isEmpty, pick, toPairs } from "lodash-es"
import { Model as BaseModel, Validator as BaseValidator } from "objection"
import yup from "yup"

// ============================================================================
// 工具函数
// ============================================================================

function getFieldsConfig(fields, configName) {
  const pairs = toPairs(fields)
  const hasConfigFields = pairs.filter(([_field, meta]) => !!meta[configName])
  return fromPairs(
    hasConfigFields.map(([field, meta]) => [field, meta[configName]]),
  )
}

// ============================================================================
// 导出 Objection 的所有内容
// ============================================================================

export * from "objection"

// ============================================================================
// 验证器构建函数
// ============================================================================

function createEnumValidator(args) {
  return yup.mixed().oneOf(...args)
}

function createIntegerValidator() {
  return yup.number().integer()
}

function createNumberValidator() {
  return yup.number()
}

function createStringValidator(args) {
  let validator = yup.string()
  if (args[0]) {
    validator = validator.max(args[0])
  }
  return validator
}

function createUuidValidator() {
  return yup
    .string()
    .trim()
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[8|9|a|b][0-9a-f]{3}-[0-9a-f]{12}$/i,
      "Invalid UUID format",
    )
}

function createDateValidator() {
  return yup.date()
}

function createTimestampValidator() {
  return yup.date().transform(function (castValue, originalValue) {
    return this.isType(castValue) ? castValue : new Date(originalValue)
  })
}

function createJsonValidator(args) {
  return yup
    .mixed()
    .test("is-object-or-array", "must be an object or array", (value) => {
      if (value == null) return true
      return (
        Array.isArray(value) ||
        (typeof value === "object" && !Array.isArray(value))
      )
    })
    .when([], (_schema) =>
      yup.lazy((value) => {
        if (value == null) {
          return yup.mixed()
        }
        if (Array.isArray(value)) {
          return yup.array()
        }
        if (typeof value === "object") {
          let objSchema = yup.object()
          if (args.length) {
            objSchema = objSchema.shape(args[0])
          }
          return objSchema
        }
        return yup.mixed()
      }),
    )
}

function createBaseValidator(type) {
  const [_type, ...args] = isArray(type) ? type : [type]

  switch (_type) {
    case "enum":
    case "enu":
      return createEnumValidator(args)

    case "increments":
    case "integer":
    case "tinyint":
    case "mediumint":
    case "bigint":
    case "bigInteger":
      return createIntegerValidator()

    case "float":
    case "decimal":
      return createNumberValidator()

    case "text":
    case "string":
      return createStringValidator(args)

    case "uuid":
      return createUuidValidator()

    case "date":
    case "datetime":
    case "time":
      return createDateValidator()

    case "timestamp":
      return createTimestampValidator()

    case "json":
    case "jsonb":
      return createJsonValidator(args)

    default:
      return yup[_type](...args)
  }
}

function applyConstraints(validator, constraints = {}) {
  if (has(constraints, "unsigned") && constraints.unsigned) {
    validator = validator.positive()
  }

  if (has(constraints, "nullable") && constraints.nullable) {
    validator = validator.nullable()
  }

  if (has(constraints, "notNullable") && constraints.notNullable) {
    validator = validator.nullable(false)
  }

  if (has(constraints, "defaultTo") && constraints.defaultTo) {
    validator = validator.default(constraints.defaultTo)
  }

  return validator
}

function applyCustomRules(validator, customRules = {}) {
  for (const rule in customRules) {
    const args = isArray(customRules[rule])
      ? customRules[rule]
      : [customRules[rule]]
    validator = validator[rule](...args)
  }
  return validator
}

function buildValidator(fields) {
  const schema = {}

  for (const field in fields) {
    const { type, constraints, validator: customRules } = fields[field]

    let validator = createBaseValidator(type)
    validator = applyConstraints(validator, constraints)
    validator = applyCustomRules(validator, customRules)

    schema[field] = validator
  }

  return schema
}

// ============================================================================
// 表结构构建函数
// ============================================================================

function applyColumnConstraints(column, constraints) {
  const buildOrder = [
    "unsigned",
    "nullable",
    "notNullable",
    "primary",
    "unique",
    "foreign",
    "references",
    "inTable",
    "onDelete",
    "onUpdate",
    "deferrable",
    "defaultTo",
    "collate",
    "comment",
  ]

  for (const constraint of buildOrder) {
    if (has(constraints, constraint) && constraints[constraint]) {
      column = applyConstraint(column, constraint, constraints[constraint])
    }
  }

  return column
}

function applyConstraint(column, constraintName, constraintValue) {
  if (isArray(constraintValue)) {
    return column[constraintName](...constraintValue)
  } else if (constraintValue === true) {
    return column[constraintName]()
  } else {
    return column[constraintName](constraintValue)
  }
}

function createColumn(table, fieldName, fieldConfig) {
  const { type, constraints = {} } = fieldConfig
  const [_type, ...args] = isArray(type) ? type : [type]

  if (!table[_type]) {
    throw new Error(`Column type '${_type}' is not supported by knex.`)
  }

  let column = table[_type](fieldName, ...args)
  column = applyColumnConstraints(column, constraints)

  return column
}

function applyTableConstraints(table, constraints) {
  if (isArray(constraints)) {
    for (const constraint of constraints) {
      table[constraint.type](...constraint.args)
    }
  } else {
    for (const constraint in constraints) {
      table[constraint](...constraints[constraint])
    }
  }
}

// ============================================================================
// 关系映射辅助函数
// ============================================================================

function belongsToOneRelation(currentModel, relatedModel, join = {}) {
  if (Array.isArray(relatedModel.idColumn)) {
    throw new Error(
      "Composite keys are not supported in belongsToOne shortcut currently",
    )
  }

  const { foreignKey, uniqueKey, ...rest } = join
  const _uniqueKey = uniqueKey || relatedModel.idColumn
  const _foreignKey = foreignKey || relatedModel.foreignKeyName

  return {
    relation: BaseModel.BelongsToOneRelation,
    modelClass: relatedModel,
    foreignKey: _foreignKey,
    uniqueKey: _uniqueKey,
    join: {
      from: `${currentModel.tableName}.${_foreignKey}`,
      to: `${relatedModel.tableName}.${_uniqueKey}`,
      ...rest,
    },
  }
}

function hasManyRelation(currentModel, relatedModel, join = {}, graphql = {}) {
  if (Array.isArray(currentModel.idColumn)) {
    throw new Error(
      "Composite keys are not supported in hasMany shortcut currently",
    )
  }

  const { foreignKey = currentModel.foreignKeyName, ...rest } = join

  return {
    relation: BaseModel.HasManyRelation,
    modelClass: relatedModel,
    foreignKey,
    join: {
      from: `${currentModel.tableName}.${currentModel.idColumn}`,
      to: `${relatedModel.tableName}.${foreignKey}`,
      ...rest,
    },
    ...graphql,
  }
}

function hasOneRelation(currentModel, relatedModel, join = {}, graphql = {}) {
  if (Array.isArray(currentModel.idColumn)) {
    throw new Error(
      "Composite keys are not supported in hasOne shortcut currently",
    )
  }

  const {
    foreignKey = currentModel.foreignKeyName,
    parentForeignKey = currentModel.idColumn,
    ...rest
  } = join

  return {
    relation: BaseModel.HasOneRelation,
    modelClass: relatedModel,
    foreignKey,
    parentForeignKey,
    ...graphql,
    join: {
      from: `${currentModel.tableName}.${parentForeignKey}`,
      to: `${relatedModel.tableName}.${foreignKey}`,
      ...rest,
    },
  }
}

function manyToManyRelation(currentModel, relatedModel, join = {}) {
  if (
    Array.isArray(currentModel.idColumn) ||
    Array.isArray(relatedModel.idColumn)
  ) {
    throw new Error(
      "Composite keys are not supported in manyToMany shortcut currently",
    )
  }

  const {
    throughTable,
    foreignKey = currentModel.foreignKeyName,
    ...rest
  } = join

  if (isEmpty(throughTable)) {
    throw new Error("throughTable must be provided for manyToMany relation")
  }

  return {
    relation: BaseModel.ManyToManyRelation,
    modelClass: relatedModel,
    foreignKey,
    join: {
      from: `${currentModel.tableName}.${currentModel.idColumn}`,
      through: {
        from: `${throughTable}.${foreignKey}`,
        to: `${throughTable}.${relatedModel.foreignKeyName}`,
      },
      to: `${relatedModel.tableName}.${relatedModel.idColumn}`,
      ...rest,
    },
  }
}

// ============================================================================
// 增强的 Model 类
// ============================================================================

export class Model extends BaseModel {
  static relations = {}
  static fields = {}
  static constraints = {}

  // 不使用 this，改为让子类覆盖
  static get foreignKeyName() {
    // 子类需要覆盖 tableName，所以这里默认返回空
    // 实际使用时，子类会有正确的 tableName
    return `${singularize(this.tableName)}Id`
  }

  static get virtualFields() {
    return {}
  }

  static get virtualAttributes() {
    return Object.keys(this.virtualFields)
  }

  static get formatter() {
    return getFieldsConfig(this.fields, "formatter")
  }

  static get parser() {
    return getFieldsConfig(this.fields, "parser")
  }

  static get validator() {
    return buildValidator(this.fields)
  }

  static connect(knexConfig) {
    const knex = Knex(knexConfig)
    Model.knex(knex)
    return knex
  }

  $formatDatabaseJson(json) {
    const formatter = this.constructor.formatter
    Object.keys(formatter).forEach((column) => {
      if (column in json) {
        json[column] = formatter[column](json[column])
      }
    })

    return super.$formatDatabaseJson(json)
  }

  $parseDatabaseJson(json) {
    const parser = this.constructor.parser
    Object.keys(parser).forEach((column) => {
      if (column in json) {
        json[column] = parser[column](json[column])
      }
    })

    return super.$parseDatabaseJson(json)
  }

  async $beforeInsert(queryContext) {
    await super.$beforeInsert(queryContext)

    const timestamps = getFieldsConfig(this.constructor.fields, "timestamp")
    const now = new Date()

    for (const field in timestamps) {
      if (timestamps[field] === "insert") {
        this[field] = this[field] || now
      }
    }
  }

  async $beforeUpdate(opt, queryContext) {
    await super.$beforeUpdate(opt, queryContext)

    const timestamps = getFieldsConfig(this.constructor.fields, "timestamp")
    const now = new Date()

    for (const field in timestamps) {
      if (timestamps[field] === "update") {
        this[field] = this[field] || now
      }
    }
  }

  static get relationMappings() {
    return this.relations
  }

  static findRelation(child, types) {
    types = Array.isArray(types) ? types : [types]

    const result = toPairs(this.relations).find(
      ([, relationInfo]) =>
        relationInfo.modelClass === child &&
        types.includes(relationInfo.relation),
    )

    if (!result) {
      throw new Error(`Relation ${child} can not be found`)
    }

    const [name, info] = result
    return { name, info }
  }

  static async upsert(where, data) {
    return await this.query().upsertGraph(
      { ...where, ...data },
      { insertMissing: true },
    )
  }

  static createValidator() {
    return new Validator(this.validator)
  }

  // 关系定义快捷方法
  static belongsTo(modelClass, join = {}) {
    return belongsToOneRelation(this, modelClass, join)
  }

  static belongsToOne(modelClass, join = {}) {
    return belongsToOneRelation(this, modelClass, join)
  }

  static hasMany(modelClass, join = {}, graphql = {}) {
    return hasManyRelation(this, modelClass, join, graphql)
  }

  static hasOne(modelClass, join = {}, graphql = {}) {
    return hasOneRelation(this, modelClass, join, graphql)
  }

  static manyToMany(modelClass, join = {}) {
    return manyToManyRelation(this, modelClass, join)
  }

  static async createTable(schema = null) {
    schema = schema || this.knex().schema

    return await schema.createTable(this.tableName, (table) => {
      for (const field in this.fields) {
        createColumn(table, field, this.fields[field])
      }

      applyTableConstraints(table, this.constraints)
    })
  }
}

// ============================================================================
// 增强的 Validator 类
// ============================================================================

export class Validator extends BaseValidator {
  constructor(schema) {
    super(schema)
    this.schema = schema
  }

  validate({ _model, json, options = {}, _ctx }) {
    if (!this.schema) return json

    const schemaToValidate = options.patch
      ? pick(this.schema, Object.keys(json))
      : this.schema

    const validator = yup.object().shape(schemaToValidate)

    json = validator.validateSync(json, { abortEarly: false })

    return json
  }
}

// ============================================================================
// 数据库迁移工具
// ============================================================================

export async function knexMigration(models, options = {}) {
  const { drop = false, knex = Model.knex() } = options

  for (const model of models) {
    if (drop) {
      await knex.schema.dropTableIfExists(model.tableName)
    } else {
      await model.createTable(knex.schema)
    }
  }
}
