# GraphQL Namespace

GraphQL integration with Mercurius for Fastify.

## Overview

The `graphql` namespace provides:
- Mercurius plugin factory
- Model-to-GraphQL type conversion
- DataLoader wrapper for batch loading
- Presets for common GraphQL patterns (CRUD, pagination, search)

## Import

```javascript
import { graphql } from 'solidify.js'
```

## Functions

### `graphql.plugin(options)`

Create a Mercurius Fastify plugin.

**Parameters:**
- `options` (Object):
  - `typeDefs` (string, optional): GraphQL schema definition string
  - `resolvers` (Object, optional): Resolver functions
  - `schema` (GraphQLSchema, optional): Pre-built GraphQL schema
  - `context` (Function, optional): Context factory function
  - ...other Mercurius options

**Returns:** `Function` - Fastify plugin

**Example:**
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
```

### `graphql.type(typeName, config?)`

Create a GraphQL type.

**Parameters:**
- `typeName` (string): The type name (e.g., `'ObjectType'`, `'Schema'`, `'NonNull'`)
- `config` (Object, optional): Type configuration

**Returns:** `GraphQLType` - The GraphQL type

**Supported Type Names:**
- `'Schema'` - GraphQL schema
- `'ObjectType'` - Object type
- `'InputObjectType'` - Input object type
- `'InterfaceType'` - Interface type
- `'UnionType'` - Union type
- `'EnumType'` - Enum type
- `'NonNull'` - Non-null wrapper
- `'List'` - List wrapper
- `'String'`, `'Int'`, `'Float'`, `'Boolean'`, `'ID'` - Scalar types
- `'Date'`, `'DateTime'`, `'Time'`, `'Timestamp'` - Date scalars
- `'JSON'`, `'UUID'` - Custom scalars

**Example:**
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

### `graphql.model(ModelClass)`

Convert a Model class to a GraphQL type.

**Parameters:**
- `ModelClass` (Model): The model class

**Returns:** `GraphQLObjectType` - The GraphQL type

**Features:**
- Automatic field type inference from model fields
- Support for virtual fields
- Caching (same model returns same type instance)

**Example:**
```javascript
import { Model, graphql } from 'solidify.js'

class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string' },
    email: { type: 'string', constraints: { notNullable: true } }
  }
  static get virtualFields() {
    return { displayName: 'string' }
  }
  get displayName() {
    return this.name || this.email
  }
}

const UserType = graphql.model(User)
// Creates GraphQL type with id, name, email (NonNull), displayName fields
```

---

## Classes

### `graphql.Loader`

DataLoader wrapper for batch loading in GraphQL resolvers.

**Constructor:**
```javascript
const loader = new graphql.Loader()
```

**Methods:**

#### `acquire(name, batchFn, options?)`

Get or create a DataLoader instance.

**Parameters:**
- `name` (string): Loader name
- `batchFn` (Function): Batch loading function
- `options` (Object, optional): DataLoader options

**Returns:** `DataLoader` - DataLoader instance

**Example:**
```javascript
const loader = new graphql.Loader()

const userLoader = loader.acquire('users', async (ids) => {
  const users = await User.query().whereIn('id', ids)
  return ids.map(id => users.find(u => u.id === id))
})

const user = await userLoader.load(1)
```

---

## Presets

### `graphql.presets.batch`

Batch loading presets for relation resolvers.

#### `graphql.presets.batch.hasMany(options)`

Create a resolver for hasMany relations.

**Parameters:**
- `options` (Object):
  - `model` (Model): The related model
  - `foreignKey` (string, optional): Foreign key column
  - `modify` (Function, optional): Query modifier

**Returns:** `Function` - Resolver function

#### `graphql.presets.batch.hasOne(options)`

Create a resolver for hasOne relations.

#### `graphql.presets.batch.belongsTo(options)`

Create a resolver for belongsTo relations.

#### `graphql.presets.batch.belongsToMany(options)`

Create a resolver for belongsToMany (many-to-many) relations.

**Example:**
```javascript
const schema = graphql.type('Schema', {
  query: graphql.type('ObjectType', {
    name: 'Query',
    fields: {
      users: {
        type: graphql.type('List', graphql.model(User)),
        resolve: () => User.query()
      }
    }
  })
})

// In User model, add resolver for posts:
static get relations() {
  return {
    posts: User.hasMany(Post, {}, {
      resolve: graphql.presets.batch.hasMany({ model: Post })
    })
  }
}
```

### `graphql.presets.search`

Create a Relay-style connection resolver with filtering, sorting, and pagination.

**Parameters:**
- `items` (Object): Map of type names to configurations
  - `model` (Model): The model class
  - `resolverOptions` (Object, optional):
    - `sortable` (string[]): Sortable fields
    - `filterable` (string[]|Function): Filterable fields
    - `searchable` (string[]|Function): Searchable fields
    - `limit` (number, optional): Default limit
    - `cursorColumn` (string|string[], optional): Cursor column(s) for keyset pagination
    - `useOffset` (boolean, optional): Use offset-based pagination
- `options` (Object, optional):
  - `name` (string): Name suffix for types

**Returns:** `Object` - Field configuration for Query type

**Example:**
```javascript
const schema = graphql.type('Schema', {
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
})

// Query:
// {
//   search(type: USER, first: 10, after: "cursor", orderBy: "-createdAt") {
//     total
//     edges { cursor node { id name } }
//     pageInfo { hasNextPage endCursor }
//   }
// }
```

### `graphql.presets.mutation`

Create CRUD mutation resolvers.

**Parameters:**
- `model` (Model): The model class

**Returns:** `Object` - Mutation builder

**Methods:**

#### `.create(options?)`

Add a create mutation.

#### `.update(options?)`

Add an update mutation.

#### `.destroy(options?)`

Add a destroy mutation.

**Returns:** `{ mutations: Object }` - Object with mutation fields

**Example:**
```javascript
const schema = graphql.type('Schema', {
  query: graphql.type('ObjectType', {
    name: 'Query',
    fields: { /* ... */ }
  }),
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
})

// Mutations:
// createUser(input: { name: "John", email: "john@example.com" }) { id name }
// updateUser(input: { id: 1, patch: { name: "Jane" } }) { id name }
// destroyUser(input: { id: 1 }) { id }
```

### `graphql.presets.fetch`

Create a union-type fetch resolver.

**Parameters:**
- `items` (Object): Map of type names to configurations
  - `model` (Model): The model class
  - `idColumn` (string, optional): ID column
  - `resolve` (Function, optional): Custom resolver
  - `compose` (Function, optional): Compose resolver

**Returns:** `Object` - Field configuration

**Example:**
```javascript
const schema = graphql.type('Schema', {
  query: graphql.type('ObjectType', {
    name: 'Query',
    fields: {
      fetch: graphql.presets.fetch({
        USER: { model: User },
        POST: { model: Post }
      })
    }
  })
})

// Query:
// fetch(type: USER, id: "1") {
//   ... on User { id name }
//   ... on Post { id title }
// }
```

## Complete Example

```javascript
import { WebServer, Model, graphql } from 'solidify.js'

// Define models
class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string' },
    email: { type: 'string' }
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
    title: { type: 'string' },
    userId: { type: 'integer' }
  }
  static get relations() {
    return {
      user: Post.belongsTo(User)
    }
  }
}

// Create server
const app = new WebServer()

app.register(graphql.plugin({
  context: () => ({ loader: new graphql.Loader() }),
  schema: graphql.type('Schema', {
    query: graphql.type('ObjectType', {
      name: 'Query',
      fields: {
        // Fetch single item by ID
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
