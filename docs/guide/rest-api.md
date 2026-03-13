# REST API Guide

Learn how to create RESTful APIs with RESTfulRouter.

## Basic CRUD

```javascript
import { WebServer, RESTfulRouter, Model } from 'solidify.js'

class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string' },
    email: { type: 'string' }
  }
}

const app = new WebServer()
const router = new RESTfulRouter(User)
router.crud()

app.register(router.plugin())
```

This creates 6 endpoints:

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | /users | Create user | 201 |
| GET | /users | List users | 206 |
| GET | /users/:id | Get user | 200 |
| PUT | /users/:id | Replace user | 202 |
| PATCH | /users/:id | Update user | 202 |
| DELETE | /users/:id | Delete user | 204 |

## Individual Endpoints

### Create

```javascript
router.create()

// With middleware
router.create(
  async (request, reply) => {
    request.requestContext.set('attributes', {
      ...request.body,
      createdBy: request.user.id
    })
  }
)
```

### List with Pagination

```javascript
import { pagination } from 'solidify.js'

app.register(pagination())

router.list({
  sortable: ['name', 'createdAt'],
  searchable: ['name', 'email'],
  filterable: ['status', 'role']
})

// Query examples:
// GET /users?sort=-createdAt         (sort by createdAt DESC)
// GET /users?q=john                  (search name and email)
// GET /users?status=active&role=admin
```

### Get Single Item

```javascript
router.item({
  select: ['id', 'name', 'email'],
  eager: ['posts']  // Include related posts
})
```

### Update

```javascript
router.update({
  after: (request, reply) => {
    console.log(`User ${request.params.id} updated`)
  }
})
```

### Delete

```javascript
router.destroy({
  after: (request, reply) => {
    const deleted = request.requestContext.get('deleted')
    console.log(`Deleted: ${deleted.name}`)
  }
})
```

## Sorting

```javascript
router.list({
  sortable: ['name', 'email', 'createdAt']
})

// Sort ascending
GET /users?sort=name

// Sort descending
GET /users?sort=-createdAt
```

## Searching

### Simple Search

```javascript
router.list({
  searchable: ['name', 'email']
})

// Searches both fields with LIKE
GET /users?q=john
```

### Custom Search

```javascript
router.list({
  searchable: ({ search, keywords, query }) => {
    // Use 'search' helper for simple fields
    search('name')
    search('email')
    
    // Or build custom query
    query.orWhereRaw('LOWER(name) LIKE ?', [`%${keywords.toLowerCase()}%`])
  }
})
```

## Filtering

### Simple Filters

```javascript
router.list({
  filterable: ['status', 'role']
})

GET /users?status=active&role=admin
```

### Custom Filters

```javascript
router.list({
  filterable: ({ filter, query, filters }) => {
    // Use 'filter' helper for simple fields
    filter('status')
    
    // Custom filter logic
    if (filters.minAge) {
      query.where('age', '>=', filters.minAge)
    }
    if (filters.createdAfter) {
      query.where('createdAt', '>', filters.createdAfter)
    }
  }
})
```

## Selecting Fields

```javascript
router.item({
  select: ['id', 'name', 'email']
})
```

## Eager Loading

```javascript
router.item({
  eager: [{ posts: { comments: true } }]
})

// Or with options
router.list({
  eager: [
    {
      relation: 'posts',
      modify: (query) => query.where('status', 'published')
    }
  ]
})
```

## Nested Routes

Create nested resources:

```javascript
class User extends Model {
  static get relations() {
    return {
      posts: User.hasMany(Post)
    }
  }
}

const userRouter = new RESTfulRouter(User)
userRouter.crud().child(Post, (postRouter) => {
  postRouter.crud()
})

// Routes created:
// GET    /users/:userId/posts
// POST   /users/:userId/posts
// GET    /users/:userId/posts/:id
// PATCH  /users/:userId/posts/:id
// DELETE /users/:userId/posts/:id
```

## Custom Routes

Add custom routes alongside CRUD:

```javascript
const router = new RESTfulRouter(User)
router.crud()

// Add custom route
router.get('/users/search/:term', async (request, reply) => {
  const users = await User.query()
    .where('name', 'like', `%${request.params.term}%`)
  reply.send(users)
})
```

## Error Handling

RESTfulRouter automatically handles:

- **404 Not Found**: When item doesn't exist
- **400 Bad Request**: When validation fails
- **500 Internal Server Error**: For unexpected errors

```javascript
// Override error responses
app.setErrorHandler((error, request, reply) => {
  if (error.status === 404) {
    reply.code(404).send({ error: 'Resource not found' })
  } else {
    reply.code(500).send({ error: 'Internal server error' })
  }
})
```

## Complete Example

```javascript
import { 
  Model, 
  WebServer, 
  RESTfulRouter, 
  pagination,
  knexMigration 
} from 'solidify.js'

// Models
class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string', validator: { required: true } },
    email: { type: 'string', validator: { email: true } },
    status: { type: ['enum', ['active', 'inactive']] }
  }
  static get relations() {
    return { posts: User.hasMany(Post) }
  }
}

class Post extends Model {
  static tableName = 'posts'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    title: { type: 'string' },
    content: { type: 'text' },
    userId: { type: 'integer' },
    status: { type: ['enum', ['draft', 'published']] }
  }
  static get relations() {
    return { user: Post.belongsTo(User) }
  }
}

// Setup
Model.connect({
  client: 'sqlite3',
  connection: './blog.sqlite',
  useNullAsDefault: true
})

await knexMigration([User, Post], { drop: true })
await knexMigration([User, Post])

// Server
const app = new WebServer({ logger: true })
app.register(pagination())

// User routes
const userRouter = new RESTfulRouter(User)
userRouter
  .create()
  .list({
    sortable: ['name', 'createdAt'],
    searchable: ['name', 'email'],
    filterable: ['status']
  })
  .item({ eager: ['posts'] })
  .update()
  .destroy()
  .child(Post, (postRouter) => {
    postRouter.crud()
  })

app.register(userRouter.plugin())

await app.listen({ port: 3000 })
```
