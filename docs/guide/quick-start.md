# Quick Start

Get up and running with Solidify in 5 minutes.

## Installation

```bash
npm install solidify.js
```

## Prerequisites

- Node.js 18 or higher
- A database (PostgreSQL, MySQL, or SQLite)

## Basic Setup

### 1. Define a Model

```javascript
import { Model } from 'solidify.js'

class User extends Model {
  static tableName = 'users'
  
  static fields = {
    id: { 
      type: 'increments', 
      constraints: { primary: true } 
    },
    name: { 
      type: 'string',
      validator: { required: 'Name is required' }
    },
    email: { 
      type: 'string',
      validator: { 
        required: 'Email is required',
        email: 'Invalid email format'
      }
    },
    createdAt: { 
      type: 'timestamp', 
      timestamp: 'insert' 
    }
  }
}
```

### 2. Connect to Database

```javascript
// PostgreSQL
Model.connect({
  client: 'pg',
  connection: 'postgres://user:pass@localhost:5432/mydb'
})

// MySQL
Model.connect({
  client: 'mysql2',
  connection: 'mysql://user:pass@localhost:3306/mydb'
})

// SQLite
Model.connect({
  client: 'sqlite3',
  connection: './database.sqlite',
  useNullAsDefault: true
})
```

### 3. Create Tables

```javascript
import { knexMigration } from 'solidify.js'

// Create tables for your models
await knexMigration([User])
```

### 4. Create a REST API

```javascript
import { WebServer, RESTfulRouter } from 'solidify.js'

const app = new WebServer({ logger: true })

// Create CRUD endpoints for User
const userRouter = new RESTfulRouter(User)
userRouter.crud()

app.register(userRouter.plugin())

// Start server
await app.listen({ port: 3000 })
console.log('Server running on http://localhost:3000')
```

**Endpoints created:**

| Method | Path | Description |
|--------|------|-------------|
| POST | /users | Create a user |
| GET | /users | List users (paginated) |
| GET | /users/:id | Get a user |
| PUT | /users/:id | Update a user (full) |
| PATCH | /users/:id | Update a user (partial) |
| DELETE | /users/:id | Delete a user |

## Complete Example

Here's a complete example with multiple models and relationships:

```javascript
import { 
  Model, 
  WebServer, 
  RESTfulRouter, 
  pagination,
  knexMigration 
} from 'solidify.js'

// Define models
class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string', validator: { required: true } },
    email: { type: 'string', validator: { email: true } }
  }
  static get relations() {
    return {
      posts: User.hasMany(Post)
    }
  }
}

class Post extends Model {
  static tableName = 'posts'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    title: { type: 'string', validator: { required: true } },
    content: { type: 'text' },
    userId: { type: 'integer' }
  }
  static get relations() {
    return {
      user: Post.belongsTo(User)
    }
  }
}

// Connect to database
Model.connect({
  client: 'sqlite3',
  connection: './blog.sqlite',
  useNullAsDefault: true
})

// Create tables
await knexMigration([User, Post], { drop: true })
await knexMigration([User, Post])

// Setup server
const app = new WebServer({ logger: true })

// Add pagination support
app.register(pagination())

// Create routers
const userRouter = new RESTfulRouter(User)
userRouter
  .crud()
  .child(Post, (postRouter) => postRouter.crud())

app.register(userRouter.plugin())

// Start server
await app.listen({ port: 3000 })
console.log('Server running on http://localhost:3000')

// Try it:
// POST /users { "name": "John", "email": "john@example.com" }
// POST /users/1/posts { "title": "My First Post", "content": "..." }
// GET /users/1/posts
```

## Using with GraphQL

```javascript
import { WebServer, Model, graphql, knexMigration } from 'solidify.js'

class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string' }
  }
}

// Connect and migrate
Model.connect({
  client: 'sqlite3',
  connection: ':memory:',
  useNullAsDefault: true
})
await knexMigration([User])

// Setup GraphQL server
const app = new WebServer()

app.register(graphql.plugin({
  context: () => ({ loader: new graphql.Loader() }),
  schema: graphql.type('Schema', {
    query: graphql.type('ObjectType', {
      name: 'Query',
      fields: {
        users: {
          type: graphql.type('List', graphql.model(User)),
          resolve: () => User.query()
        }
      }
    }),
    mutation: graphql.type('ObjectType', {
      name: 'Mutation',
      fields: {
        ...graphql.presets.mutation(User).create().update().destroy().mutations
      }
    })
  })
}))

await app.listen({ port: 3000 })

// Query:
// query { users { id name } }
// mutation { createUser(input: { name: "John" }) { id name } }
```

## Creating a CLI Tool

```javascript
import { Command } from 'solidify.js'

class MyCLI extends Command {
  name = 'mycli'
  description = 'My CLI tool'
  version = '1.0.0'
  
  options = {
    verbose: {
      type: 'boolean',
      flag: '-v',
      help: 'Enable verbose output'
    }
  }
  
  subcommands = {
    init: {
      description: 'Initialize project',
      action: async function() {
        console.log('Initializing...')
        this.setState({ initialized: true })
      }
    }
  }
  
  async action(_name, options) {
    if (options.verbose) {
      console.log('Verbose mode enabled')
    }
    console.log('Hello from MyCLI!')
  }
}

// Run the CLI
const cli = new MyCLI()
await cli.execute()
```

## Next Steps

- [Model Definition Guide](./model-definition.md) - Learn about field types, validation, and relationships
- [REST API Guide](./rest-api.md) - Customize REST endpoints with filtering, sorting, and search
- [GraphQL Integration Guide](./graphql.md) - Build GraphQL APIs with automatic type generation
- [Database Migration Guide](./migrations.md) - Manage database schema changes
- [CLI Development Guide](./cli.md) - Build command-line tools
