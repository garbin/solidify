# Model Class

Enhanced Objection.js Model class with field definitions, validation, and automatic migrations.

## Overview

The `Model` class extends Objection.js's base Model to provide:
- Declarative field definitions with types and constraints
- Automatic Yup validation schema generation
- Timestamp handling for `createdAt` and `updatedAt` fields
- Formatter/parser support for field transformations
- Relation shortcuts for common relationship types
- Automatic table creation via Knex migrations

## Signature

```javascript
import { Model } from 'solidify.js'

class MyModel extends Model {
  static tableName = 'my_table'
  static fields = { ... }
  static constraints = { ... }
  static get relations() { return { ... } }
  static get virtualFields() { return { ... } }
}
```

## Static Properties

### `tableName`

The database table name for this model. **Required.**

```javascript
static tableName = 'users'
```

### `fields`

Object defining all database columns with their types, constraints, and validators.

```javascript
static fields = {
  id: { type: 'increments', constraints: { primary: true } },
  name: { type: 'string', validator: { required: 'Name is required' } },
  email: { type: 'string', validator: { email: 'Invalid email' } },
  age: { type: 'integer', constraints: { unsigned: true } },
  status: { type: ['enum', ['active', 'inactive']] },
  createdAt: { type: 'timestamp', timestamp: 'insert' },
  updatedAt: { type: 'timestamp', timestamp: 'update' }
}
```

#### Field Types

| Type | Description | Validator Generated |
|------|-------------|---------------------|
| `increments` | Auto-incrementing primary key | `yup.number().integer()` |
| `integer` | Integer number | `yup.number().integer()` |
| `bigInteger` | Big integer | `yup.number().integer()` |
| `string` | String (varchar) | `yup.string()` |
| `text` | Text field | `yup.string()` |
| `float` | Floating point | `yup.number()` |
| `decimal` | Decimal number | `yup.number()` |
| `boolean` | Boolean | `yup.boolean()` |
| `date` | Date | `yup.date()` |
| `datetime` | DateTime | `yup.date()` |
| `timestamp` | Timestamp | `yup.date()` |
| `uuid` | UUID | `yup.string().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[8|9|a|b][0-9a-f]{3}-[0-9a-f]{12}$/i)` |
| `json` | JSON object/array | Custom object/array validator |
| `jsonb` | JSONB (PostgreSQL) | Same as json |
| `enum` | Enum value | `yup.mixed().oneOf([...values])` |

#### Field Configuration

```javascript
{
  type: 'string',                    // Column type (required)
  constraints: {                      // Knex column constraints
    primary: true,                    // Primary key
    unique: true,                     // Unique constraint
    nullable: true,                   // Allow NULL
    notNullable: true,                // Disallow NULL
    unsigned: true,                   // Unsigned integer
    defaultTo: 'value',               // Default value
    references: 'other.id',           // Foreign key reference
    onDelete: 'CASCADE',              // ON DELETE action
    onUpdate: 'CASCADE',              // ON UPDATE action
    comment: 'Description'            // Column comment
  },
  validator: {                        // Yup validation rules
    required: 'Error message',        // Required field
    email: 'Invalid email',           // Email validation
    min: [5, 'Min 5 chars'],          // Minimum length
    max: [100, 'Max 100 chars'],      // Maximum length
    matches: [/regex/, 'Invalid']     // Pattern match
  },
  formatter: (value) => value.toUpperCase(),  // Transform before save
  parser: (value) => value.toLowerCase(),     // Transform after fetch
  timestamp: 'insert' | 'update'      // Auto-timestamp
}
```

### `constraints`

Table-level constraints applied during migration.

```javascript
static constraints = {
  unique: ['email'],                  // Single column unique
  // Or array format:
  // [
  //   { type: 'unique', args: ['email'] },
  //   { type: 'index', args: ['status'] }
  // ]
}
```

### `relations`

Define relationships to other models.

```javascript
static get relations() {
  return {
    posts: User.hasMany(Post),
    profile: User.hasOne(Profile),
    company: User.belongsTo(Company),
    roles: User.manyToMany(Role, { throughTable: 'user_roles' })
  }
}
```

### `virtualFields`

Define computed properties with their GraphQL types.

```javascript
static get virtualFields() {
  return {
    fullName: 'string',
    age: 'integer',
    isActive: 'boolean'
  }
}

get fullName() {
  return `${this.firstName} ${this.lastName}`
}
```

