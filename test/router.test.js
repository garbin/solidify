import os from "node:os"
import test from "ava"
import {
  knexMigration,
  Model,
  pagination,
  RESTfulRouter,
  Router,
  WebServer,
} from "../index.mjs"

test.before((_t) => {
  Model.connect({
    client: "sqlite3",
    connection: `${os.tmpdir()}/restful.sqlite`,
    useNullAsDefault: true,
  })
})

test.after((_t) => {
  Model.knex().destroy()
})

// --- Reusable Models and Setup ---

class Resource extends Model {
  static tableName = "resources"
  static fields = {
    id: {
      type: "increments",
      constraints: {
        primary: true,
      },
    },
    body: {
      type: "text",
    },
    counter: {
      type: "integer",
      constraints: {
        notNullable: true,
        defaultTo: 0,
      },
    },
  }
  static get relations() {
    return {
      children: Resource.hasMany(Children),
    }
  }
}

class Children extends Model {
  static tableName = "children"
  static fields = {
    id: { type: "increments", constraints: { primary: true } },
    content: { type: "text" },
    resourceId: { type: "integer" },
  }
  static get relations() {
    return {
      resource: Children.belongsTo(Resource),
    }
  }
}

class BadChild extends Model {
  static tableName = "bad_children"
}

async function setupTestDB() {
  await knexMigration([Resource, Children], { drop: true })
  await knexMigration([Resource, Children])
}

// --- Tests ---

test("Router: basic GET and middleware", async (t) => {
  const app = new WebServer()
  const index = new Router()
  index.use(async (request, _reply) => {
    request.query.addedByMiddleware = true
  })
  index.get("/", async (request, reply) => {
    t.is(request.query.addedByMiddleware, true)
    reply.send("Hello World")
  })
  app.register(index.plugin())
  const response = await app.inject().get("/")
  t.is(response.body, "Hello World")
})

test.serial("RESTfulRouter: POST /resources", async (t) => {
  await setupTestDB()
  const app = new WebServer()
  const resources = new RESTfulRouter(Resource)
  app.register(resources.create().plugin())

  const data = { body: "This is a new resource.", counter: 1 }
  const response = await app.inject().post("/resources").body(data)
  t.is(response.statusCode, 201, "should return 201 Created")
  t.is(response.json().body, data.body, "should return the created resource")
})

test.serial("RESTfulRouter: GET /resources", async (t) => {
  await setupTestDB()
  const app = new WebServer()
  app.register(pagination())
  const resources = new RESTfulRouter(Resource)
  app.register(resources.list().plugin())
  await Resource.query().insert({ body: "Resource 1", counter: 1 })

  const response = await app.inject().get("/resources")
  t.is(response.statusCode, 206, "should return 206 Partial Content")
  t.is(response.json().length, 1, "should return a list of resources")
  t.is(response.json()[0].body, "Resource 1")
})

test.serial("RESTfulRouter: PATCH and PUT /resources/:id", async (t) => {
  await setupTestDB()
  const app = new WebServer()
  const resources = new RESTfulRouter(Resource)
  app.register(resources.update().plugin())

  const resource = await Resource.query().insert({
    body: "Original Body",
    counter: 1,
  })

  // Test PATCH
  const patchData = { body: "Updated Body via PATCH" }
  const patchResponse = await app
    .inject()
    .patch(`/resources/${resource.id}`)
    .body(patchData)
  t.is(patchResponse.statusCode, 202, "PATCH should return 202 Accepted")
  t.is(
    patchResponse.json().body,
    patchData.body,
    "PATCH should return the updated resource",
  )

  // Test PUT
  const putData = { body: "Updated Body via PUT", counter: 2 }
  const putResponse = await app
    .inject()
    .put(`/resources/${resource.id}`)
    .body(putData)
  t.is(putResponse.statusCode, 202, "PUT should return 202 Accepted")
  t.is(
    putResponse.json().body,
    putData.body,
    "PUT should return the updated resource",
  )
})

test.serial("RESTfulRouter: DELETE /resources/:id", async (t) => {
  await setupTestDB()
  const app = new WebServer()
  const resources = new RESTfulRouter(Resource)
  app.register(resources.destroy().plugin())

  const resource = await Resource.query().insert({
    body: "To be deleted",
    counter: 1,
  })

  const response = await app.inject().delete(`/resources/${resource.id}`)
  t.is(response.statusCode, 204, "should return 204 No Content")

  const deletedResource = await Resource.query().findById(resource.id)
  t.is(deletedResource, undefined, "resource should be deleted from database")
})

