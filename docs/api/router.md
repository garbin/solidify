# Router Classes

Base router and RESTful router for defining Fastify routes with a fluent API.

## Router Class

Base router class for defining Fastify routes with middleware support.

### Signature

```javascript
import { Router } from 'solidify.js'

const router = new Router()
```

### Constructor

Creates a new Router instance with a Proxy that intercepts HTTP method calls.

### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `routes` | Array | Registered routes |
| `middleHandlers` | Array | Middleware handlers |
| `methods` | string[] | Supported HTTP methods (get, post, patch, delete, put) |

### Methods

#### `use(...middleHandlers)`

Add middleware handlers to the router.

**Parameters:**
- `middleHandlers` (...Function): Middleware functions

**Returns:** `Router` - This router for chaining

**Example:**
```javascript
router.use(async (request, reply) => {
  request.customData = { timestamp: Date.now() }
})
```

#### `plugin()`

Convert the router to a Fastify plugin function.

**Returns:** `Function` - Fastify plugin function

**Example:**
```javascript
const router = new Router()
router.get('/hello', async (request, reply) => {
  reply.send('Hello World')
})

app.register(router.plugin())
```

#### HTTP Method Handlers

The router supports dynamic method handlers: `get()`, `post()`, `patch()`, `delete()`, `put()`.

**Parameters:**
- `url` (string): Route URL
- `handler` (Function): Route handler
- `options` (Object, optional): Route options

**Returns:** `Router` - This router for chaining

**Example:**
```javascript
router
  .get('/users', listUsers)
  .post('/users', createUser)
  .get('/users/:id', getUser)
```

---

## RESTfulRouter Class

Automatically generates CRUD endpoints for a model.

### Signature

```javascript
import { RESTfulRouter } from 'solidify.js'

const router = new RESTfulRouter(Model, options?)
```

### Constructor

**Parameters:**
- `model` (Model): The model class (must extend Model)
- `options` (Object, optional):
  - `idColumn` (string): ID column name (defaults to `model.idColumn`)
  - `idType` (string): ID parameter type for route matching (defaults to `'\\d+'`)
  - `rootPath` (string): Root path for routes (defaults to `'/${tableName}'`)
  - `query` (Function): Function to get base query (defaults to `() => model.query()`)

**Throws:** `Error` if model is not an instance of Model

**Example:**
```javascript
const userRouter = new RESTfulRouter(User, {
  rootPath: '/api/users'
})
```

### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `model` | Model | The model class |
| `metadata` | Object | Router metadata |
| `metadata.rootPath` | string | Root path for routes |
| `metadata.itemPath` | string | Item path pattern |
| `metadata.idColumn` | string | ID column name |
| `metadata.idType` | string | ID parameter type |

### Methods

#### `create([...handlers], [options])`

Add a CREATE endpoint (POST /resource).

**Parameters:**
- `handlers` (...Function): Optional middleware handlers
- `options` (Object, optional): Route options

**Returns:** `RESTfulRouter` - This router for chaining

**Endpoint:** `POST /{tableName}`

**Response:** `201 Created` with the created item

**Example:**
```javascript
router.create()
// POST /users -> Creates a new user

router.create(async (request, reply) => {
  request.requestContext.set('attributes', { ...request.body, createdBy: 'system' })
})
```

#### `list([...handlers], [options])`

Add a LIST endpoint (GET /resource) with pagination, filtering, sorting, and search.

**Parameters:**
- `handlers` (...Function): Optional middleware handlers
- `options` (Object): List options
  - `select` (string[]): Fields to select
  - `join` (string): Relation to join
  - `eager` (Array): Relations to eager load
  - `sortable` (string[]): Fields that can be sorted
  - `searchable` (string[]|Function): Fields that can be searched, or custom search function
  - `filterable` (string[]|Function): Fields that can be filtered, or custom filter function

**Returns:** `RESTfulRouter` - This router for chaining

**Endpoint:** `GET /{tableName}`

**Response:** `206 Partial Content` with paginated results

**Query Parameters:**
- `sort`: Sort field (prefix with `-` for descending)
- `q`: Search keywords
- Custom filter fields

