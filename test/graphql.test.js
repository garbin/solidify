import { faker } from "@faker-js/faker"
import test from "ava"
import { createMercuriusTestClient } from "mercurius-integration-testing"
import { graphql, knexMigration, Model, WebServer } from "../index.mjs"

class Profile extends Model {
  static tableName = "profiles"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    bio: { type: "text" },
    userId: { type: "integer" },
  }
}

class User extends Model {
  static tableName = "users"
  static fields = {
    id: {
      type: "increments",
      constraints: {
        primary: true,
      },
    },
    name: {
      type: "string",
      validator: {
        required: true,
      },
    },
    createdAt: {
      type: "timestamp",
      timestamp: "insert",
    },
  }
  static get relations() {
    return {
      posts: User.hasMany(Post),
      profile: User.hasOne(Profile),
    }
  }
}

class Post extends Model {
  static tableName = "posts"
  static fields = {
    id: {
      type: "increments",
      constraints: {
        primary: true,
      },
    },
    content: {
      type: "text",
    },
    userId: {
      type: "integer",
    },
    createdAt: {
      type: "timestamp",
      timestamp: "insert",
    },
  }
  static get relations() {
    return {
      user: Post.belongsTo(User),
      tags: Post.manyToMany(Tag, {
        throughTable: "post2tag",
        relation: "posts",
      }),
    }
  }
}

class Tag extends Model {
  static tableName = "tags"
  static fields = {
    id: {
      type: "increments",
      constraints: {
        primary: true,
      },
    },
    tag: {
      type: "string",
    },
    createdAt: {
      type: "timestamp",
      timestamp: "insert",
    },
  }
  static get relations() {
    return {
      posts: Tag.manyToMany(Post, { throughTable: "post2tag" }),
    }
  }
}

class ModifyTestModel extends Model {
  static tableName = "modify_test_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
    status: { type: "string" },
  }
}

class WhereTestModel extends Model {
  static tableName = "where_test_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
    category: { type: "string" },
  }
}

class QueryTestModel extends Model {
  static tableName = "query_test_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
    value: { type: "integer" },
  }
}

class SortTestModel extends Model {
  static tableName = "sort_test_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
    value: { type: "integer" },
  }
}

class LimitTestModel extends Model {
  static tableName = "limit_test_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
    createdAt: {
      type: "timestamp",
      timestamp: "insert",
    },
  }
}

class CursorTestModel extends Model {
  static tableName = "cursor_test_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
  }
}

class ParentModelForAsserter extends Model {
  static tableName = "parent_model_for_asserter"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
  }
}

class ChildModelForAsserter extends Model {
  static tableName = "child_model_for_asserter"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
    parentId: { type: "integer" },
    type: { type: "string" },
  }
}

class VirtualFieldTestModel extends Model {
  static tableName = "virtual_field_test_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    firstName: { type: "string" },
    lastName: { type: "string" },
  }

  static virtualFields = {
    fullName: "string",
    age: "integer",
    isActive: "boolean",
  }
}

class AllTypesModel extends Model {
  static tableName = "all_types_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    stringField: { type: "string" },
    enumField: { type: ["enum", ["VALUE1", "VALUE2"]] },
    intField: { type: "integer" },
    bigIntField: { type: "bigInteger" },
    textField: { type: "text" },
    floatField: { type: "float" },
    decimalField: { type: "decimal" },
    booleanField: { type: "boolean" },
    dateField: { type: "date" },
    datetimeField: { type: "datetime" },
    timeField: { type: "time" },
    timestampField: { type: "timestamp" },
    jsonField: { type: "json" },
    jsonbField: { type: "jsonb" },
    uuidField: { type: "uuid" },
  }
}

class TestMutationModel extends Model {
  static tableName = "test_mutation_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
  }
}

class FilterTestModel extends Model {
  static tableName = "filter_test_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
    value: { type: "integer" },
    createdAt: {
      type: "timestamp",
      timestamp: "insert",
    },
  }
}

class TestModel extends Model {
  static tableName = "test_models"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    name: { type: "string" },
    createdAt: {
      type: "timestamp",
      timestamp: "insert",
    },
  }
}

class SimpleModel extends Model {
  static tableName = "simple_models"
  static fields = {
    requiredField: { type: "string", constraints: { notNullable: true } },
    optionalField: { type: "string" },
  }
}

test.before(async (_t) => {
  Model.connect({
    client: "sqlite3",
    connection: ":memory:",
    useNullAsDefault: true,
  })

  // Explicitly drop all tables
  const allModels = [
    User,
    Post,
    Profile,
    Tag,
    ModifyTestModel,
    WhereTestModel,
    QueryTestModel,
    SortTestModel,
    LimitTestModel,
    CursorTestModel,
    ParentModelForAsserter,
    ChildModelForAsserter,
    VirtualFieldTestModel,
    AllTypesModel,
    TestMutationModel,
    FilterTestModel,
    TestModel,
  ]

  await knexMigration(allModels, { drop: true })
  await knexMigration(allModels)

  await Model.knex().schema.dropTableIfExists("post2tag")
  // Recreate post2tag table
  await Model.knex().schema.createTable("post2tag", (table) => {
    table.increments("id").primary()
    table.integer("postId")
    table.integer("tagId")
  })
})

