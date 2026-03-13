# WebServer Class

Enhanced Fastify server with request context support.

## Overview

`WebServer` extends Fastify to provide:
- Automatic request context registration
- Full access to all Fastify features
- Simplified server setup

## Signature

```javascript
import { WebServer } from 'solidify.js'

const app = new WebServer(options?)
```

## Constructor

**Parameters:**
- `options` (Object, optional): Fastify options
- `...args`: Additional Fastify constructor arguments

**Example:**
```javascript
const app = new WebServer({
  logger: true,
  trustProxy: true
})
```

## Instance Methods

All Fastify instance methods are available, plus:

### Request Context

The `@fastify/request-context` plugin is automatically registered, providing:

#### `request.requestContext.set(key, value)`

Store a value in the request context.

```javascript
app.get('/set', (request, reply) => {
  request.requestContext.set('user', { id: 1, name: 'John' })
  reply.send('OK')
})
```

#### `request.requestContext.get(key)`

Retrieve a value from the request context.

```javascript
app.get('/get', (request, reply) => {
  const user = request.requestContext.get('user')
  reply.send(user)
})
```

## Examples

### Basic Server

```javascript
import { WebServer } from 'solidify.js'

const app = new WebServer({ logger: true })

app.get('/', async (request, reply) => {
  return { hello: 'world' }
})

await app.listen({ port: 3000 })
console.log('Server running on http://localhost:3000')
```

### With Pagination

```javascript
import { WebServer, pagination } from 'solidify.js'

const app = new WebServer()
app.register(pagination())

app.get('/items', (request, reply) => {
  // request.pagination.offset and request.pagination.limit are available
  reply.paginate({ ...request.pagination, length: 100 })
  reply.send(['item1', 'item2'])
})
```

### With RESTfulRouter

```javascript
import { WebServer, RESTfulRouter, Model } from 'solidify.js'

const app = new WebServer()

class User extends Model {
  static tableName = 'users'
  static fields = { /* ... */ }
}

const userRouter = new RESTfulRouter(User)
userRouter.crud()

app.register(userRouter.plugin())

await app.listen({ port: 3000 })
```

### With GraphQL

```javascript
import { WebServer, graphql } from 'solidify.js'

const app = new WebServer()

app.register(graphql.plugin({
  context: () => ({ loader: new graphql.Loader() }),
  schema: graphql.type('Schema', {
    query: graphql.type('ObjectType', {
      name: 'Query',
      fields: {
        hello: {
          type: graphql.type('String'),
          resolve: () => 'Hello World'
        }
      }
    })
  })
}))

await app.listen({ port: 3000 })
```

### Error Handling

```javascript
const app = new WebServer()

app.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    reply.code(400).send({ error: 'Validation Error', details: error.validation })
    return
  }
  reply.code(500).send({ error: 'Internal Server Error' })
})
```

## Exports

The `Fastify` class is also exported for direct access:

```javascript
import { Fastify } from 'solidify.js'

const app = Fastify({ logger: true })
```
