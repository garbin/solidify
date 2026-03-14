import test from "ava"
import { pagination, WebServer } from "../dist/index.js"

test.serial("WebServer: comprehensive tests", async (t) => {
  const app = new WebServer()
  app.register(pagination())

  // Test basic functionality
  app.get("/", (_request, reply) => {
    reply.send("ok")
  })

  // Test fastifyRequestContext plugin
  app.get("/context", (request, reply) => {
    request.requestContext.set("testKey", "testValue")
    reply.send(request.requestContext.get("testKey"))
  })

  // Test pagination plugin
  app.get("/paginated", (request, reply) => {
    t.true(
      typeof request.pagination === "object",
      "request.pagination should be an object",
    )
    t.is(request.pagination.offset, 0, "default offset should be 0")
    t.is(request.pagination.limit, 50, "default limit should be 50")
    reply.paginate({ ...request.pagination, length: 100, unit: "items" })
    reply.send(["item1", "item2"])
  })
  const basicResponse = await app.inject().get("/")
  t.is(basicResponse.statusCode, 200, "basic GET should return 200")

  const contextResponse = await app.inject().get("/context")
  t.is(contextResponse.statusCode, 200, "context GET should return 200")
  t.is(
    contextResponse.body,
    "testValue",
    "should be able to set and get data from requestContext",
  )
  const paginationResponse = await app.inject().get("/paginated")
  t.is(
    paginationResponse.statusCode,
    206,
    "pagination GET should return 206 Partial Content",
  )
  t.is(
    paginationResponse.headers["content-range"],
    "items 0-49/100",
    "should set Content-Range header",
  )
  t.deepEqual(
    paginationResponse.json(),
    ["item1", "item2"],
    "should return paginated data",
  )
})

test.serial(
  "WebServer: Proxy pattern exposes all Fastify methods",
  async (t) => {
    const app = new WebServer()

    // Test that previously missing methods now exist
    t.is(typeof app.decorate, "function", "decorate should be a function")
    t.is(typeof app.addHook, "function", "addHook should be a function")
    t.is(
      typeof app.decorateRequest,
      "function",
      "decorateRequest should be a function",
    )

    // Test that instance escape hatch works
    t.truthy(app.instance, "instance should be accessible")

    // Test decorate
    app.decorate("testProp", "testValue")
    t.is((app as any).testProp, "testValue", "decorate should work")

    // Test decorateRequest
    app.decorateRequest("customProp", null)

    // Test addHook
    let hookCalled = false
    app.addHook("onRequest", async () => {
      hookCalled = true
    })

    app.get("/test-hook", (_request, reply) => {
      reply.send("ok")
    })

    await app.inject().get("/test-hook")
    t.true(hookCalled, "addHook should work")
  },
)