test.after(async (_t) => {
  await Model.knex().destroy()
})

test("GraphQL Basic Usage", async (t) => {
  const app = new WebServer()
  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            hello: {
              type: graphql.type("String"),
              args: {
                id: { type: graphql.type("NonNull", graphql.type("ID")) },
              },
              resolve: async (_root, args, _ctx, _info) => {
                const { id } = args
                return `Hello ${id}`
              },
            },
          },
        }),
        mutation: graphql.type("ObjectType", {
          name: "Mutation",
          fields: {
            save: {
              type: graphql.type("JSON"),
              args: { input: { type: graphql.type("JSON") } },
              resolve: async (_root, args, _ctx, _info) => {
                return args.input
              },
            },
          },
        }),
      }),
    }),
  )
  await app.ready()
  const client = createMercuriusTestClient(app)
  const query = await client.query(
    `
      query hello($id: ID!) {
        hello(id: $id)
      }
    `,
    { variables: { id: "Garbin" } },
  )
  t.is(query.data.hello, "Hello Garbin")
  const input = { foo: "bar" }
  const mutation = await client.query(
    `
      mutation save($input: JSON) {
        save(input: $input)
      }
    `,
    { variables: { input } },
  )
  t.deepEqual(mutation.data.save, input)
})

test("GraphQL Presets", async (t) => {
  const app = new WebServer()

  // Test model caching
  const userType = graphql.model(User)
  const userTypeCached = graphql.model(User)
  t.is(userType, userTypeCached)

  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            fetch: graphql.presets.fetch({
              USER: { model: User },
              POST: { model: Post },
            }),
            search: graphql.presets.search({
              USER: { model: User },
              POST: { model: Post },
            }),
          },
        }),
        mutation: graphql.type("ObjectType", {
          name: "Mutation",
          fields: {
            ...graphql.presets.mutation(User).create().update().destroy()
              .mutations,
            ...graphql.presets.mutation(Post).create().update().destroy()
              .mutations,
          },
        }),
      }),
    }),
  )
  await app.ready()
  const client = createMercuriusTestClient(app)
  const userInput = { name: faker.person.fullName() }
  const createUser = await client.query(
    `
      mutation createUser($input: JSON!) {
        user: createUser(input: $input) {
          id
          name
        }
      }
    `,
    { variables: { input: userInput } },
  )
  t.is(createUser.data.user.name, userInput.name)

  // Seed and test HasOne
  await Profile.query().insert({
    bio: "Test bio",
    userId: createUser.data.user.id,
  })

  const postInput = {
    content: faker.lorem.text(),
    userId: createUser.data.user.id,
  }
  const createPost = await client.query(
    `
        mutation createPost($input: JSON!) {
          post: createPost(input: $input) {
            id
            content
            userId
          }
        }
      `,
    { variables: { input: postInput } },
  )
  t.is(createPost.data.post.content, postInput.content)
  t.is(createPost.data.post.userId, Number(createUser.data.user.id))

  // Seed and test ManyToMany
  const tag = await Tag.query().insert({ tag: "test-tag" })
  await Model.knex()("post2tag").insert({
    postId: createPost.data.post.id,
    tagId: tag.id,
  })

  const fetchUserWithRelations = await client.query(
    `
      query fetch($type: FetchType!, $id: ID!) {
        user: fetch(type: $type, id: $id) {
          ... on User {
            id
            name
            profile { bio }
            posts {
              id
              content
              tags { tag }
            }
          }
        }
      }
    `,
    {
      variables: {
        type: "USER",
        id: createUser.data.user.id,
      },
    },
  )

  const fetchedUser = fetchUserWithRelations.data.user
  t.is(fetchedUser.id, String(createUser.data.user.id))
  t.is(fetchedUser.profile.bio, "Test bio")
  t.is(fetchedUser.posts[0].tags[0].tag, "test-tag")

  // Test BelongsTo separately
  const fetchPostWithUser = await client.query(
    `
    query fetch($type: FetchType!, $id: ID!) {
      post: fetch(type: $type, id: $id) {
        ... on Post {
          id
          user { name }
        }
      }
    }
  `,
    {
      variables: {
        type: "POST",
        id: createPost.data.post.id,
      },
    },
  )
  t.is(fetchPostWithUser.data.post.user.name, fetchedUser.name)
})