**Example:**
```javascript
router.list({
  sortable: ['name', 'createdAt'],
  searchable: ['name', 'email'],
  filterable: ['status', 'role']
})
// GET /users?sort=-createdAt&q=john&status=active

// Custom filter function
router.list({
  filterable: ({ filter, query, filters }) => {
    filter('status')
    if (filters.minAge) {
      query.where('age', '>=', filters.minAge)
    }
  }
})

// Custom search function
router.list({
  searchable: ({ search, keywords, query }) => {
    search('name')
    search('email')
  }
})
```

#### `item([...handlers], [options])`

Add an ITEM endpoint (GET /resource/:id).

**Parameters:**
- `handlers` (...Function): Optional middleware handlers
- `options` (Object): Item options
  - `select` (string[]): Fields to select
  - `join` (string): Relation to join
  - `eager` (Array): Relations to eager load

**Returns:** `RESTfulRouter` - This router for chaining

**Endpoint:** `GET /{tableName}/:id`

**Response:** `200 OK` with the item

**Throws:** `404 Not Found` if item doesn't exist

**Example:**
```javascript
router.item({ select: ['id', 'name', 'email'] })
// GET /users/123 -> Returns user with selected fields
```

#### `update([...handlers], [options])`

Add UPDATE endpoints (PUT and PATCH /resource/:id).

**Parameters:**
- `handlers` (...Function): Optional middleware handlers
- `options` (Object): Update options
  - `after` (Function): Hook called after successful update

**Returns:** `RESTfulRouter` - This router for chaining

**Endpoints:** 
- `PUT /{tableName}/:id`
- `PATCH /{tableName}/:id`

**Response:** `202 Accepted` with the updated item

**Throws:** `404 Not Found` if item doesn't exist

**Example:**
```javascript
router.update({
  after: (request, reply) => {
    console.log(`User ${request.params.id} updated`)
  }
})
```

#### `destroy([...handlers], [options])`

Add a DESTROY endpoint (DELETE /resource/:id).

**Parameters:**
- `handlers` (...Function): Optional middleware handlers
- `options` (Object): Destroy options
  - `after` (Function): Hook called after successful deletion

**Returns:** `RESTfulRouter` - This router for chaining

**Endpoint:** `DELETE /{tableName}/:id`

**Response:** `204 No Content`

**Throws:** `404 Not Found` if item doesn't exist

**Example:**
```javascript
router.destroy({
  after: (request, reply) => {
    const deleted = request.requestContext.get('deleted')
    console.log(`Deleted: ${deleted.name}`)
  }
})
```

#### `crud()`

Add all CRUD endpoints at once.

**Returns:** `RESTfulRouter` - This router for chaining

**Equivalent to:** `create().list().item().update().destroy()`

**Example:**
```javascript
router.crud()
// Creates all 6 endpoints:
// POST /users
// GET /users
// GET /users/:id
// PUT /users/:id
// PATCH /users/:id
// DELETE /users/:id
```

#### `child(childModel, routerCallback, [options])`

Add nested routes for a child model.

**Parameters:**
- `childModel` (Model): The child model class
- `routerCallback` (Function): Function that receives the child router
- `options` (Object, optional): Additional options for the child router

**Returns:** `RESTfulRouter` - This router for chaining

**Throws:** `Error` if relation to child model is not found

**Example:**
```javascript
// One-to-Many: User has many Posts
const userRouter = new RESTfulRouter(User)
userRouter.crud().child(Post, (postRouter) => {
  postRouter.crud()
})
// Routes created:
// GET /users/:userId/posts
// POST /users/:userId/posts
// GET /users/:userId/posts/:id
// etc.
```

### Complete Example

```javascript
import { RESTfulRouter, Model } from 'solidify.js'

class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string' },
    email: { type: 'string' }
  }
}

class Post extends Model {
  static tableName = 'posts'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    title: { type: 'string' },
    userId: { type: 'integer' }
  }
  static get relations() {
    return { user: Post.belongsTo(User) }
  }
}

// Setup router
const userRouter = new RESTfulRouter(User)
userRouter
  .create()
  .list({
    sortable: ['name', 'createdAt'],
    searchable: ['name', 'email'],
    filterable: ['status']
  })
  .item({ select: ['id', 'name', 'email'] })
  .update()
  .destroy()
  .child(Post, (postRouter) => postRouter.crud())

app.register(userRouter.plugin())
```
