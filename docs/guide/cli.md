# CLI Development Guide

Learn how to build command-line interfaces using Solidify's Command class.

## Overview

Solidify provides a declarative Command class built on top of [Commander.js](https://github.com/tj/commander.js). It simplifies CLI development with a clean, class-based API.

## Basic CLI

### Simple Command

```javascript
import { Command } from 'solidify.js'

class HelloCommand extends Command {
  name = 'hello'
  description = 'Say hello to someone'
  version = '1.0.0'
  
  arguments = {
    name: {
      placeholder: 'name',
      description: 'Name of the person to greet',
      optional: false
    }
  }
  
  options = {
    loud: {
      flag: '-l',
      help: 'Print greeting in uppercase'
    }
  }
  
  async action(name, options) {
    const greeting = `Hello, ${name}!`
    console.log(options.loud ? greeting.toUpperCase() : greeting)
  }
}

new HelloCommand().execute()
```

Run it:

```bash
node cli.mjs World        # Output: Hello, World!
node cli.mjs World -l     # Output: HELLO, WORLD!
node cli.mjs --help       # Show help
node cli.mjs --version    # Show version
```

### Using Subcommands

For more complex CLIs, define subcommands:

```javascript
import { Command } from 'solidify.js'

class AppCommand extends Command {
  name = 'myapp'
  description = 'My CLI application'
  version = '1.0.0'
  
  subcommands = {
    greet: {
      description: 'Greet someone',
      arguments: {
        name: {
          placeholder: 'name',
          description: 'Name to greet',
          optional: false
        }
      },
      options: {
        formal: {
          flag: '-f',
          help: 'Use formal greeting'
        }
      },
      action: async (name, options) => {
        console.log(options.formal ? `Good day, ${name}.` : `Hi, ${name}!`)
      }
    },
    
    farewell: {
      description: 'Say goodbye',
      arguments: {
        name: {
          placeholder: 'name',
          description: 'Name to say goodbye to',
          optional: false
        }
      },
      action: async (name) => {
        console.log(`Goodbye, ${name}!`)
      }
    }
  }
}

new AppCommand().execute()
```

Run subcommands:

```bash
node cli.mjs greet John          # Output: Hi, John!
node cli.mjs greet John -f       # Output: Good day, John.
node cli.mjs farewell John       # Output: Goodbye, John!
```

## Arguments

### Required Arguments

```javascript
arguments = {
  input: {
    placeholder: 'input',
    description: 'Input file path',
    optional: false  // Required
  }
}
```

### Optional Arguments

```javascript
arguments = {
  output: {
    placeholder: 'output',
    description: 'Output file path',
    optional: true  // Optional (default)
  }
}
```

### Variadic Arguments

Accept multiple values:

```javascript
arguments = {
  files: {
    placeholder: 'files',
    description: 'Files to process',
    multiple: true  // Accept multiple values
  }
}
```

Usage:

```bash
node cli.mjs file1.txt file2.txt file3.txt
```

### Argument Choices

Restrict to specific values:

```javascript
arguments = {
  format: {
    placeholder: 'format',
    description: 'Output format',
    choices: ['json', 'yaml', 'xml'],
    default: 'json'
  }
}
```

## Options

### Boolean Flags

```javascript
options = {
  verbose: {
    flag: '-v',
    help: 'Enable verbose output'
  },
  force: {
    flag: '-f',
    help: 'Force operation'
  }
}
```

### Options with Values

```javascript
options = {
  output: {
    flag: '-o',
    help: 'Output file path',
    type: 'input',
    placeholder: 'file'
  },
  
  level: {
    flag: '-l',
    help: 'Log level',
    type: 'input',
    choices: ['debug', 'info', 'warn', 'error'],
    default: 'info'
  }
}
```

Usage:

```bash
node cli.mjs -o result.txt
node cli.mjs --output result.txt
node cli.mjs -l debug
```

### Required Options

```javascript
options = {
  apiKey: {
    flag: '-k',
    help: 'API key for authentication',
    type: 'input',
    placeholder: 'key',
    required: true
  }
}
```

### Multiple Values

```javascript
options = {
  include: {
    flag: '-i',
    help: 'Files to include',
    type: 'input',
    placeholder: 'file',
    multiple: true
  }
}
```

Usage:

```bash
node cli.mjs -i file1.txt -i file2.txt
```

### Option Conflicts

Specify mutually exclusive options:

```javascript
options = {
  json: {
    flag: '-j',
    help: 'Output as JSON',
    conflicts: 'yaml'
  },
  yaml: {
    flag: '-y',
    help: 'Output as YAML',
    conflicts: 'json'
  }
}
```

### Option Implications

Set other options automatically:

```javascript
options = {
  production: {
    flag: '-p',
    help: 'Production mode',
    implies: { 
      optimize: true, 
      debug: false 
    }
  }
}
```

## State Management

Share state between the main command and subcommands:

```javascript
class AppCommand extends Command {
  name = 'myapp'
  
  subcommands = {
    config: {
      description: 'Set configuration',
      options: {
        db: {
          flag: '-d',
          help: 'Database URL',
          type: 'input',
          placeholder: 'url'
        }
      },
      action: async (options) => {
        this.setState({ dbUrl: options.db })
        console.log('Configuration saved')
      }
    },
    
    status: {
      description: 'Show current status',
      action: async () => {
        const state = this.state
        console.log('Database:', state?.dbUrl || 'not configured')
      }
    }
  }
}
```

## Database Migration CLI

A complete example for database management:

```javascript
import { Command, Model, knexMigration } from 'solidify.js'
import Knex from 'knex'
import { User } from './models/User.mjs'
import { Post } from './models/Post.mjs'
import { Comment } from './models/Comment.mjs'

const models = [User, Post, Comment]

class DbCommand extends Command {
  name = 'db'
  description = 'Database management commands'
  version = '1.0.0'
  
  // Shared database connection
  async getKnex() {
    return Knex({
      client: 'sqlite3',
      connection: { filename: './database.sqlite' },
      useNullAsDefault: true
    })
  }
  
  subcommands = {
    migrate: {
      description: 'Run database migrations',
      options: {
        drop: {
          flag: '-d, --drop',
          help: 'Drop existing tables before migration'
        },
        seed: {
          flag: '-s, --seed',
          help: 'Run seeders after migration'
        }
      },
      action: async (options) => {
        const knex = await this.getKnex()
        Model.knex(knex)
        
        console.log('Running migrations...')
        await knexMigration(models, { drop: options.drop })
        console.log('Migrations completed!')
        
        if (options.seed) {
          console.log('Running seeders...')
          // Run seeders here
        }
        
        await knex.destroy()
      }
    },
    
    reset: {
      description: 'Reset database (drop all tables and re-run migrations)',
      options: {
        seed: {
          flag: '-s, --seed',
          help: 'Run seeders after reset'
        }
      },
      action: async (options) => {
        const knex = await this.getKnex()
        Model.knex(knex)
        
        console.log('Resetting database...')
        await knexMigration(models, { drop: true })
        console.log('Database reset completed!')
        
        if (options.seed) {
          console.log('Running seeders...')
          // Run seeders here
        }
        
        await knex.destroy()
      }
    },
    
    seed: {
      description: 'Run database seeders',
      action: async () => {
        const knex = await this.getKnex()
        Model.knex(knex)
        
        console.log('Running seeders...')
        // Run seeders here
        console.log('Seeders completed!')
        
        await knex.destroy()
      }
    },
    
    status: {
      description: 'Show database status',
      action: async () => {
        const knex = await this.getKnex()
        
        for (const model of models) {
          const exists = await knex.schema.hasTable(model.tableName)
          const count = exists ? await knex(model.tableName).count('* as count').first() : { count: 0 }
          console.log(`${model.tableName}: ${exists ? '✓' : '✗'} (${count.count} records)`)
        }
        
        await knex.destroy()
      }
    }
  }
}

new DbCommand().execute()
```

Usage:

```bash
node cli.mjs db:migrate              # Run migrations
node cli.mjs db:migrate --drop       # Drop and recreate tables
node cli.mjs db:migrate --seed       # Migrate and seed
node cli.mjs db:reset                # Reset database
node cli.mjs db:seed                 # Run seeders only
node cli.mjs db:status               # Show table status
```

## Testing CLI Commands

Use the `throws` option for testing:

```javascript
import { Command } from 'solidify.js'
import assert from 'assert'

class TestCommand extends Command {
  name = 'test'
  description = 'Test command'
  
  arguments = {
    value: {
      placeholder: 'value',
      optional: false
    }
  }
  
  async action(value) {
    console.log(`Value: ${value}`)
  }
}

// Test help output
async function testHelp() {
  const cmd = new TestCommand()
  cmd.initialize({ throws: true })
  
  try {
    await cmd.execute(['node', 'test', '--help'])
  } catch (error) {
    // Commander throws after printing help
    assert(error.message.includes('help'))
  }
}

// Test argument parsing
async function testArgument() {
  const cmd = new TestCommand()
  cmd.initialize({ throws: true })
  
  // Capture console.log output
  const logs = []
  const originalLog = console.log
  console.log = (msg) => logs.push(msg)
  
  await cmd.execute(['node', 'test', 'hello'])
  
  console.log = originalLog
  assert.deepStrictEqual(logs, ['Value: hello'])
}
```

## Programmatic Usage

Execute commands programmatically:

```javascript
const cmd = new DbCommand()

// Run with custom arguments
await cmd.execute(['node', 'cli', 'db', 'migrate', '--drop'])

// Initialize without executing
cmd.initialize()
// Access the underlying Commander instance
cmd.program.name()  // 'db'
```

## Error Handling

```javascript
class SafeCommand extends Command {
  name = 'safe'
  
  async action(input, options) {
    try {
      // Your logic here
    } catch (error) {
      console.error('Error:', error.message)
      process.exit(1)
    }
  }
}
```

For custom error handling, override the initialization:

```javascript
initialize(config = {}) {
  super.initialize(config)
  
  this.program.exitOverride((error) => {
    if (error.code === 'commander.help') {
      process.exit(0)
    }
    console.error(error.message)
    process.exit(1)
  })
}
```

## Best Practices

1. **Naming**: Use clear, descriptive names for commands and options
2. **Help Text**: Provide helpful descriptions for all commands, arguments, and options
3. **Validation**: Let Commander handle argument validation
4. **Exit Codes**: Use appropriate exit codes (0 for success, non-zero for errors)
5. **Progress**: Show progress for long-running operations
6. **Dry Run**: Consider adding a `--dry-run` option for destructive operations

## Next Steps

- [Migrations Guide](./migrations.md) - Database schema management
- [Model Definition Guide](./model-definition.md) - Define your data models
- [API Reference: Command](../api/command.md) - Full Command API documentation
