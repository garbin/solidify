# Database Migrations Guide

Learn how to create and manage database schemas using Solidify's migration utilities.

## Overview

Solidify provides a simple migration system that generates database tables directly from your model definitions. This approach ensures your database schema stays in sync with your models.

## Basic Migration

### Creating Tables

Use the `knexMigration` function to create tables from your models:

```javascript
import { Model, knexMigration } from 'solidify.js'
import Knex from 'knex'

// Define your models
class User extends Model {
  static tableName = 'users'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string' },
    email: { type: 'string', constraints: { unique: true } }
  }
}

class Post extends Model {
  static tableName = 'posts'
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    title: { type: 'string' },
    userId: { type: 'integer', constraints: { references: 'users.id' } }
  }
}

// Initialize database connection
const knex = Knex({
  client: 'sqlite3',
  connection: { filename: './database.sqlite' },
  useNullAsDefault: true
})
Model.knex(knex)

// Run migration
await knexMigration([User, Post])
```

### Drop and Recreate

Use the `drop` option to drop existing tables before creating new ones:

```javascript
await knexMigration([User, Post], { drop: true })
```

> **Warning:** This will delete all data in the tables. Use only in development or when you intend to reset the database.

## Model.createTable Method

Each model has a `createTable` static method for individual table creation:

```javascript
// Create a single table
await User.createTable()

// With custom schema builder
await User.createTable(knex.schema)
```

## Table Generation from Fields

Solidify automatically generates the appropriate column types from your field definitions:

### Column Types

| Field Type | Knex Method |
|------------|-------------|
| `increments` | `table.increments()` |
| `integer` | `table.integer()` |
| `bigInteger` | `table.bigInteger()` |
| `string` | `table.string()` |
| `text` | `table.text()` |
| `boolean` | `table.boolean()` |
| `float` | `table.float()` |
| `decimal` | `table.decimal()` |
| `date` | `table.date()` |
| `datetime` | `table.datetime()` |
| `time` | `table.time()` |
| `timestamp` | `table.timestamp()` |
| `uuid` | `table.uuid()` |
| `json` | `table.json()` |
| `jsonb` | `table.jsonb()` |
| `enum` | `table.enu()` |

### String Length

Specify string length using array syntax:

```javascript
static fields = {
  code: { type: ['string', 10] },  // VARCHAR(10)
  description: { type: ['string', 255] }  // VARCHAR(255)
}
```

### Enum Values

Define enum values with array syntax:

```javascript
static fields = {
  status: { 
    type: ['enum', ['draft', 'published', 'archived']] 
  }
}
```

## Column Constraints

Constraints are applied during migration:

```javascript
static fields = {
  id: { 
    type: 'increments', 
    constraints: { primary: true } 
  },
  
  email: { 
    type: 'string', 
    constraints: { 
      unique: true,
      notNullable: true 
    } 
  },
  
  age: { 
    type: 'integer', 
    constraints: { 
      unsigned: true,
      defaultTo: 0 
    } 
  },
  
  userId: { 
    type: 'integer',
    constraints: {
      references: 'users.id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }
  }
}
```

### Available Constraints

| Constraint | Description |
|------------|-------------|
| `primary` | Primary key |
| `unique` | Unique constraint |
| `notNullable` | Cannot be null |
| `nullable` | Can be null |
| `unsigned` | Positive numbers only |
| `defaultTo` | Default value |
| `references` | Foreign key reference (e.g., `'users.id'`) |
| `onDelete` | Foreign key action (`'CASCADE'`, `'SET NULL'`, etc.) |
| `onUpdate` | Foreign key action on update |
| `comment` | Column comment |

## Table-Level Constraints

Define table-level constraints using the `constraints` static property:

```javascript
class User extends Model {
  static tableName = 'users'
  
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    email: { type: 'string' },
    firstName: { type: 'string' },
    lastName: { type: 'string' }
  }
  
  // Object format
  static constraints = {
    unique: ['email'],
    index: [['firstName', 'lastName']]
  }
}

// Or array format for multiple constraints of the same type
class Article extends Model {
  static constraints = [
    { type: 'unique', args: ['slug'] },
    { type: 'index', args: [['status', 'publishedAt']] },
    { type: 'index', args: ['authorId'] }
  ]
}
```