test("GraphQL Plugin Error Handling", async (t) => {
  const app = new WebServer()
  let fatalCalled = false
  let errorHandlerCalled = false
  let caughtError = null

  const originalFatal = app.log.fatal
  app.log.fatal = (e) => {
    fatalCalled = true
    caughtError = e
    originalFatal(e)
  }

  app.setErrorHandler((error, _request, reply) => {
    errorHandlerCalled = true
    caughtError = error
    reply.send(error)
  })

  const invalidTypeDefs = `
    type Query {
      invalid: String
    }
    type InvalidType { # Missing fields, will cause error
  `

  app.register(
    graphql.plugin({
      typeDefs: invalidTypeDefs,
      resolvers: {},
    }),
  )

  try {
    await app.ready()
  } catch {
    // app.ready() might throw if the plugin fails to load, but the error handler should still be called internally.
  }

  t.true(fatalCalled, "app.log.fatal should have been called")
  t.true(errorHandlerCalled, "app.errorHandler should have been called")
  t.true(
    caughtError instanceof Error,
    "A caught error should be an instance of Error",
  )
})

test("GraphQL Type - model not instanceof Model error", (t) => {
  class MyClass {}

  const error = t.throws(
    () => {
      graphql.model(MyClass)
    },
    { instanceOf: Error },
  )

  t.is(error.message, "model is not instanceof Model")
})

test("GraphQL Type - NonNull type based on notNullable constraint (simplified)", (t) => {
  const simpleModelType = graphql.model(SimpleModel)

  const requiredField = simpleModelType.getFields().requiredField
  t.is(
    requiredField.type.constructor.name,
    "GraphQLNonNull",
    "Required field should be NonNull",
  )
  t.is(
    requiredField.type.ofType.name,
    "String",
    "Required field should be GraphQLString",
  )

  const optionalField = simpleModelType.getFields().optionalField
  t.is(
    optionalField.type.name,
    "String",
    "Optional field should be GraphQLString",
  )
})

test("GraphQL Presets - Mutation: update/destroy non-existent item", async (t) => {
  const app = new WebServer()

  await knexMigration([TestMutationModel], { drop: true })
  await knexMigration([TestMutationModel])

  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          // Add a minimal Query type
          name: "Query",
          fields: {
            _empty: { type: graphql.type("String"), resolve: () => "empty" },
          },
        }),
        mutation: graphql.type("ObjectType", {
          name: "Mutation",
          fields: {
            ...graphql.presets
              .mutation(TestMutationModel)
              .create()
              .update()
              .destroy().mutations,
          },
        }),
      }),
    }),
  )
  await app.ready()
  const client = createMercuriusTestClient(app)

  const updateNonExistent = await client.query(
    `
      mutation updateTestMutationModel($input: JSON!) {
        updateTestMutationModel(input: $input) {
          id
        }
      }
    `,
    { variables: { input: { id: 999, patch: { name: "updated" } } } },
  )
  t.true(
    updateNonExistent.errors.length > 0,
    "Should return errors for non-existent update",
  )
  t.true(
    updateNonExistent.errors[0].message.includes("NotFound"),
    "Error message should indicate NotFound",
  )

  const destroyNonExistent = await client.query(
    `
      mutation destroyTestMutationModel($input: JSON!) {
        destroyTestMutationModel(input: $input) {
          id
        }
      }
    `,
    { variables: { input: { id: 999 } } },
  )
  t.true(
    destroyNonExistent.errors.length > 0,
    "Should return errors for non-existent destroy",
  )
  t.true(
    destroyNonExistent.errors[0].message.includes("NotFound"),
    "Error message should indicate NotFound",
  )

  // Test successful update
  const itemToUpdate = await TestMutationModel.query().insertAndFetch({
    name: "original",
  })
  await TestMutationModel.query().findById(itemToUpdate.id)
  const updatedName = "updated-name"
  const updateResult = await client.query(
    `
      mutation updateTestMutationModel($input: JSON!) {
        updateTestMutationModel(input: $input) {
          id
          name
        }
      }
    `,
    {
      variables: {
        input: { id: itemToUpdate.id, patch: { name: updatedName } },
      },
    },
  )
  t.truthy(
    updateResult.data.updateTestMutationModel,
    "Update mutation should return a non-null object",
  )
  t.is(
    updateResult.data.updateTestMutationModel.name,
    updatedName,
    "Should successfully update item",
  )
  const fetchedUpdatedItem = await TestMutationModel.query().findById(
    itemToUpdate.id,
  )
  t.is(
    fetchedUpdatedItem.name,
    updatedName,
    "Item should be updated in database",
  )

  // Test successful destroy
  const itemToDestroy = await TestMutationModel.query().insertAndFetch({
    name: "to-destroy",
  })
  const destroyResult = await client.query(
    `
      mutation destroyTestMutationModel($input: JSON!) {
        destroyTestMutationModel(input: $input) {
          id
          name
        }
      }
    `,
    { variables: { input: { id: itemToDestroy.id } } },
  )
  t.is(
    destroyResult.data.destroyTestMutationModel.id,
    String(itemToDestroy.id),
    "Should successfully destroy item and return it",
  )
  const destroyedItem = await TestMutationModel.query().findById(
    itemToDestroy.id,
  )
  t.is(destroyedItem, undefined, "Item should be deleted from database")
})

