import { singularize } from "inflected"
import { Loader } from "../loader.mjs"

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 根据表名生成外键名
 * @param {string} tableName - 表名(复数形式)
 * @returns {string} 外键名(单数形式 + Id)
 * @example generateForeignKey('users') => 'userId'
 */
function generateForeignKey(tableName) {
  return `${singularize(tableName)}Id`
}

/**
 * 根据表名生成映射键名
 * @param {string} tableName - 表名(复数形式)
 * @returns {string} 映射键名(单数形式)
 * @example generateMappingKey('users') => 'user'
 */
function generateMappingKey(tableName) {
  return singularize(tableName)
}

/**
 * 验证 Loader 实例
 * @param {Loader} loader - 加载器实例
 * @throws {Error} 如果不是有效的 Loader 实例
 */
function validateLoader(loader) {
  if (!(loader instanceof Loader)) {
    throw new Error("Can not get loader")
  }
}

/**
 * 验证父模型
 * @param {Object} root - 根对象
 * @throws {Error} 如果没有有效的构造函数
 */
function validateParentModel(root) {
  if (!root.constructor) {
    throw new Error("Batch fetch preset only works within a parent model")
  }
}

// ============================================================================
// 数据组装器
// ============================================================================

/**
 * 组装一对多关系数据
 * @param {Array} children - 子记录数组
 * @param {Array} parents - 父记录数组
 * @param {Object} config - 组装配置
 * @returns {Array<Array>} 每个父记录对应的子记录数组
 */
function assembleOneToMany(children, parents, config) {
  const { attrName, parentForeignKey, mappingKey, asserter } = config

  return parents.map((parent) => {
    return children.filter((child) => {
      const isMatch =
        child[attrName] === parent[parentForeignKey] && asserter(child, parent)

      if (isMatch) {
        // 设置反向引用
        child[mappingKey] = child
        return true
      }
      return false
    })
  })
}

/**
 * 组装一对一关系数据
 * @param {Array} children - 子记录数组
 * @param {Array} parents - 父记录数组
 * @param {Object} config - 组装配置
 * @returns {Array} 每个父记录对应的子记录(可能为 undefined)
 */
function assembleOneToOne(children, parents, config) {
  const { attrName, parentForeignKey, asserter } = config

  return parents.map((parent) => {
    return children.find((child) => {
      return (
        child[attrName] === parent[parentForeignKey] && asserter(child, parent)
      )
    })
  })
}

/**
 * 组装多对多关系数据
 * @param {Array} children - 子记录数组(包含 _pivot_foreign_key)
 * @param {Array} parents - 父记录数组
 * @param {string} parentIdColumn - 父记录的主键列名
 * @returns {Array<Array>} 每个父记录对应的子记录数组
 */
function assembleManyToMany(children, parents, parentIdColumn) {
  return parents.map((parent) => {
    return children.filter((child) => {
      return child._pivot_foreign_key === parent[parentIdColumn]
    })
  })
}

/**
 * 组装 BelongsTo 关系数据
 * @param {Array} items - 关联记录数组
 * @param {Array} parents - 父记录数组
 * @param {Object} config - 组装配置
 * @returns {Array} 每个父记录对应的关联记录
 */
function assembleBelongsTo(items, parents, config) {
  const { foreignKey, uniqueKey, itemIdColumn } = config

  return parents.map((parent) => {
    return items.find((item) => {
      const itemKey = itemIdColumn || uniqueKey
      return item[itemKey] === parent[foreignKey]
    })
  })
}

// ============================================================================
// 查询构建器
// ============================================================================

/**
 * 构建 HasMany/HasOne 查询
 * @param {Object} config - 查询配置
 * @returns {Promise<Array>} 查询结果
 */
async function buildHasManyQuery(config) {
  const {
    model,
    foreignKey,
    parents,
    parentForeignKey,
    modify,
    where,
    query,
    context,
  } = config

  const baseQuery = model.query().where((builder) => {
    builder.whereIn(
      foreignKey,
      parents.map((parent) => parent[parentForeignKey]),
    )

    if (modify) {
      builder.where(modify)
    }

    return where(builder, context)
  })

  return await query(baseQuery)
}

/**
 * 构建 ManyToMany 查询
 * @param {Object} config - 查询配置
 * @returns {Promise<Array>} 查询结果
 */
async function buildManyToManyQuery(config) {
  const { relation, parents, parentIdColumn } = config

  const query = relation.modelClass.query()

  query.select(
    `${relation.modelClass.tableName}.*`,
    `${relation.join.through.from} as _pivot_foreign_key`,
  )

  const throughTable = relation.join.through.from.split(".")[0]
  query.join(
    throughTable,
    `${relation.modelClass.tableName}.${relation.modelClass.idColumn}`,
    relation.join.through.to,
  )

  query.whereIn(
    relation.join.through.from,
    parents.map((parent) => parent[parentIdColumn]),
  )

  return await query
}

/**
 * 构建 BelongsTo 查询
 * @param {Object} config - 查询配置
 * @returns {Promise<Array>} 查询结果
 */
async function buildBelongsToQuery(config) {
  const { model, uniqueKey, parents, foreignKey } = config

  return await model.query().whereIn(
    uniqueKey,
    parents.map((parent) => parent[foreignKey]),
  )
}

// ============================================================================
// 批量加载器
// ============================================================================

/**
 * 通用批量加载方法
 * @param {Object} options - 加载选项
 * @returns {Function} GraphQL resolver 函数
 */