## Static Methods

### `connect(knexConfig)`

Create a Knex instance and bind it to all models.

**Parameters:**
- `knexConfig` (Object): Knex configuration object

**Returns:** `Knex` - The Knex instance

**Example:**
```javascript
import { Model } from 'solidify.js'

Model.connect({
  client: 'pg',
  connection: 'postgres://user:pass@localhost:5432/mydb'
})
```

### `createTable([schema])`

Create the database table for this model.

**Parameters:**
- `schema` (Knex.SchemaBuilder, optional): Schema builder (defaults to `Model.knex().schema`)

**Returns:** `Promise<void>`

**Example:**
```javascript
await User.createTable()
```

### `upsert(where, data)`

Upsert a record - update if exists, insert if not.

**Parameters:**
- `where` (Object): Conditions to find existing record
- `data` (Object): Data to insert or update

**Returns:** `Promise<Model>` - The upserted model instance

**Example:**
```javascript
const user = await User.upsert(
  { email: 'test@example.com' },
  { name: 'John', email: 'test@example.com' }
)
```

### `findRelation(child, types)`

Find a relation to a child model by type.

**Parameters:**
- `child` (Model): The child model class
- `types` (string|string[]): Relation type(s) to search for

**Returns:** `{name: string, info: Object}` - The relation name and info

**Throws:** `Error` if relation is not found

### `createValidator()`

Create a Validator instance for this model.

**Returns:** `Validator` - Validator instance

### Relation Shortcuts

#### `hasMany(modelClass, [join], [graphql])`

Define a HasMany relation.

```javascript
static get relations() {
  return {
    posts: User.hasMany(Post)
  }
}
```

#### `hasOne(modelClass, [join], [graphql])`

Define a HasOne relation.

```javascript
static get relations() {
  return {
    profile: User.hasOne(Profile)
  }
}
```

#### `belongsTo(modelClass, [join])`

Define a BelongsToOne relation.

```javascript
static get relations() {
  return {
    company: User.belongsTo(Company)
  }
}
```

#### `manyToMany(modelClass, [join])`

Define a ManyToMany relation.

```javascript
static get relations() {
  return {
    roles: User.manyToMany(Role, { throughTable: 'user_roles' })
  }
}
```

## Instance Methods

### `$beforeInsert(queryContext)`

Lifecycle hook called before insert. Handles automatic timestamps.

### `$beforeUpdate(opt, queryContext)`

Lifecycle hook called before update. Handles automatic timestamps.

### `$formatDatabaseJson(json)`

Transform data before saving to database. Applies field formatters.

### `$parseDatabaseJson(json)`

Transform data after fetching from database. Applies field parsers.

## Static Getters

### `foreignKeyName`

Returns the default foreign key name for this model.

```javascript
User.foreignKeyName // 'userId'
```

### `formatter`

Returns an object mapping field names to formatter functions.

### `parser`

Returns an object mapping field names to parser functions.

### `validator`

Returns the Yup schema object for this model.

### `virtualAttributes`

Returns an array of virtual attribute names.

## Examples

### Basic Model

```javascript
import { Model } from 'solidify.js'

class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string', validator: { required: 'Name is required' } },
    email: { 
      type: 'string', 
      validator: { 
        required: 'Email is required',
        email: 'Invalid email format'
      }
    },
    age: { 
      type: 'integer',
      constraints: { unsigned: true }
    },
    createdAt: { type: 'timestamp', timestamp: 'insert' },
    updatedAt: { type: 'timestamp', timestamp: 'update' }
  }
}
```

### Model with Relations

```javascript
class User extends Model {
  static tableName = 'users'
  static fields = { /* ... */ }
  
  static get relations() {
    return {
      posts: User.hasMany(Post),
      profile: User.hasOne(Profile),
      roles: User.manyToMany(Role, { throughTable: 'user_roles' })
    }
  }
}
```

### Model with Virtual Fields

```javascript
class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    firstName: { type: 'string' },
    lastName: { type: 'string' }
  }
  
  static get virtualFields() {
    return { fullName: 'string' }
  }
  
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }
}
```

### Model with Formatters/Parsers

```javascript
class User extends Model {
  static fields = {
    email: {
      type: 'string',
      formatter: (v) => v.toLowerCase(),
      parser: (v) => v.toLowerCase()
    }
  }
}
```
