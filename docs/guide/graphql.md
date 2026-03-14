# GraphQL Integration Guide

Build GraphQL APIs with automatic type generation and resolvers.

## Basic Setup

```javascript
import { WebServer, Model, graphql } from 'solidify.js'

class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string' }
  }
}

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

## Type Generation

### From Models

```javascript
const UserType = graphql.model(User)
// Automatically creates GraphQL type with all fields
```

### Manual Types

```javascript
// Scalar types
const StringType = graphql.type('String')
const IntType = graphql.type('Int')
const BooleanType = graphql.type('Boolean')
const IDType = graphql.type('ID')
const FloatType = graphql.type('Float')

// Date types
const DateType = graphql.type('Date')
const DateTimeType = graphql.type('DateTime')
const TimeType = graphql.type('Time')
const TimestampType = graphql.type('Timestamp')

// Custom scalars
const JSONType = graphql.type('JSON')
const UUIDType = graphql.type('UUID')

// Non-null wrapper
const NonNullString = graphql.type('NonNull', graphql.type('String'))

// List wrapper
const StringList = graphql.type('List', graphql.type('String'))
```

### Object Types

```javascript
const UserType = graphql.type('ObjectType', {
  name: 'User',
  fields: {
    id: { type: graphql.type('NonNull', graphql.type('ID')) },
    name: { type: graphql.type('String') },
    email: { type: graphql.type('String') }
  }
})
```

## Query Resolvers

### Simple Query

```javascript
query: graphql.type('ObjectType', {
  name: 'Query',
  fields: {
    users: {
      type: graphql.type('List', graphql.model(User)),
      resolve: () => User.query()
    },
    user: {
      type: graphql.model(User),
      args: {
        id: { type: graphql.type('NonNull', graphql.type('ID')) }
      },
      resolve: (_root, { id }) => User.query().findById(id)
    }
  }
})
```

### With DataLoader

```javascript
query: graphql.type('ObjectType', {
  name: 'Query',
  fields: {
    users: {
      type: graphql.type('List', graphql.model(User)),
      resolve: (_root, _args, ctx) => {
        const loader = ctx.loader.acquire('users', async (ids) => {
          const users = await User.query().whereIn('id', ids)
          return ids.map(id => users.find(u => u.id === id))
        })
        return User.query() // or use loader.load(id) for individual items
      }
    }
  }
})
```

## Mutations

### Using Presets

```javascript
mutation: graphql.type('ObjectType', {
  name: 'Mutation',
  fields: {
    ...graphql.presets.mutation(User)
      .create()
      .update()
      .destroy()
      .mutations
  }
})

// Generated mutations:
// createUser(input: { name: "John" }) { id name }
// updateUser(input: { id: 1, patch: { name: "Jane" } }) { id name }
// destroyUser(input: { id: 1 }) { id }
```

### Custom Mutations

```javascript
mutation: graphql.type('ObjectType', {
  name: 'Mutation',
  fields: {
    createUser: {
      type: graphql.model(User),
      args: {
        input: { type: graphql.type('NonNull', graphql.type('JSON')) }
      },
      resolve: async (_root, { input }) => {
        return User.query().insertAndFetch(input)
      }
    }
  }
})
```

## Batch Loading Presets

For efficient N+1 query prevention:

```javascript
class User extends Model {
  static get relations() {
    return {
      posts: User.hasMany(Post, {}, {
        resolve: graphql.presets.batch.hasMany({ model: Post })
      }),
      profile: User.hasOne(Profile, {}, {
        resolve: graphql.presets.batch.hasOne({ model: Profile })
      }),
      company: User.belongsTo(Company, {}, {
        resolve: graphql.presets.batch.belongsTo({ model: Company })
      })
    }
  }
}
```

## Search Preset

Relay-style connection with filtering and pagination:

```javascript
query: graphql.type('ObjectType', {
  name: 'Query',
  fields: {
    search: graphql.presets.search({
      USER: {
        model: User,
        resolverOptions: {
          sortable: ['name', 'createdAt'],
          filterable: ['status'],
          searchable: ['name', 'email'],
          cursorColumn: 'id'
        }
      }
    })
  }
})

// Query:
// {
//   search(type: USER, first: 10, orderBy: "-createdAt") {
//     total
//     edges { cursor node { id name } }
//     pageInfo { hasNextPage endCursor }
//   }
// }
```

## Fetch Preset

Union type fetcher:

```javascript
query: graphql.type('ObjectType', {
  name: 'Query',
  fields: {
    fetch: graphql.presets.fetch({
      USER: { model: User },
      POST: { model: Post }
    })
  }
})

// Query:
// {
//   fetch(type: USER, id: "1") {
//     ... on User { id name }
//     ... on Post { id title }
//   }
// }
```

## Complete Example

```javascript
import { WebServer, Model, graphql, knexMigration } from 'solidify.js'

// Models
class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string' },
    email: { type: 'string' }
  }
  static get relations() {
    return {
      posts: User.hasMany(Post, {}, {
        resolve: graphql.presets.batch.hasMany({ model: Post })
      })
    }
  }
}

class Post extends Model {
  static tableName = 'posts'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    title: { type: 'string' },
    content: { type: 'text' },
    userId: { type: 'integer' }
  }
  static get relations() {
    return {
      user: Post.belongsTo(User, {}, {
        resolve: graphql.presets.batch.belongsTo({ model: User })
      })
    }
  }
}

// Setup
Model.connect({
  client: 'sqlite3',
  connection: ':memory:',
  useNullAsDefault: true
})

await knexMigration([User, Post], { drop: true })
await knexMigration([User, Post])

// GraphQL Schema
const app = new WebServer()

app.register(graphql.plugin({
  context: () => ({ loader: new graphql.Loader() }),
  schema: graphql.type('Schema', {
    query: graphql.type('ObjectType', {
      name: 'Query',
      fields: {
        // Fetch by ID
        fetch: graphql.presets.fetch({
          USER: { model: User },
          POST: { model: Post }
        }),
        // Search with pagination
        search: graphql.presets.search({
          USER: {
            model: User,
            resolverOptions: {
              sortable: ['name'],
              searchable: ['name', 'email']
            }
          }
        })
      }
    }),
    mutation: graphql.type('ObjectType', {
      name: 'Mutation',
      fields: {
        ...graphql.presets.mutation(User).create().update().destroy().mutations,
        ...graphql.presets.mutation(Post).create().update().destroy().mutations
      }
    })
  })
}))

await app.listen({ port: 3000 })
```
