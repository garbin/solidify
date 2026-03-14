# Utility Functions

## knexMigration

Database migration utility for creating and dropping tables.

### Signature

```javascript
import { knexMigration } from 'solidify.js'

await knexMigration(models, options?)
```

### Parameters

- `models` (Model[]): Array of model classes to migrate
- `options` (Object, optional):
  - `drop` (boolean, default: `false`): If true, drop tables instead of creating
  - `knex` (Knex, optional): Knex instance (defaults to `Model.knex()`)

### Returns

`Promise<void>`

### Examples

#### Create Tables

```javascript
import { knexMigration, Model } from 'solidify.js'

class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string' }
  }
}

class Post extends Model {
  static tableName = 'posts'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    title: { type: 'string' },
    userId: { type: 'integer' }
  }
}

// Create tables
await knexMigration([User, Post])
```

#### Drop and Recreate Tables

```javascript
// Drop tables
await knexMigration([User, Post], { drop: true })

// Recreate tables
await knexMigration([User, Post])
```

#### With Custom Knex Instance

```javascript
import Knex from 'knex'

const knex = Knex({
  client: 'pg',
  connection: 'postgres://localhost/mydb'
})

await knexMigration([User, Post], { knex })
```

---

## Validator Class

Custom validator class that uses Yup for model validation.

### Signature

```javascript
import { Validator } from 'solidify.js'

const validator = new Validator(schema)
```

### Constructor

**Parameters:**
- `schema` (Object): Yup schema object (built from model fields)

### Methods

#### `validate(params)`

Validate a JSON object against the schema.

**Parameters:**
- `params` (Object):
  - `json` (Object): The JSON object to validate
  - `options` (Object, optional):
    - `patch` (boolean): If true, only validate fields present in json

**Returns:** `Object` - The validated JSON object

**Throws:** `ValidationError` if validation fails

### Examples

#### Basic Validation

```javascript
import { Model } from 'solidify.js'

class User extends Model {
  static tableName = 'users'
  static fields = {
    name: { type: 'string', validator: { required: 'Name is required' } },
    email: { type: 'string', validator: { email: 'Invalid email' } }
  }
}

const validator = User.createValidator()

// Valid data
const valid = validator.validate({ json: { name: 'John', email: 'john@example.com' } })
// { name: 'John', email: 'john@example.com' }

// Invalid data throws ValidationError
try {
  validator.validate({ json: { email: 'invalid' } })
} catch (error) {
  console.log(error.inner[0].path) // 'name'
  console.log(error.inner[0].message) // 'Name is required'
}
```

#### Patch Validation

```javascript
// Only validate fields present in the input
const partial = validator.validate({
  json: { name: 'John' },
  options: { patch: true }
})
// Only validates 'name', email is not required
```

---

## Model.createValidator()

Create a validator instance for a model.

**Returns:** `Validator`

**Example:**
```javascript
const validator = User.createValidator()
```

---

## Error Handling

### ValidationError

When validation fails, a Yup `ValidationError` is thrown with:

- `name`: Always `'ValidationError'`
- `message`: General error message
- `inner`: Array of all validation errors
  - `path`: Field path
  - `message`: Error message
  - `type`: Error type (e.g., `'required'`, `'email'`)

**Example:**
```javascript
import { ValidationError } from 'yup'

try {
  await User.query().insert({ email: 'invalid' })
} catch (error) {
  if (error instanceof ValidationError) {
    error.inner.forEach(err => {
      console.log(`${err.path}: ${err.message}`)
    })
  }
}
```