test("GraphQL Presets - Batch: hasOne/belongsTo with multiple results (edge case)", async (t) => {
  const app = new WebServer()

  const user = await User.query().insert({ name: faker.person.fullName() })

  await Profile.query().insert({ bio: "Test bio", userId: user.id })
  await Profile.query().insert({ bio: "Profile 2", userId: user.id })

  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            fetch: graphql.presets.fetch({ USER: { model: User } }),
          },
        }),
      }),
    }),
  )
  await app.ready()
  const client = createMercuriusTestClient(app)

  const query = `
    query fetchUser($id: ID!) {
      user: fetch(type: USER, id: $id) {
        ... on User {
          id
          profile { bio }
        }
      }
    }
  `

  const result = await client.query(query, { variables: { id: user.id } })

  t.is(
    result.data.user.profile.bio,
    "Test bio",
    "Only the first profile should be returned for hasOne",
  )
})

test("GraphQL Presets - Search: filtering coverage", async (t) => {
  const app = new WebServer()

  await FilterTestModel.query().insert({ name: "item1", value: 10 })
  await FilterTestModel.query().insert({ name: "item2", value: 20 })
  await FilterTestModel.query().insert({ name: "item3", value: 30 })

  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            searchByStrings: graphql.presets.search(
              {
                FILTER_TEST: {
                  model: FilterTestModel,
                  resolverOptions: {
                    filterable: ["name", "value"],
                  },
                },
              },
              { name: "Strings" },
            ),
            searchByFunctions: graphql.presets.search(
              {
                FUNCTION_FILTER_TEST: {
                  model: FilterTestModel,
                  resolverOptions: {
                    filterable: [
                      ({ filterBy, query: builder }) => {
                        if (filterBy.customName) {
                          builder.where("name", filterBy.customName)
                        }
                      },
                      ({ filterBy, query: builder }) => {
                        if (filterBy.customValue) {
                          builder.where("value", ">", filterBy.customValue)
                        }
                      },
                    ],
                  },
                },
              },
              { name: "Functions" },
            ),
          },
        }),
      }),
    }),
  )
  await app.ready()
  const client = createMercuriusTestClient(app)

  const searchByName = await client.query(
    `query { searchByStrings(type: FILTER_TEST, filterBy: {name: "item1"}) { edges { node { ...on FilterTestModel { name } } } } }`,
  )
  t.is(
    searchByName.data.searchByStrings.edges[0].node.name,
    "item1",
    "Should filter by name string",
  )

  const searchByValue = await client.query(
    `query { searchByStrings(type: FILTER_TEST, filterBy: {value: 20}) { edges { node { ...on FilterTestModel { value } } } } }`,
  )
  t.is(
    searchByValue.data.searchByStrings.edges[0].node.value,
    20,
    "Should filter by value string",
  )

  const searchByCustomName = await client.query(
    `query { searchByFunctions(type: FUNCTION_FILTER_TEST, filterBy: {customName: "item2"}) { edges { node { ...on FilterTestModel { name } } } } }`,
  )
  t.is(
    searchByCustomName.data.searchByFunctions.edges[0].node.name,
    "item2",
    "Should filter by customName function",
  )

  const searchByCustomValue = await client.query(
    `query { searchByFunctions(type: FUNCTION_FILTER_TEST, filterBy: {customValue: 25}) { edges { node { ...on FilterTestModel { value } } } } }`,
  )
  t.is(
    searchByCustomValue.data.searchByFunctions.edges[0].node.value,
    30,
    "Should filter by customValue function",
  )
})

