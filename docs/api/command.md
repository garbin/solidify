# Command Class

Base class for building CLI commands using Commander.js.

## Overview

The `Command` class provides a declarative API for defining CLI commands with:
- Arguments and options configuration
- Subcommands support
- State management
- Automatic help generation

## Signature

```javascript
import { Command } from 'solidify.js'

class MyCommand extends Command {
  name = 'my-cli'
  description = 'My CLI tool'
  version = '1.0.0'
  options = { ... }
  arguments = { ... }
  subcommands = { ... }
  
  async action(name, options) {
    // Command logic
  }
}
```

## Instance Properties

### `name`

The command name displayed in help.

```javascript
name = 'my-cli'
```

### `description`

Command description for help text.

```javascript
description = 'A CLI tool for doing things'
```

### `version`

Command version (displayed with `--version`).

```javascript
version = '1.0.0'
```

### `options`

Object defining command options (flags).

```javascript
options = {
  verbose: {
    type: 'boolean',           // 'boolean' for flags, 'input' for values
    flag: '-v',                // Short flag
    help: 'Enable verbose output',
    required: false,           // Make option required
    default: false,            // Default value
    placeholder: 'level',      // Placeholder for input type
    optional: true,            // Value is optional
    multiple: true,            // Allow multiple values
    choices: ['a', 'b'],       // Allowed values
    conflicts: 'quiet',        // Conflicting option
    implies: { log: true }     // Options to set when this is used
  }
}
```

### `arguments`

Object defining command arguments.

```javascript
arguments = {
  file: {
    optional: false,           // Whether argument is optional
    multiple: true,            // Allow multiple values
    description: 'Input file',
    default: 'index.js',       // Default value
    choices: ['js', 'ts'],     // Allowed values
    errorMessage: 'File required'
  }
}
```

### `subcommands`

Object defining subcommands.

```javascript
subcommands = {
  install: {
    description: 'Install a package',
    arguments: {
      package: { optional: false }
    },
    options: {
      dev: { flag: '-D', help: 'Install as dev dependency' }
    },
    action: async function(pkg, opts) {
      console.log(`Installing ${pkg}...`)
    }
  }
}
```

## Instance Methods

### `initialize(config?)`

Initialize the Commander program.

**Parameters:**
- `config` (Object, optional):
  - `throws` (boolean, default: `false`): Whether to throw on error (useful for testing)

**Example:**
```javascript
const cmd = new MyCommand()
cmd.initialize({ throws: true })
```

### `execute(argv?)`

Parse arguments and execute the command.

**Parameters:**
- `argv` (string[], default: `process.argv`): Command-line arguments

**Returns:** `Promise<void>`

**Example:**
```javascript
const cmd = new MyCommand()
await cmd.execute(process.argv)
```

### `setState(state)`

Set the command state.

**Parameters:**
- `state` (any): State value

**Example:**
```javascript
this.setState({ result: 'success' })
```

### `action(name, options)`

Override this method to implement command logic.

**Parameters:**
- `name` (string): The first argument (if any)
- `options` (Object): Parsed options

**Example:**
```javascript
async action(name, options) {
  if (options.verbose) {
    console.log('Verbose mode enabled')
  }
  console.log(`Hello, ${name}!`)
}
```

## Examples

### Basic Command

```javascript
import { Command } from 'solidify.js'

class GreetCommand extends Command {
  name = 'greet'
  description = 'Greet someone'
  version = '1.0.0'
  
  arguments = {
    name: {
      optional: false,
      description: 'Name to greet'
    }
  }
  
  options = {
    loud: {
      type: 'boolean',
      flag: '-l',
      help: 'Greet loudly'
    }
  }
  
  async action(name, options) {
    const message = options.loud 
      ? `HELLO, ${name.toUpperCase()}!`
      : `Hello, ${name}!`
    console.log(message)
  }
}

// Run: greet John --loud
// Output: HELLO, JOHN!
```

### Command with Options

```javascript
class BuildCommand extends Command {
  name = 'build'
  description = 'Build the project'
  
  options = {
    output: {
      type: 'input',
      flag: '-o',
      help: 'Output directory',
      placeholder: 'dir',
      default: 'dist'
    },
    minify: {
      type: 'boolean',
      flag: '-m',
      help: 'Minify output'
    },
    sourcemap: {
      type: 'boolean',
      flag: '-s',
      help: 'Generate sourcemaps'
    }
  }
  
  async action(_name, options) {
    console.log(`Building to ${options.output}...`)
    if (options.minify) console.log('Minifying...')
    if (options.sourcemap) console.log('Generating sourcemaps...')
  }
}
```

### Command with Subcommands

```javascript
class CliCommand extends Command {
  name = 'mycli'
  description = 'My CLI tool'
  version = '1.0.0'
  
  subcommands = {
    init: {
      description: 'Initialize a new project',
      options: {
        template: {
          type: 'input',
          flag: '-t',
          help: 'Project template',
          choices: ['basic', 'typescript', 'react']
        }
      },
      action: async function(_args, opts) {
        console.log(`Initializing with template: ${opts.template || 'basic'}`)
      }
    },
    
    build: {
      description: 'Build the project',
      options: {
        watch: {
          type: 'boolean',
          flag: '-w',
          help: 'Watch for changes'
        }
      },
      action: async function(_args, opts) {
        console.log(`Building... ${opts.watch ? '(watch mode)' : ''}`)
      }
    }
  }
}

// Run: mycli init -t react
// Run: mycli build -w
```

### Command with Multiple Arguments

```javascript
class CopyCommand extends Command {
  name = 'copy'
  description = 'Copy files'
  
  arguments = {
    files: {
      multiple: true,
      optional: false,
      description: 'Files to copy'
    }
  }
  
  options = {
    destination: {
      type: 'input',
      flag: '-d',
      help: 'Destination directory',
      required: true,
      placeholder: 'dir'
    }
  }
  
  async action(files, options) {
    console.log(`Copying ${files.join(', ')} to ${options.destination}`)
  }
}

// Run: copy file1.txt file2.txt -d ./backup
```

### Command with Conflicting Options

```javascript
class LogCommand extends Command {
  name = 'log'
  description = 'Log output'
  
  options = {
    json: {
      type: 'boolean',
      flag: '-j',
      help: 'Output as JSON',
      conflicts: 'text'
    },
    text: {
      type: 'boolean',
      flag: '-t',
      help: 'Output as text',
      conflicts: 'json'
    }
  }
  
  async action(_name, options) {
    // Only one of json or text can be used
    console.log(options.json ? '{"status": "ok"}' : 'Status: OK')
  }
}
```

### Testing Commands

```javascript
import test from 'ava'

test('command executes correctly', async (t) => {
  class TestCommand extends Command {
    name = 'test'
    options = {
      value: { type: 'input', flag: '-v' }
    }
    action(_name, opts) {
      this.setState({ value: opts.value })
    }
  }
  
  const cmd = new TestCommand()
  cmd.initialize({ throws: true })
  await cmd.execute(['', '', '-v', 'hello'])
  
  t.is(cmd.state.value, 'hello')
})
```
