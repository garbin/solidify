# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Full TypeScript migration with complete type definitions
- Type declarations for all public APIs
- Input validation for route parameters using Fastify JSON Schema
- Column type whitelist validation in migrations

### Changed

- **BREAKING**: Source code moved from `lib/` to `src/` with compiled output to `dist/`
- **BREAKING**: Package exports now point to `dist/` directory
- Enabled TypeScript `strict` mode for full type safety
- Error messages no longer expose internal field names (security improvement)
- All test files migrated to TypeScript (`.test.ts`)

### Fixed

- Route parameter validation for `:id` parameters (returns 400 for invalid format)
- Generic error messages for not found resources (prevents information leakage)

### Security

- Added Fastify schema validation for all routes with `:id` parameters
- Input validation now rejects non-integer IDs when integer is expected
- Input validation now rejects negative IDs
- Migration column types validated against whitelist to prevent arbitrary method calls

## [0.1.0] - 2024-11-22

### Added

- Initial release of Solidify
- `Model` class - Enhanced Objection.js Model with field definitions, validation, and migrations
- `Router` and `RESTfulRouter` classes - Automatic REST API generation
- `WebServer` class - Fastify server wrapper with request context
- `pagination` plugin - Range-based pagination support
- `Command` class - CLI command builder using Commander.js
- `graphql` namespace - GraphQL integration with Mercurius
  - `graphql.plugin` - Mercurius Fastify plugin factory
  - `graphql.Loader` - DataLoader wrapper for batch loading
  - `graphql.model` - Model to GraphQL type converter
  - `graphql.type` - GraphQL type factory
  - `graphql.presets.batch` - Batch loading presets (hasMany, hasOne, belongsTo, belongsToMany)
  - `graphql.presets.search` - Relay-style connection resolver
  - `graphql.presets.mutation` - CRUD mutation generators
  - `graphql.presets.fetch` - Union type fetch resolver

### Security

- Input validation using Yup schemas
- SQL injection prevention through parameterized queries (via Knex/Objection)