test("GraphQL Presets Coverage", async (t) => {
  const app = new WebServer({ logger: false })

  await TestModel.query().insert({ name: "test-item" })

  let composedFetch = false
  let composedDestroy = false

  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            fetch: graphql.presets.fetch({
              TEST: {
                model: TestModel,
                compose: (resolve) => (root, args, ctx, info) => {
                  composedFetch = true
                  return resolve(root, args, ctx, info)
                },
              },
            }),
            search: graphql.presets.search({
              TEST: {
                model: TestModel,
                resolverOptions: {
                  filterable: ({ query, filterBy }) => {
                    if (filterBy.name) {
                      query.where("name", "like", `%${filterBy.name}%`)
                    }
                  },
                },
              },
            }),
          },
        }),
        mutation: graphql.type("ObjectType", {
          name: "Mutation",
          fields: {
            ...graphql.presets.mutation(TestModel).destroy({
              mutationName: "customDestroyTestModel",
              compose: (resolve) => (root, args, ctx, info) => {
                composedDestroy = true
                return resolve(root, args, ctx, info)
              },
              resolve: async (_root, { input }) => {
                const item = await TestModel.query()
                  .findById(input.id)
                  .throwIfNotFound()
                await item.$query().delete()
                item.name = `deleted: ${item.name}`
                return item
              },
            }).mutations,
          },
        }),
      }),
    }),
  )
  await app.ready()

  const client = createMercuriusTestClient(app)
  const item = await TestModel.query().insertAndFetch({ name: "test-item" })

  // Test fetch compose
  await client.query(
    `query { fetch(type: TEST, id: ${item.id}) { ...on TestModel { id } } }`,
  )
  t.true(composedFetch)

  // Test search functional filter
  const searchResult = await client.query(
    `query { search(type: TEST, filterBy: {name: "item"}) { edges { node { ...on TestModel { name } } } } }`,
  )
  t.is(searchResult.data.search.edges[0].node.name, "test-item")

  // Test destroy compose and custom resolve
  const destroyResult = await client.query(
    `mutation { customDestroyTestModel(input: {id: ${item.id}}) { name } }`,
  )
  t.true(composedDestroy)
  t.is(destroyResult.data.customDestroyTestModel.name, `deleted: ${item.name}`)
})

test("GraphQL Loader - acquire returns same instance", (t) => {
  const loader = new graphql.Loader()
  const batchFn = async (keys) => keys
  const loader1 = loader.acquire("testLoader", batchFn)
  const loader2 = loader.acquire("testLoader", batchFn)
  const loader3 = loader.acquire("anotherLoader", batchFn)

  t.is(
    loader1,
    loader2,
    "acquire should return the same instance for the same name",
  )
  t.not(
    loader1,
    loader3,
    "acquire should return a different instance for a different name",
  )
})

test("GraphQL Presets - Batch: getLoader error handling", async (t) => {
  const app = new WebServer()

  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: {} }), // Provide an invalid loader
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            testField: {
              type: graphql.type("String"),
              resolve: graphql.presets.batch.load({
                name: "test",
                fetch: async () => [],
                assemble: (items, _parents) => items,
                getLoader: (ctx) => ctx.loader, // Use the invalid loader
              }),
            },
          },
        }),
      }),
    }),
  )
  await app.ready()
  const client = createMercuriusTestClient(app)

  const result = await client.query(`query { testField }`)

  t.true(result.errors.length > 0, "Should return errors")
  t.true(
    result.errors[0].message.includes("Can not get loader"),
    "Error message should indicate 'Can not get loader'",
  )
})

test("GraphQL Presets - Batch: belongsToMany assemble with no related items", async (t) => {
  const app = new WebServer()

  const user = await User.query().insert({ name: faker.person.fullName() })
  const post = await Post.query().insert({
    content: "Post with no tags",
    userId: user.id,
  })

  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            posts: {
              type: graphql.type("List", graphql.model(Post)),
              resolve: async () => Post.query(),
            },
          },
        }),
        mutation: graphql.type("ObjectType", {
          name: "Mutation",
          fields: {
            _empty: { type: graphql.type("String"), resolve: () => "empty" },
          },
        }),
      }),
    }),
  )
  await app.ready()

  const client = createMercuriusTestClient(app)

  const query = `query { posts { id content tags { tag } } }`
  const result = await client.query(query)

  const fetchedPost = result.data.posts.find((p) => p.id === String(post.id))
  t.deepEqual(
    fetchedPost.tags,
    [],
    "Post with no tags should return an empty array for tags",
  )
})

test("GraphQL Presets - Batch: belongsToMany assemble with multiple related items", async (t) => {
  const app = new WebServer()

  const user = await User.query().insert({ name: faker.person.fullName() })
  const post = await Post.query().insert({
    content: "Post with multiple tags",
    userId: user.id,
  })
  const tag1 = await Tag.query().insert({ tag: "tag1" })
  const tag2 = await Tag.query().insert({ tag: "tag2" })

  await Model.knex()("post2tag").insert({ postId: post.id, tagId: tag1.id })
  await Model.knex()("post2tag").insert({ postId: post.id, tagId: tag2.id })

  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            posts: {
              type: graphql.type("List", graphql.model(Post)),
              resolve: async () => Post.query(),
            },
          },
        }),
        mutation: graphql.type("ObjectType", {
          name: "Mutation",
          fields: {
            _empty: { type: graphql.type("String"), resolve: () => "empty" },
          },
        }),
      }),
    }),
  )
  await app.ready()

  const client = createMercuriusTestClient(app)

  const query = `query { posts { id content tags { tag } } }`
  const result = await client.query(query)

  const fetchedPost = result.data.posts.find((p) => p.id === String(post.id))
  t.is(fetchedPost.tags.length, 2, "Post should have 2 tags")
  t.true(
    fetchedPost.tags.some((t) => t.tag === "tag1"),
    "Should contain tag1",
  )
  t.true(
    fetchedPost.tags.some((t) => t.tag === "tag2"),
    "Should contain tag2",
  )
})

