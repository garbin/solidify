import { Argument, Command as Commander, Option } from "commander"
export class Command {
  name = "Command Name"
  description = "Description"
  version = "1.0.0"
  options = {}
  arguments = {}
  subcommands = {}
  program = null
  #_state = null

  addArgument(name, argument = {}, program) {
    program = program || this.program
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
      errorMessage,
    )

    if (argument.choices) arg.choices(argument.choices)
    if (argument.default) arg.default(argument.default)
    program.addArgument(arg)
  }

  addOption(name, option, program) {
    program = program || this.program
    let type = ""
    if (option.type === "input") {
      const typeName = `${option.placeholder ?? name}${option.multiple ? "..." : ""}`
      type = option.optional ? `[${typeName}]` : `<${typeName}>`
    }
    const opt = new Option(`${option.flag}, --${name} ${type}`, option.help)
    if (option.required) opt.makeOptionMandatory()
    if (option.choices) opt.choices(option.choices)
    if (option.default) opt.default(option.default)
    if (option.conflicts) opt.conflicts(option.conflicts)
    if (option.implies) opt.implies(option.implies)
    return program.addOption(opt)
  }
  addSubcommand(cmdName, config) {
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
  initialize(config = {}) {
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
    throws && this.program.exitOverride()
  }

  get state() {
    return this.#_state
  }

  setState(state) {
    this.#_state = state
  }

  async action(_name, _options) {}

  async execute(argv = process.argv) {
    if (!this.program) this.initialize()
    await this.program.action(this.action.bind(this)).parse(argv)
  }
}
