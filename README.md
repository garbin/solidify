# Solidify

<p align="center">
  <br />
  <strong>Solidify: Fast, solid, and seamless. Your all-in-one Node.js framework for CLI, ORM, REST, and GraphQL.</strong>
  <br />
</p>

<p align="center">
  <a href="https://github.com/garbin/solidify/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/garbin/solidify/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/solidify"><img alt="NPM" src="https://img.shields.io/npm/v/solidify.svg"></a>
  <a href="https://codecov.io/gh/garbin/solidify/branch/main/graph/badge.svg"><img alt="Codecov" src="https://codecov.io/gh/garbin/solidify/branch/main/graph/badge.svg"></a>
  <a href="https://github.com/garbin/solidify/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/solidify.svg"></a>
</p>

Solidify is a powerful and flexible web server framework for Node.js. It's built on top of industry-leading libraries like [Fastify](https://www.fastify.io/) for performance, [Objection.js](https://vincit.github.io/objection.js/) for a powerful query builder and ORM, and [Mercurius](https://mercurius.dev/) for seamless GraphQL integration.

Solidify helps you build robust and scalable APIs by providing a solid foundation with sensible defaults and a convention-over-configuration approach.

## Features

- **All-in-One Solution:** From command-line interfaces to database management and API serving, Solidify provides a seamlessly integrated toolkit.
- **Fast & Performant:** Built on Fastify, one of the fastest web frameworks for Node.js, ensuring top-tier performance for your applications.
- **Solid & Declarative Models:** Leverages Objection.js for a powerful and flexible ORM. Define your models, validations (via Yup), and relations in one clear, stable structure.
- **Effortless REST & GraphQL APIs:** Automatically generate full CRUD RESTful endpoints and a complete GraphQL schema from your models, saving you time and effort.
- **Command-Line Ready:** Integrates with `commander.js` to easily build powerful command-line tools alongside your web services.
- **Database Migrations:** Includes helpers to create and manage your database schema directly from your model definitions, ensuring your database is always in sync.

## Installation

```bash
npm install solidify
```

You will also need to install the database driver of your choice (e.g., `pg`, `mysql2`, `sqlite3`).

## Quick Start

Here's a quick example of how to create a simple web server with a RESTful API for a `User` model.

### 1. Define a Model

Create a `User.mjs` model file. Solidify extends Objection.js models with extra capabilities.

```javascript
// models/User.mjs
import { Model } from "solidify";

export class User extends Model {
  static tableName = "users";

  static fields = {
    id: {
      type: "increments",
      constraints: { primary: true },
      graphql: { type: "ID" },
    },
    name: {
      type: "string",
      constraints: { notNullable: true },
      validator: { min: 3 },
    },
    email: {
      type: "string",
      constraints: { unique: true, notNullable: true },
      validator: { email: true },
    },
    createdAt: {
      type: "timestamp",
      timestamp: "insert",
      graphql: { type: "DateTime" },
    },
  };
}
```

### 2. Create a RESTful Router

Create a `routes/users.mjs` file to define the API endpoints.

```javascript
// routes/users.mjs
import { RESTfulRouter } from "solidify";
import { User } from "../models/User.mjs";

const router = new RESTfulRouter(User);

// This will automatically create the following routes:
// GET /users
// POST /users
// GET /users/:id
// PATCH /users/:id
// DELETE /users/:id
router.crud();

export default router;
```

### 3. Start the Web Server

Create a `server.mjs` file to put everything together.

```javascript
// server.mjs
import { WebServer, Model } from "solidify";
import Knex from "knex";
import userRoutes from "./routes/users.mjs";

// 1. Initialize Database Connection
const knex = Knex({
  client: "sqlite3",
  connection: {
    filename: "./mydb.sqlite",
  },
  useNullAsDefault: true,
});
Model.knex(knex);

// 2. Create Server Instance
const server = new WebServer({
  logger: true,
});

// 3. Register Routes
server.register(userRoutes.plugin());

// 4. Start Server
const start = async () => {
  try {
    await server.listen({ port: 3000 });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
```

Now you have a fully functional REST API for users!

### Add GraphQL in One Go

Solidify can automatically generate a GraphQL schema from your models. Just add the `graphql` plugin:

```javascript
// server.mjs (continued)
import { graphql, model, presets } from "solidify";
import { User } from "./models/User.mjs";

server.register(graphql.plugin({
  typeDefs: `
    type Query {
      users: [User!]!
    }
  `,
  resolvers: {
    Query: {
      users: presets.search(User),
    },
  },
  graphiql: true,
}));

// Now you have a GraphQL endpoint at /graphql
```

### Build CLI Commands

Easily create command-line tools for your application, like a database migration command.

```javascript
// cli.mjs
import { Command, Model, knexMigration } from "solidify";
import { User } from "./models/User.mjs";
import Knex from "knex";

const command = new Command();

command
  .command("db:migrate")
  .description("Run database migrations")
  .action(async () => {
    // Initialize DB connection (same as in server.mjs)
    const knex = Knex({ client: "sqlite3", connection: { filename: "./mydb.sqlite" }, useNullAsDefault: true });
    Model.knex(knex);
    
    await knexMigration([User]);
    console.log("Migrations completed!");
    await knex.destroy();
  });

command.parse(process.argv);
```

Run it with `node cli.mjs db:migrate`.

## Documentation

*Full documentation is coming soon.*

- **Models:** Learn how to define fields, validations, and relations.
- **Routing:** Dive deeper into the `Router` and `RESTfulRouter`.
- **GraphQL:** Learn how to expose your API via GraphQL.
- **Deployment:** Best practices for deploying a Solidify application.

## Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