test.serial("RESTfulRouter: Child routes", async (t) => {
  await setupTestDB()
  const app = new WebServer()
  app.register(pagination())
  const resources = new RESTfulRouter(Resource)
  resources.crud().child(Children, (children) => children.crud())
  app.register(resources.plugin())

  const resource = await Resource.query().insert({
    body: "Parent Resource",
    counter: 1,
  })

  const childData = { content: "Child content" }
  const createResponse = await app
    .inject()
    .post(`/resources/${resource.id}/children`)
    .body(childData)
  t.is(createResponse.statusCode, 201)
})

test.serial("RESTfulRouter: Not Found Errors", async (t) => {
  await setupTestDB()
  const app = new WebServer()
  const resources = new RESTfulRouter(Resource)
  app.register(resources.crud().plugin())

  const nonExistentId = 999

  const itemRes = await app.inject().get(`/resources/${nonExistentId}`)
  t.is(itemRes.statusCode, 404)

  const updateRes = await app
    .inject()
    .patch(`/resources/${nonExistentId}`)
    .body({ body: "test" })
  t.is(updateRes.statusCode, 404)

  const deleteRes = await app.inject().delete(`/resources/${nonExistentId}`)
  t.is(deleteRes.statusCode, 404)
})

test.serial("RESTfulRouter: list - advanced features", async (t) => {
  await setupTestDB()
  const app = new WebServer()
  app.register(pagination())
  const resources = new RESTfulRouter(Resource)

  resources.list({
    sortable: ["id", "counter"],
    filterable: [
      "id",
      ({ query, filters }) => {
        if (filters.min_counter) {
          query.where("counter", ">=", filters.min_counter)
        }
      },
    ],
    searchable: ["body"],
  })
  app.register(resources.plugin())

  await Resource.query().insertGraph([
    {
      id: 1,
      body: "Apple Banana",
      counter: 10,
      children: [{ content: "child1" }],
    },
    { id: 2, body: "Apple Cherry", counter: 30 },
    { id: 3, body: "Banana Kiwi", counter: 20 },
  ])

  // Test sorting
  const sortAsc = await app.inject().get("/resources?sort=counter")
  t.is(sortAsc.json()[0].id, 1)
  const sortDesc = await app.inject().get("/resources?sort=-counter")
  t.is(sortDesc.json()[0].id, 2)

  // Test filtering
  const filterRes = await app.inject().get("/resources?min_counter=25")
  t.is(filterRes.json().length, 1)
  t.is(filterRes.json()[0].id, 2)

  // Test searching
  const searchRes = await app.inject().get("/resources?q=Apple")
  t.is(searchRes.json().length, 2)
})

test.serial("RESTfulRouter: list - function-based searchable", async (t) => {
  await setupTestDB()
  const app = new WebServer()
  app.register(pagination())

  const resources = new RESTfulRouter(Resource)

  resources.list({
    searchable: ({ search, _query, _keywords }) => {
      search("body", (keywords, like, q) =>
        q.orWhere("body", like, `%${keywords}%`),
      )
      search("counter", (keywords, _like, q) => q.orWhere("counter", keywords))
    },
  })
  app.register(resources.plugin())

  await Resource.query().insertGraph([
    { id: 1, body: "Apple Banana", counter: 10 },
    { id: 2, body: "Apple Cherry", counter: 30 },
    { id: 3, body: "Banana Kiwi", counter: 20 },
  ])

  const searchBody = await app.inject().get("/resources?q=Apple")
  t.is(searchBody.json().length, 2)

  const searchCounter = await app.inject().get("/resources?q=30")
  t.is(searchCounter.json().length, 1)
  t.is(searchCounter.json()[0].id, 2)
})

test.serial("RESTfulRouter: after hooks", async (t) => {
  await setupTestDB()
  const app = new WebServer()
  const resources = new RESTfulRouter(Resource)

  let updateHookCalled = false
  let destroyHookCalled = false

  resources.update({
    after: (_req, _reply) => {
      updateHookCalled = true
    },
  })
  resources.destroy({
    after: (_req, _reply) => {
      destroyHookCalled = true
    },
  })
  app.register(resources.plugin())

  const resource = await Resource.query().insert({ body: "Test", counter: 1 })

  await app
    .inject()
    .patch(`/resources/${resource.id}`)
    .body({ body: "Updated" })
  t.true(updateHookCalled, "after hook should be called on update")

  await app.inject().delete(`/resources/${resource.id}`)
  t.true(destroyHookCalled, "after hook should be called on destroy")
})

test.serial("RESTfulRouter: child router error handling", (t) => {
  const resources = new RESTfulRouter(Resource)
  const error = t.throws(
    () => {
      resources.child(BadChild, () => {})
    },
    { instanceOf: Error },
  )
  t.is(error.message, `Relation ${BadChild} can not be found`)
})