## Building a Migration CLI

Create a command-line tool for running migrations:

```javascript
// cli.mjs
import { Command, Model, knexMigration } from 'solidify.js'
import Knex from 'knex'
import { User } from './models/User.mjs'
import { Post } from './models/Post.mjs'

class MigrationCommand extends Command {
  name = 'db'
  description = 'Database migration commands'
  version = '1.0.0'
  
  subcommands = {
    migrate: {
      description: 'Run database migrations',
      options: {
        drop: {
          flag: '-d, --drop',
          help: 'Drop existing tables before migration',
          type: 'boolean'
        }
      },
      action: async (options) => {
        const knex = Knex({
          client: 'sqlite3',
          connection: { filename: './database.sqlite' },
          useNullAsDefault: true
        })
        Model.knex(knex)
        
        console.log('Running migrations...')
        await knexMigration([User, Post], { drop: options.drop })
        console.log('Migrations completed!')
        
        await knex.destroy()
      }
    },
    
    reset: {
      description: 'Reset database (drop and recreate all tables)',
      action: async () => {
        const knex = Knex({
          client: 'sqlite3',
          connection: { filename: './database.sqlite' },
          useNullAsDefault: true
        })
        Model.knex(knex)
        
        console.log('Resetting database...')
        await knexMigration([User, Post], { drop: true })
        console.log('Database reset completed!')
        
        await knex.destroy()
      }
    }
  }
}

new MigrationCommand().execute()
```

Run migrations:

```bash
node cli.mjs db:migrate
node cli.mjs db:migrate --drop
node cli.mjs db:reset
```

## Production Considerations

### Using Knex Migrations

For production environments, consider using Knex's built-in migration system for better control:

```javascript
// migrations/20240101000000_create_users.js
export async function up(knex) {
  return knex.schema.createTable('users', (table) => {
    table.increments('id').primary()
    table.string('name').notNullable()
    table.string('email').unique().notNullable()
    table.timestamps(true, true)
  })
}

export async function down(knex) {
  return knex.schema.dropTable('users')
}
```

Run with Knex CLI:

```bash
npx knex migrate:latest
npx knex migrate:rollback
```

### Combining with Solidify

You can generate migration files from your models:

```javascript
// scripts/generate-migration.mjs
import { User, Post } from './models/index.mjs'
import fs from 'fs/promises'

async function generateMigration(model) {
  const tableName = model.tableName
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const filename = `migrations/${timestamp}_create_${tableName}.js`
  
  // Generate migration content based on model.fields
  // ... (implementation depends on your needs)
  
  await fs.writeFile(filename, content)
}

await generateMigration(User)
await generateMigration(Post)
```

## Database Connection

### Model.connect Shortcut

Use the static `connect` method for quick setup:

```javascript
import { Model } from 'solidify.js'

const knex = Model.connect({
  client: 'pg',
  connection: process.env.DATABASE_URL
})

// Now all models have access to the knex instance
```

### Multiple Databases

For multiple database connections:

```javascript
import { Model } from 'solidify.js'
import Knex from 'knex'

const mainDb = Knex({
  client: 'pg',
  connection: process.env.MAIN_DB_URL
})

const analyticsDb = Knex({
  client: 'pg',
  connection: process.env.ANALYTICS_DB_URL
})

// Bind to specific models
Model.knex(mainDb)

// Or override per model
class AnalyticsModel extends Model {
  static createTable(schema = null) {
    return super.createTable(schema || analyticsDb.schema)
  }
}
```

## Best Practices

1. **Development**: Use `knexMigration` with `drop: true` for rapid prototyping
2. **Production**: Use Knex migrations for version-controlled schema changes
3. **Testing**: Reset database before each test suite
4. **CI/CD**: Run migrations as part of your deployment pipeline
5. **Backups**: Always backup before running destructive migrations in production

## Error Handling

```javascript
try {
  await knexMigration([User, Post])
} catch (error) {
  if (error.code === 'SQLITE_ERROR') {
    console.error('Database error:', error.message)
  } else {
    throw error
  }
}
```

## Next Steps

- [CLI Development Guide](./cli.md) - Build powerful CLI tools
- [Model Definition Guide](./model-definition.md) - Define fields and relationships
- [REST API Guide](./rest-api.md) - Create RESTful endpoints
