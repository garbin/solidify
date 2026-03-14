import { Argument, Command as Commander, Option } from "commander"

/**
 * Argument configuration for CLI commands.
 */
export interface ArgumentConfig {
  /** Placeholder text for the argument */
  placeholder?: string
  /** Whether the argument is optional (default: true) */
  optional?: boolean
  /** Whether multiple values are allowed (default: true) */
  multiple?: boolean
  /** Argument description */
  description?: string
  /** Custom error message */
  errorMessage?: string
  /** Allowed values for the argument */
  choices?: string[]
  /** Default value */
  default?: unknown
}

/**
 * Option configuration for CLI commands.
 */
export interface OptionConfig {
  /** Short flag (e.g., '-v') */
  flag: string
  /** Help text */
  help?: string
  /** Option type: 'input' for value options, 'boolean' for flags */
  type?: "input" | "boolean"
  /** Placeholder for value */
  placeholder?: string
  /** Whether the value is optional */
  optional?: boolean
  /** Whether multiple values are allowed */
  multiple?: boolean
  /** Whether the option is required */
  required?: boolean
  /** Allowed values */
  choices?: string[]
  /** Default value */
  default?: unknown
  /** Conflicting option name */
  conflicts?: string
  /** Options to set when this option is used */
  implies?: Record<string, unknown>
}

/**
 * Subcommand configuration.
 */
export interface SubcommandConfig {
  /** Subcommand description */
  description?: string
  /** Argument definitions */
  arguments?: Record<string, ArgumentConfig>
  /** Option definitions */
  options?: Record<string, OptionConfig>
  /** Subcommand action handler */
  action: (...args: unknown[]) => Promise<void> | void
}

/**
 * Command initialization configuration.
 */
export interface CommandConfig {
  /** Whether to throw on error (useful for testing) */
  throws?: boolean
}

/**
 * Base class for building CLI commands using Commander.js.
 * Provides a declarative API for defining arguments, options, and subcommands.
 *
 * @example
 * ```typescript
 * class MyCommand extends Command {
 *   name = 'my-cli'
 *   description = 'My CLI tool'
 *   options = {
 *     verbose: { flag: '-v', help: 'Enable verbose output' }
 *   }
 *   async action(name: string, options: Record<string, unknown>) {
 *     console.log('Hello', name, options.verbose ? '(verbose)' : '')
 *   }
 * }
 * new MyCommand().execute()
 * ```
 */
export class Command {
  /** Command name */
  name: string = "Command Name"

  /** Command description */
  description: string = "Description"

  /** Command version */
  version: string = "1.0.0"

  /** Option definitions */
  options: Record<string, OptionConfig> = {}

  /** Argument definitions */
  arguments: Record<string, ArgumentConfig> = {}

  /** Subcommand definitions */
  subcommands: Record<string, SubcommandConfig> = {}

  /** Commander program instance */
  program: Commander | null = null

  #_state: unknown = null

  /**
   * Add an argument to the command.
   * @param name - Argument name
   * @param argument - Argument configuration
   * @param program - Commander program (defaults to this.program)
   */
  addArgument(
    name: string,
    argument: ArgumentConfig = {},
    program?: Commander | null,
  ): void {
    const targetProgram = program || this.program
    if (!targetProgram) return

    const {
      placeholder = name,
      optional = true,
      multiple = true,
      description,
      errorMessage,
    } = argument
    const argumentName = multiple ? `${placeholder}...` : placeholder
    const arg = new Argument(
      `${optional ? `[${argumentName}]` : `<${argumentName}>`}`,
      description,
    )

    if (argument.choices) arg.choices(argument.choices)
    if (argument.default !== undefined) arg.default(argument.default)
    targetProgram.addArgument(arg)
  }

  /**
   * Add an option to the command.
   * @param name - Option name (used as --name)
   * @param option - Option configuration
   * @param program - Commander program (defaults to this.program)
   * @returns The Commander program
   */
  addOption(
    name: string,
    option: OptionConfig,
    program?: Commander | null,
  ): Commander {
    const targetProgram = program || this.program
    if (!targetProgram) throw new Error("Program not initialized")

    let type = ""
    if (option.type === "input") {
      const typeName = `${option.placeholder ?? name}${option.multiple ? "..." : ""}`
      type = option.optional ? `[${typeName}]` : `<${typeName}>`
    }
    const opt = new Option(`${option.flag}, --${name} ${type}`, option.help)
    if (option.required) opt.makeOptionMandatory()
    if (option.choices) opt.choices(option.choices)
    if (option.default !== undefined) opt.default(option.default)
    if (option.conflicts) opt.conflicts(option.conflicts)
    if (option.implies) opt.implies(option.implies)
    return targetProgram.addOption(opt)
  }

  /**
   * Add a subcommand to the command.
   * @param cmdName - Subcommand name
   * @param config - Subcommand configuration
   * @returns The subcommand
   */
  addSubcommand(cmdName: string, config: SubcommandConfig): Commander {
    if (!this.program) throw new Error("Program not initialized")

    const command = this.program.command(cmdName)
    const { description, arguments: _arguments, options, action } = config
    if (description) command.description(description)
    for (const argName in _arguments) {
      this.addArgument(argName, _arguments[argName], command)
    }
    for (const optName in options) {
      this.addOption(optName, options[optName], command)
    }
    command.action(action.bind(this))

    return command
  }

  /**
   * Initialize the Commander program.
   * @param config - Configuration
   */
  initialize(config: CommandConfig = {}): void {
    const { throws = false } = config
    this.program = new Commander()
    this.program.enablePositionalOptions()
    this.program.name(this.name)
    this.program.description(this.description)
    this.program.version(this.version)
    for (const argName in this.arguments) {
      this.addArgument(argName, this.arguments[argName])
    }
    for (const optName in this.options) {
      this.addOption(optName, this.options[optName])
    }
    for (const cmdName in this.subcommands) {
      this.addSubcommand(cmdName, this.subcommands[cmdName])
    }
    if (throws) this.program.exitOverride()
  }

  /** Get the current state */
  get state(): unknown {
    return this.#_state
  }

  /**
   * Set the command state.
   * @param state - State value
   */
  setState(state: unknown): void {
    this.#_state = state
  }

  /**
   * Default action handler. Override this method to implement command logic.
   * @param _name - The first argument (if any)
   * @param _options - Parsed options
   */
  async action(
    _name?: string,
    _options?: Record<string, unknown>,
  ): Promise<void> {}

  /**
   * Execute the command.
   * @param argv - Command-line arguments
   */
  async execute(argv: string[] = process.argv): Promise<void> {
    if (!this.program) this.initialize()
    await this.program!.action(this.action.bind(this)).parse(argv)
  }
}