test("GraphQL Presets - Search: limit option", async (t) => {
  const app = new WebServer()

  for (let i = 0; i < 5; i++) {
    await LimitTestModel.query().insert({ name: `item${i}` })
  }

  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            searchLimited: graphql.presets.search({
              LIMIT_TEST: {
                model: LimitTestModel,
                resolverOptions: {
                  limit: 2, // Set a custom limit
                },
              },
            }),
          },
        }),
      }),
    }),
  )
  await app.ready() // Ensure plugin is ready
  const client = createMercuriusTestClient(app)

  const result = await client.query(
    `query { searchLimited(type: LIMIT_TEST) { edges { node { ...on LimitTestModel { name } } } } }`,
  )
  t.is(
    result.data.searchLimited.edges.length,
    2,
    "Should return items up to the specified limit",
  )
})

test("GraphQL Type - virtualFields type inference", (t) => {
  const virtualFieldModelType = graphql.model(VirtualFieldTestModel)
  const fields = virtualFieldModelType.getFields()

  t.is(
    fields.fullName.type.name,
    "String",
    "fullName virtual field should be String type",
  )
  t.is(fields.age.type.name, "Int", "age virtual field should be Int type")
  t.is(
    fields.isActive.type.name,
    "Boolean",
    "isActive virtual field should be Boolean type",
  )
})

test("GraphQL Type - dbTypeToGraphQLMaps mappings", (t) => {
  const allTypesModelType = graphql.model(AllTypesModel)
  const fields = allTypesModelType.getFields()

  t.is(fields.stringField.type.name, "String", "stringField should be String")
  t.is(fields.enumField.type.name, "String", "enumField should be String")
  t.is(fields.intField.type.name, "Int", "intField should be Int")
  t.is(fields.bigIntField.type.name, "BigInt", "bigIntField should be BigInt")
  t.is(fields.textField.type.name, "String", "textField should be String")
  t.is(fields.floatField.type.name, "Float", "floatField should be Float")
  t.is(fields.decimalField.type.name, "Float", "decimalField should be Float")
  t.is(
    fields.booleanField.type.name,
    "Boolean",
    "booleanField should be Boolean",
  )
  t.is(fields.dateField.type.name, "Date", "dateField should be Date")
  t.is(
    fields.datetimeField.type.name,
    "DateTime",
    "datetimeField should be DateTime",
  )
  t.is(fields.timeField.type.name, "Time", "timeField should be Time")
  t.is(
    fields.timestampField.type.name,
    "Timestamp",
    "timestampField should be Timestamp",
  )
  t.is(fields.jsonField.type.name, "JSON", "jsonField should be JSON")
  t.is(fields.jsonbField.type.name, "JSON", "jsonbField should be JSON")
  t.is(fields.uuidField.type.name, "UUID", "uuidField should be UUID")
})

test("GraphQL Type - type function error handling for non-existent type", (t) => {
  const error = t.throws(
    () => {
      graphql.type("NonExistentType")
    },
    { instanceOf: Error },
  )

  t.is(
    error.message,
    "GraphQL type 'NonExistentType' does not exist",
    "Should throw error for non-existent GraphQL type",
  )
})
// 在原有测试文件中，添加/更新以下测试用例

