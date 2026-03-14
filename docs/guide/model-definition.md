# Model Definition Guide

Learn how to define models with fields, validation, and relationships.

## Basic Model

```javascript
import { Model } from 'solidify.js'

class User extends Model {
  static tableName = 'users'
  
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    name: { type: 'string' },
    email: { type: 'string' }
  }
}
```

## Field Types

### Numeric Types

```javascript
static fields = {
  // Auto-incrementing primary key
  id: { type: 'increments', constraints: { primary: true } },
  
  // Integer
  age: { type: 'integer' },
  
  // Big integer
  bigNumber: { type: 'bigInteger' },
  
  // Float
  price: { type: 'float' },
  
  // Decimal with precision
  amount: { type: 'decimal', constraints: { precision: 10, scale: 2 } }
}
```

### String Types

```javascript
static fields = {
  // String (varchar)
  name: { type: 'string' },
  
  // String with max length
  code: { type: ['string', 10] },
  
  // Text (unlimited length)
  content: { type: 'text' }
}
```

### Date and Time

```javascript
static fields = {
  // Date
  birthDate: { type: 'date' },
  
  // DateTime
  publishedAt: { type: 'datetime' },
  
  // Time
  openTime: { type: 'time' },
  
  // Timestamp (auto-set)
  createdAt: { type: 'timestamp', timestamp: 'insert' },
  updatedAt: { type: 'timestamp', timestamp: 'update' }
}
```

### Other Types

```javascript
static fields = {
  // Boolean
  active: { type: 'boolean' },
  
  // UUID
  uuid: { type: 'uuid' },
  
  // Enum
  status: { type: ['enum', ['draft', 'published', 'archived']] },
  
  // JSON
  metadata: { type: 'json' },
  
  // JSONB (PostgreSQL)
  settings: { type: 'jsonb' }
}
```

## Column Constraints

```javascript
static fields = {
  id: { 
    type: 'increments', 
    constraints: { 
      primary: true 
    } 
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
      onDelete: 'CASCADE'
    }
  },
  
  description: {
    type: 'text',
    constraints: {
      nullable: true,
      comment: 'User description'
    }
  }
}
```

## Validation

### Built-in Validators

```javascript
static fields = {
  // Required field
  name: { 
    type: 'string',
    validator: { required: 'Name is required' }
  },
  
  // Email validation
  email: { 
    type: 'string',
    validator: { 
      required: 'Email is required',
      email: 'Invalid email format'
    }
  },
  
  // Min/Max length
  password: { 
    type: 'string',
    validator: {
      min: [8, 'Password must be at least 8 characters'],
      max: [100, 'Password too long']
    }
  },
  
  // Pattern matching
  phone: { 
    type: 'string',
    validator: {
      matches: [/^\d{10}$/, 'Invalid phone number']
    }
  }
}
```

### Custom Validation Rules

```javascript
static fields = {
  username: { 
    type: 'string',
    validator: {
      required: true,
      test: {
        name: 'unique-username',
        message: 'Username already taken',
        test: async (value) => {
          const existing = await User.query().where('username', value).first()
          return !existing
        }
      }
    }
  }
}
```

## Formatters and Parsers

Transform data when saving/loading from database:

```javascript
static fields = {
  email: {
    type: 'string',
    // Transform before saving to database
    formatter: (value) => value.toLowerCase().trim(),
    // Transform after loading from database
    parser: (value) => value.toLowerCase()
  },
  
  password: {
    type: 'string',
    formatter: (value) => hashPassword(value)
  },
  
  config: {
    type: 'json',
    formatter: (value) => JSON.stringify(value),
    parser: (value) => JSON.parse(value)
  }
}
```

## Virtual Fields

Computed properties that don't exist in the database:

```javascript
class User extends Model {
  static fields = {
    firstName: { type: 'string' },
    lastName: { type: 'string' }
  }
  
  static get virtualFields() {
    return {
      fullName: 'string',
      initials: 'string'
    }
  }
  
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }
  
  get initials() {
    return `${this.firstName[0]}${this.lastName[0]}`
  }
}
```

## Relationships

### HasMany

One-to-many relationship:

```javascript
class User extends Model {
  static tableName = 'users'
  
  static get relations() {
    return {
      posts: User.hasMany(Post)
    }
  }
}

class Post extends Model {
  static tableName = 'posts'
  static fields = {
    userId: { type: 'integer' }
  }
}
```

### HasOne

One-to-one relationship:

```javascript
class User extends Model {
  static get relations() {
    return {
      profile: User.hasOne(Profile)
    }
  }
}

class Profile extends Model {
  static fields = {
    userId: { type: 'integer' }
  }
}
```

### BelongsTo

Inverse of HasOne/HasMany:

```javascript
class Post extends Model {
  static get relations() {
    return {
      user: Post.belongsTo(User)
    }
  }
}
```

### ManyToMany

Many-to-many relationship with join table:

```javascript
class User extends Model {
  static get relations() {
    return {
      roles: User.manyToMany(Role, { 
        throughTable: 'user_roles' 
      })
    }
  }
}

class Role extends Model {
  static get relations() {
    return {
      users: Role.manyToMany(User, { 
        throughTable: 'user_roles' 
      })
    }
  }
}
```

## Table Constraints

Define table-level constraints:

```javascript
class User extends Model {
  static fields = {
    id: { type: 'increments', constraints: { primary: true } },
    email: { type: 'string' }
  }
  
  static constraints = {
    unique: ['email']
  }
}

// Or array format for multiple constraints:
static constraints = [
  { type: 'unique', args: ['email'] },
  { type: 'index', args: ['status'] }
]
```

## Complete Example

```javascript
import { Model } from 'solidify.js'

class Article extends Model {
  static tableName = 'articles'
  
  static fields = {
    id: { 
      type: 'increments', 
      constraints: { primary: true } 
    },
    title: { 
      type: 'string',
      validator: { 
        required: 'Title is required',
        min: [5, 'Title too short']
      }
    },
    slug: {
      type: 'string',
      constraints: { unique: true },
      formatter: (v) => v.toLowerCase().replace(/\s+/g, '-')
    },
    content: { type: 'text' },
    status: { 
      type: ['enum', ['draft', 'published', 'archived']],
      constraints: { defaultTo: 'draft' }
    },
    viewCount: {
      type: 'integer',
      constraints: { unsigned: true, defaultTo: 0 }
    },
    authorId: {
      type: 'integer',
      constraints: { references: 'users.id', onDelete: 'CASCADE' }
    },
    publishedAt: { type: 'datetime' },
    createdAt: { type: 'timestamp', timestamp: 'insert' },
    updatedAt: { type: 'timestamp', timestamp: 'update' }
  }
  
  static constraints = {
    index: ['status', 'publishedAt']
  }
  
  static get virtualFields() {
    return {
      excerpt: 'string',
      isPublished: 'boolean'
    }
  }
  
  get excerpt() {
    return this.content?.substring(0, 200) || ''
  }
  
  get isPublished() {
    return this.status === 'published'
  }
  
  static get relations() {
    return {
      author: Article.belongsTo(User),
      comments: Article.hasMany(Comment),
      tags: Article.manyToMany(Tag, { throughTable: 'article_tags' })
    }
  }
}
```
