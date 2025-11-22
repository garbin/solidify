import test from "ava"
import { Command } from "../lib/command.mjs"

test("Command Basic", async (t) => {
  class BasicCommand extends Command {
    name = "Basic Command"
    description = "Just for Test"
    version = "1.0.0"
    arguments = {
      item: {
        optional: true,
        multiple: true,
        description: "test item",
        errorMessage: "No item specificed",
      },
    }
    options = {
      debug: {
        type: "boolean",
        flag: "-d",
        help: "output extra debugging",
      },
      input: {
        type: "input",
        flag: "-i",
        help: "provide input",
        default: "1234",
        placeholder: "input",
      },
      name: {
        type: "input",
        flag: "-n",
        help: "name",
        required: true,
        placeholder: "name",
      },
      letters: {
        type: "input",
        flag: "-l",
        help: "multiple option",
        optional: true,
        multiple: true,
        placeholder: "letters",
      },
    }
    subcommands = {
      install: {
        description: "description",
        arguments: {
          app: {
            multiple: false,
          },
        },
        options: {
          silent: {
            flag: "-s",
            help: "silent",
          },
        },
        action: async function (app, opts) {
          this.setState({ ...this.state, install: { app, opts } })
        },
      },
    }

    async action(_username, options) {
      this.setState(options)
    }
  }
  const command = new BasicCommand()
  command.initialize({ throws: true })
  command.program.configureHelp({
    subcommandTerm: (cmd) => `${cmd.name()} ${cmd.usage}`,
  })
  const err = await t.throwsAsync(async () => await command.execute(["", ""]))
  t.is(err.code, "commander.missingMandatoryOptionValue")
  await command.execute(["", "", "-d", "-n", "Garbin", "abc"])
  t.deepEqual(command.program.args, ["abc"])
  t.is(command.state.debug, true)
  t.is(command.state.name, "Garbin")
  t.is(command.state.input, "1234")
  await command.execute(["", "", "-n", "garbin", "-l", "a", "b", "c"])
  t.deepEqual(command.state.letters, ["a", "b", "c"])
  await command.execute(["", "", "-n", "garbin", "install", "solidify", "-s"])
  t.is(command.state.install.app, "solidify")
})

test("Command with choices", async (t) => {
  class TestCommand extends Command {
    name = "Test Command"
    description = "Just for Test"
    version = "1.0.0"
    arguments = {
      item: {
        optional: false,
        multiple: false,
        description: "test item",
        choices: ["a", "b", "c"],
      },
    }
    options = {
      env: {
        type: "input",
        flag: "-e",
        help: "env",
        choices: ["production", "development"],
      },
    }
    async action(item, options) {
      this.setState({ item, options })
    }
  }
  const command = new TestCommand()
  command.initialize({ throws: true })
  const err1 = await t.throwsAsync(
    async () => await command.execute(["", "", "d"]),
  )
  t.is(err1.code, "commander.invalidArgument")
  const err2 = await t.throwsAsync(
    async () => await command.execute(["", "", "a", "-e", "testing"]),
  )
  t.is(err2.code, "commander.invalidArgument")
  await command.execute(["", "", "a", "-e", "production"])
  t.is(command.state.item, "a")
  t.is(command.state.options.env, "production")
})

test("Command with conflicts and implies", async (t) => {
  class TestCommand extends Command {
    name = "Test Command"
    description = "Just for Test"
    version = "1.0.0"
    options = {
      a: {
        flag: "-a",
        conflicts: "b",
      },
      b: {
        flag: "-b",
      },
      c: {
        flag: "-c",
        implies: {
          a: true,
        },
      },
    }
    async action(options) {
      this.setState(options)
    }
  }
  const command = new TestCommand()
  command.initialize({ throws: true })
  try {
    await command.execute(["", "", "-a", "-b"])
    t.fail("Expected an error to be thrown")
  } catch (err) {
    t.is(err.code, "commander.conflictingOption")
  }
  try {
    await command.execute(["", "", "-c"])
    t.is(command.state.a, true)
    t.is(command.state.c, true)
  } catch (err) {
    t.is(err.code, "commander.conflictingOption")
  }
})

test("Command coverage", async (t) => {
  // Test for execute() without initialize() and option without placeholder
  class CoverageCommand extends Command {
    name = "Coverage Command"
    options = {
      cov: { type: "input", flag: "-c" },
    }
    arguments = {
      argWithDefault: { default: "defaultValue", optional: true },
    }
    action(arg, opts) {
      this.setState({ arg, opts })
    }
  }
  const command = new CoverageCommand()
  // Not calling initialize() here to test the branch in execute()
  await command.execute(["", "", "-c", "test"])
  t.is(command.state.opts.cov, "test")
  t.is(command.state.arg, "defaultValue")
})
