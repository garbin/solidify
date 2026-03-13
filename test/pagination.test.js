import test from "ava"
import { pagination } from "../dist/lib/pagination.js"
import { WebServer } from "../dist/lib/webserver.js"

// --- Tests ---

test.serial("Pagination: basic functionality (no Range header)", async (t) => {
  const app = new WebServer()
  app.register(pagination())
  app.get("/", (request, reply) => {
    t.true(
      typeof request.pagination === "object",
      "request.pagination should be an object",
    )
    t.is(request.pagination.offset, 0, "default offset should be 0")
    t.is(request.pagination.limit, 50, "default limit should be 50 (maximum)")
    reply.paginate({ ...request.pagination, length: 100 })
    reply.send(["item1", "item2"])
  })
  const response = await app.inject().get("/")
  t.is(response.statusCode, 206, "should return 206 Partial Content")
  t.is(
    response.headers["content-range"],
    "items 0-49/100",
    "should set Content-Range header",
  )
  t.deepEqual(
    response.json(),
    ["item1", "item2"],
    "should return paginated data",
  )
})

test.serial("Pagination: with Range header (items=0-9)", async (t) => {
  const app = new WebServer()
  app.register(pagination())
  app.get("/range-0-9", (request, reply) => {
    t.is(request.pagination.offset, 0, "offset should be 0")
    t.is(request.pagination.limit, 10, "limit should be 10")
    reply.paginate({ ...request.pagination, length: 100 })
    reply.send(Array(10).fill("item"))
  })
  const response = await app
    .inject()
    .get("/range-0-9")
    .headers({ Range: "items=0-9" })
  t.is(response.statusCode, 206, "should return 206 Partial Content")
  t.is(
    response.headers["content-range"],
    "items 0-9/100",
    "should set Content-Range header",
  )
})

test.serial(
  "Pagination: with Range header (items=10-19, limit 20)",
  async (t) => {
    const app = new WebServer()
    app.register(pagination())
    app.get("/range-10-29", (request, reply) => {
      t.is(request.pagination.offset, 10, "offset should be 10")
      t.is(request.pagination.limit, 20, "limit should be 20")
      reply.paginate({ ...request.pagination, length: 100 })
      reply.send(Array(20).fill("item"))
    })
    const response = await app
      .inject()
      .get("/range-10-29")
      .headers({ Range: "items=10-29" })
    t.is(response.statusCode, 206, "should return 206 Partial Content")
    t.is(
      response.headers["content-range"],
      "items 10-29/100",
      "should set Content-Range header",
    )
  },
)

test.serial("Pagination: invalid Range header (items=invalid)", async (t) => {
  const app = new WebServer()
  app.register(pagination())
  app.get("/invalid-range", (_request, reply) => {
    reply.send("ok")
  })
  const response = await app
    .inject()
    .get("/invalid-range")
    .headers({ Range: "items=invalid" })
  t.is(
    response.statusCode,
    412,
    "should return 412 Precondition Failed for malformed range",
  )
})

test.serial("Pagination: invalid Range header (items=10-5)", async (t) => {
  const app = new WebServer()
  app.register(pagination())
  app.get("/invalid-range-order", (_request, reply) => {
    reply.send("ok")
  })
  const response = await app
    .inject()
    .get("/invalid-range-order")
    .headers({ Range: "items=10-5" })
  t.is(
    response.statusCode,
    416,
    "should return 416 Range Not Satisfiable for invalid range",
  )
})

test.serial("Pagination: allowAll false and Range items=0-*", async (t) => {
  const app = new WebServer()
  app.register(pagination({ allowAll: false }))
  app.get("/allow-all-false", (_request, reply) => {
    reply.send("ok")
  })
  const response = await app
    .inject()
    .get("/allow-all-false")
    .headers({ Range: "items=0-*" })
  t.is(
    response.statusCode,
    416,
    "should return 416 Range Not Satisfiable when allowAll is false and full range is requested",
  )
})

test.serial("Pagination: wrong unit in Range header", async (t) => {
  const app = new WebServer()
  app.register(pagination())
  app.get("/wrong-unit", (_request, reply) => {
    reply.send("ok")
  })
  const response = await app
    .inject()
    .get("/wrong-unit")
    .headers({ Range: "bytes=0-9" })
  t.is(
    response.statusCode,
    412,
    "should return 412 Precondition Failed for wrong unit",
  )
})

test.serial("Pagination: non-integer first value", async (t) => {
  const app = new WebServer()
  app.register(pagination())
  app.get("/non-integer", (_request, reply) => {
    reply.send("ok")
  })
  const response = await app
    .inject()
    .get("/non-integer")
    .headers({ Range: "items=abc-10" })
  t.is(
    response.statusCode,
    412,
    "should return 412 Precondition Failed for malformed range",
  )
})

test.serial("Pagination: custom maximum", async (t) => {
  const app = new WebServer()
  app.register(pagination({ maximum: 10 }))
  app.get("/custom-max", (request, reply) => {
    t.is(request.pagination.limit, 10, "limit should be custom maximum")
    reply.paginate({ ...request.pagination, length: 100 })
    reply.send(["item"])
  })
  const response = await app.inject().get("/custom-max")
  t.is(response.statusCode, 206)
})

test.serial("Pagination: paginate with non-success status code", async (t) => {
  const app = new WebServer()
  app.register(pagination())
  app.get("/error-status", (request, reply) => {
    reply.code(404)
    reply.paginate({ ...request.pagination, length: 100 })
    reply.send({ error: "Not found" })
  })
  const response = await app.inject().get("/error-status")
  t.is(response.statusCode, 404, "should keep 404 status code")
  t.is(
    response.headers["content-range"],
    "items 0-49/100",
    "Content-Range is still set",
  )
})