// 更新：keyset 游标测试 - 添加数据清理和详细日志
test.serial(
  "GraphQL Presets - Search: relayResult with keyset cursor",
  async (t) => {
    const app = new WebServer()

    // 清理数据，确保测试隔离
    await CursorTestModel.query().delete()

    // 插入测试数据
    await CursorTestModel.query().insert({ id: 1, name: `item1` })
    await CursorTestModel.query().insert({ id: 2, name: `item2` })
    await CursorTestModel.query().insert({ id: 3, name: `item3` })

    app.register(
      graphql.plugin({
        context: () => ({ loader: new graphql.Loader() }),
        schema: graphql.type("Schema", {
          query: graphql.type("ObjectType", {
            name: "Query",
            fields: {
              searchKeyset: graphql.presets.search(
                {
                  CURSOR_TEST: {
                    model: CursorTestModel,
                    resolverOptions: {
                      cursorColumn: "id", // 使用 id 作为游标
                    },
                  },
                },
                { name: "Keyset" },
              ),
            },
          }),
        }),
      }),
    )

    await app.ready()
    const client = createMercuriusTestClient(app)

    const result = await client.query(
      `query {
      searchKeyset(type: CURSOR_TEST, first: 2) {
        total
        edges {
          cursor
          node {
            ...on CursorTestModel { id name }
          }
        }
        pageInfo {
          startCursor
          endCursor
          hasNextPage
        }
      }
    }`,
    )

    // 如果有错误，打印出来
    if (result.errors) {
      console.error("GraphQL Errors:", JSON.stringify(result.errors, null, 2))
      t.fail("Query returned errors")
      return
    }

    const { data } = result
    t.truthy(data.searchKeyset, "searchKeyset should not be null")
    t.is(data.searchKeyset.total, 3, "Total should be 3")

    const { edges, pageInfo } = data.searchKeyset
    t.is(edges.length, 2, "Should return 2 edges")

    // 默认按 id DESC 排序，所以第一条是 id=3
    t.is(edges[0].node.id, "3")
    t.is(edges[0].cursor, Buffer.from("3").toString("base64"))

    t.is(edges[1].node.id, "2")
    t.is(edges[1].cursor, Buffer.from("2").toString("base64"))

    t.is(pageInfo.startCursor, Buffer.from("3").toString("base64"))
    t.is(pageInfo.endCursor, Buffer.from("2").toString("base64"))
    t.true(pageInfo.hasNextPage, "Should have a next page")

    // 测试分页：使用 after 游标获取第二页
    const page2Result = await client.query(
      `query {
      searchKeyset(type: CURSOR_TEST, first: 2, after: "${edges[1].cursor}") {
        edges {
          node {
            ...on CursorTestModel { id }
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }`,
    )

    if (page2Result.errors) {
      console.error(
        "Page 2 GraphQL Errors:",
        JSON.stringify(page2Result.errors, null, 2),
      )
      t.fail("Page 2 query returned errors")
      return
    }

    t.truthy(
      page2Result.data.searchKeyset,
      "Page 2 searchKeyset should not be null",
    )
    t.is(
      page2Result.data.searchKeyset.edges.length,
      1,
      "Second page should have 1 item",
    )
    t.is(page2Result.data.searchKeyset.edges[0].node.id, "1")
    t.false(
      page2Result.data.searchKeyset.pageInfo.hasNextPage,
      "Should not have next page",
    )
  },
)

// 新增：测试 offset 模式
test.serial("GraphQL Presets - Search: offset pagination mode", async (t) => {
  const app = new WebServer()

  // 清理并插入新数据
  await LimitTestModel.query().delete()
  for (let i = 1; i <= 5; i++) {
    await LimitTestModel.query().insert({ name: `item${i}` })
  }

  app.register(
    graphql.plugin({
      context: () => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            searchOffset: graphql.presets.search(
              {
                LIMIT_TEST: {
                  model: LimitTestModel,
                  resolverOptions: {
                    useOffset: true, // 启用 offset 模式
                    limit: 2,
                  },
                },
              },
              { name: "Offset" },
            ),
          },
        }),
      }),
    }),
  )

  await app.ready()
  const client = createMercuriusTestClient(app)

  const result = await client.query(
    `query {
      searchOffset(type: LIMIT_TEST, first: 2) {
        total
        edges {
          cursor
          node {
            ...on LimitTestModel { name }
          }
        }
        pageInfo {
          startCursor
          endCursor
          hasNextPage
        }
      }
    }`,
  )

  const { data } = result
  t.is(data.searchOffset.edges.length, 2, "Should return 2 items")
  t.true(data.searchOffset.pageInfo.hasNextPage, "Should have next page")

  // 游标应该是数字偏移量（base64 编码）
  const firstCursor = Buffer.from(
    data.searchOffset.edges[0].cursor,
    "base64",
  ).toString()
  t.is(firstCursor, "1", "First cursor should be offset 1")

  // 测试第二页
  const page2 = await client.query(
    `query {
      searchOffset(type: LIMIT_TEST, first: 2, after: "${data.searchOffset.pageInfo.endCursor}") {
        edges {
          node {
            ...on LimitTestModel { name }
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }`,
  )

  t.is(
    page2.data.searchOffset.edges.length,
    2,
    "Second page should have 2 items",
  )
  t.true(
    page2.data.searchOffset.pageInfo.hasNextPage,
    "Should still have next page",
  )
})