function load(options) {
  return async (root, _args, ctx, _info) => {
    const { getLoader = (ctx) => ctx.loader, name, assemble, fetch } = options

    const loader = getLoader(ctx)
    validateLoader(loader)

    const data = await loader
      .acquire(name, (parents) =>
        fetch(parents).then((items) => assemble(items, parents)),
      )
      .load(root)

    return data
  }
}

/**
 * 解析 fetch 配置
 * @private
 */
function resolveFetchConfig(root, options) {
  const parent = options.parent || root.constructor
  const parentForeignKey = options.parentForeignKey || "id"
  const foreignKey =
    options.foreignKey || generateForeignKey(root.constructor.tableName)
  const mappingKey =
    options.mappingKey || generateMappingKey(root.constructor.tableName)

  const defaultAsserter = (child, parent) => {
    return child != null && parent != null
  }

  return {
    parent,
    parentForeignKey,
    foreignKey,
    mappingKey,
    attrName: options.attrName || foreignKey,
    where: options.where || ((q) => q),
    query: options.query || ((q) => q),
    list: options.list !== undefined ? options.list : true,
    assembleAsserter: options.assembleAsserter || defaultAsserter,
    model: options.model,
    modify: options.modify,
  }
}

/**
 * 通用获取方法(HasMany/HasOne)
 * @param {Object} options - 获取选项
 * @returns {Function} GraphQL resolver 函数
 */
function fetch(options = {}) {
  return async (root, args, ctx, info) => {
    validateParentModel(root)

    const config = resolveFetchConfig(root, options)

    return await load({
      name: `${config.parent.name}-${config.model.name}`,

      async fetch(parents) {
        return await buildHasManyQuery({
          model: config.model,
          foreignKey: config.foreignKey,
          parents,
          parentForeignKey: config.parentForeignKey,
          modify: config.modify,
          where: config.where,
          query: config.query,
          context: { root, args, ctx, info },
        })
      },

      assemble(children, parents) {
        const assembleConfig = {
          attrName: config.attrName,
          parentForeignKey: config.parentForeignKey,
          mappingKey: config.mappingKey,
          asserter: config.assembleAsserter,
        }

        return config.list
          ? assembleOneToMany(children, parents, assembleConfig)
          : assembleOneToOne(children, parents, assembleConfig)
      },
    })(root, args, ctx, info)
  }
}

// ============================================================================
// 关系加载器
// ============================================================================

/**
 * HasMany 关系加载(一对多)
 * @param {Model} model - 子模型类
 * @param {Object} options - 加载选项
 * @returns {Function} GraphQL resolver 函数
 */
function hasMany(model, options = {}) {
  return fetch({
    list: true,
    model,
    ...options,
  })
}

/**
 * HasOne 关系加载(一对一)
 * @param {Model} model - 子模型类
 * @param {Object} options - 加载选项
 * @returns {Function} GraphQL resolver 函数
 */
function hasOne(model, options = {}) {
  return fetch({
    model,
    list: false,
    ...options,
  })
}

/**
 * 解析 BelongsTo 配置
 * @private
 */
function resolveBelongsToConfig(root, model, options) {
  const parent = options.parent || root.constructor
  const foreignKey = options.foreignKey || generateForeignKey(model.tableName)
  const uniqueKey = options.uniqueKey || model.idColumn

  return {
    parent,
    foreignKey,
    uniqueKey,
  }
}

/**
 * BelongsTo 关系加载(多对一)
 * @param {Model} model - 关联模型类
 * @param {Object} options - 加载选项
 * @returns {Function} GraphQL resolver 函数
 */
function belongsTo(model, options = {}) {
  return async (root, args, ctx, info) => {
    validateParentModel(root)

    const config = resolveBelongsToConfig(root, model, options)

    return await load({
      name: `${config.parent.name}-${model.name}`,

      async fetch(parents) {
        return await buildBelongsToQuery({
          model,
          uniqueKey: config.uniqueKey,
          parents,
          foreignKey: config.foreignKey,
        })
      },

      assemble(items, parents) {
        return assembleBelongsTo(items, parents, {
          foreignKey: config.foreignKey,
          uniqueKey: config.uniqueKey,
          itemIdColumn: model.idColumn,
        })
      },
    })(root, args, ctx, info)
  }
}

/**
 * BelongsToMany 关系加载(多对多)
 * @param {Object} options - 加载选项
 * @returns {Function} GraphQL resolver 函数
 */
function belongsToMany(options) {
  return async (root, args, ctx, info) => {
    validateParentModel(root)

    const selfModel = root.constructor
    const relationName = options.relation

    if (!selfModel.relations) {
      throw new Error(
        `Model '${selfModel.name}' does not have relations defined`,
      )
    }

    const relation = selfModel.relations[relationName]

    if (!relation) {
      throw new Error(
        `Relation '${relationName}' not found in ${selfModel.name}.relations`,
      )
    }

    return await load({
      name: `${selfModel.name}-${relation.modelClass.name}-many-to-many`,

      async fetch(parents) {
        return await buildManyToManyQuery({
          relation,
          parents,
          parentIdColumn: selfModel.idColumn,
        })
      },

      assemble(children, parents) {
        return assembleManyToMany(children, parents, selfModel.idColumn)
      },
    })(root, args, ctx, info)
  }
}

// ============================================================================
// 导出的批量操作 API
// ============================================================================

/**
 * 批量操作工具对象
 *
 * 提供了一组用于 GraphQL 的批量数据加载方法,
 * 解决 N+1 查询问题,提升查询性能。
 */
export const batch = {
  load,
  fetch,
  hasMany,
  hasOne,
  belongsTo,
  belongsToMany,
}