// 新增：测试多列游标
test.serial(
  "GraphQL Presets - Search: multi-column keyset cursor",
  async (t) => {
    const app = new WebServer()

    // 清理并插入测试数据
    await SortTestModel.query().delete()
    // 插入相同 value 的数据，测试复合排序
    await SortTestModel.query().insert({ name: "A", value: 10 })
    await SortTestModel.query().insert({ name: "B", value: 10 })
    await SortTestModel.query().insert({ name: "C", value: 20 })

    app.register(
      graphql.plugin({
        context: () => ({ loader: new graphql.Loader() }),
        schema: graphql.type("Schema", {
          query: graphql.type("ObjectType", {
            name: "Query",
            fields: {
              searchMultiColumn: graphql.presets.search(
                {
                  SORT_TEST: {
                    model: SortTestModel,
                    resolverOptions: {
                      sortable: ["value", "name"],
                      cursorColumn: ["value", "id"], // 使用多列游标
                    },
                  },
                },
                { name: "MultiColumn" },
              ),
            },
          }),
        }),
      }),
    )

    await app.ready()
    const client = createMercuriusTestClient(app)

    const result = await client.query(
      `query {
      searchMultiColumn(type: SORT_TEST, first: 2, orderBy: "-value") {
        edges {
          cursor
          node {
            ...on SortTestModel { id name value }
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }`,
    )

    t.is(result.data.searchMultiColumn.edges.length, 2, "Should return 2 items")
    t.true(
      result.data.searchMultiColumn.pageInfo.hasNextPage,
      "Should have next page",
    )

    // 按 value DESC, id DESC 排序，第一项应该是 value=20 的记录
    t.is(result.data.searchMultiColumn.edges[0].node.value, 20)

    // 游标应该包含多个字段的值
    const cursorString = Buffer.from(
      result.data.searchMultiColumn.edges[0].cursor,
      "base64",
    ).toString()
    const cursorData = JSON.parse(cursorString)
    t.truthy(cursorData.values, "Cursor should contain values object")
    t.truthy(cursorData.values.value, "Cursor should contain value field")
    t.truthy(cursorData.values.id, "Cursor should contain id field")
  },
)

// 更新：sortable 测试以适配新 API
test.serial(
  "GraphQL Presets - Search: sortable option with keyset",
  async (t) => {
    const app = new WebServer()

    // 清理并插入测试数据
    await SortTestModel.query().delete()
    await SortTestModel.query().insert({ name: "C", value: 30 })
    await SortTestModel.query().insert({ name: "A", value: 10 })
    await SortTestModel.query().insert({ name: "B", value: 20 })

    app.register(
      graphql.plugin({
        context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
        schema: graphql.type("Schema", {
          query: graphql.type("ObjectType", {
            name: "Query",
            fields: {
              searchSortable: graphql.presets.search({
                SORT_TEST: {
                  model: SortTestModel,
                  resolverOptions: {
                    sortable: ["name", "value"],
                    cursorColumn: "id",
                  },
                },
              }),
            },
          }),
        }),
      }),
    )

    await app.ready()
    const client = createMercuriusTestClient(app)

    // 测试升序排序
    let result = await client.query(
      `query { searchSortable(type: SORT_TEST, orderBy: "name") { 
      edges { node { ...on SortTestModel { name } } } 
    } }`,
    )
    t.deepEqual(
      result.data.searchSortable.edges.map((e) => e.node.name),
      ["A", "B", "C"],
      "Should sort by name ascending",
    )

    // 测试降序排序
    result = await client.query(
      `query { searchSortable(type: SORT_TEST, orderBy: "-value") { 
      edges { node { ...on SortTestModel { value } } } 
    } }`,
    )
    t.deepEqual(
      result.data.searchSortable.edges.map((e) => e.node.value),
      [30, 20, 10],
      "Should sort by value descending",
    )
  },
)

// 更新原有的 sortable 测试
test.serial("GraphQL Presets - Search: sortable option", async (t) => {
  const app = new WebServer()

  // 清理数据
  await SortTestModel.query().delete()
  await SortTestModel.query().insert({ name: "C", value: 30 })
  await SortTestModel.query().insert({ name: "A", value: 10 })
  await SortTestModel.query().insert({ name: "B", value: 20 })

  app.register(
    graphql.plugin({
      context: ({ _ctx }) => ({ loader: new graphql.Loader() }),
      schema: graphql.type("Schema", {
        query: graphql.type("ObjectType", {
          name: "Query",
          fields: {
            getSortTestModels: {
              type: graphql.type("List", graphql.model(SortTestModel)),
              resolve: async () => SortTestModel.query(),
            },
            searchSortable: graphql.presets.search({
              SORT_TEST: {
                model: SortTestModel,
                resolverOptions: {
                  sortable: ["name", "value"],
                },
              },
            }),
          },
        }),
      }),
    }),
  )
  await app.ready()
  const client = createMercuriusTestClient(app)

  // 测试直接查询
  const directQueryResult = await client.query(
    `query { getSortTestModels { name value } }`,
  )
  t.is(
    directQueryResult.data.getSortTestModels.length,
    3,
    "Direct query should return all 3 items",
  )

  // 测试排序查询
  let result = await client.query(
    `query { searchSortable(type: SORT_TEST, orderBy: "name") { total } }`,
  )
  t.is(result.data.searchSortable.total, 3, "Should return correct total")

  // 测试降序排序
  result = await client.query(
    `query { searchSortable(type: SORT_TEST, orderBy: "-value") { edges { node { ...on SortTestModel { value } } } } }`,
  )
  t.deepEqual(
    result.data.searchSortable.edges.map((e) => e.node.value),
    [30, 20, 10],
    "Should sort by value descending",
  )
})
