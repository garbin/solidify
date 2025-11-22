import os from "node:os"
import { faker } from "@faker-js/faker"
import test from "ava"
import { ValidationError } from "yup"
import { knexMigration, Model } from "../index.mjs"

test.before((_t) => {
  Model.connect({
    client: "sqlite3",
    connection: `${os.tmpdir()}/model.sqlite`,
    useNullAsDefault: true,
  })
})

test.after((_t) => {
  Model.knex().destroy()
})

// --- Reusable Model and Setup ---

class FieldsTests extends Model {
  static tableName = "fields_tests"
  static fields = {
    id: {
      type: "increments",
      constraints: {
        primary: true,
      },
    },
    name: {
      type: "string",
      validator: {
        required: "name is required",
      },
    },
    email: {
      type: ["string", 100],
      validator: {
        email: "Invalid email format",
      },
    },
    age: {
      type: "integer",
      constraints: {
        unsigned: true,
      },
    },
    status: {
      type: ["enum", ["active", "inactive"]],
    },
    formatter: {
      type: "string",
      formatter: (v) => v.toUpperCase(),
      parser: (v) => v.toLowerCase(),
    },
    uuid: {
      type: "uuid",
    },
    config: {
      type: "json",
      formatter: (v) => JSON.stringify(v),
      parser: (v) => JSON.parse(v),
    },
    createdAt: {
      type: "timestamp",
      timestamp: "insert",
    },
    updatedAt: {
      type: "timestamp",
      timestamp: "update",
      constraints: {
        nullable: true,
      },
    },
  }

  static get virtualFields() {
    return {
      isNew: "boolean",
    }
  }

  get isNew() {
    // Record is new if it was created in the last minute
    const oneMinuteAgo = new Date(Date.now() - 60000)
    return this.createdAt > oneMinuteAgo
  }
}

// Helper to set up the table for FieldsTests model
async function setupFieldsTestTable() {
  await knexMigration([FieldsTests], { drop: true })
  await knexMigration([FieldsTests])
}

// --- Refactored and Focused Tests ---

test.serial("Model Validator: required and unsigned constraints", async (t) => {
  await setupFieldsTestTable()

  // Test 'required' constraint
  const error1 = await t.throwsAsync(FieldsTests.query().insert({ age: 25 }), {
    instanceOf: ValidationError,
  })
  t.is(error1.inner[0].path, "name", "'name' field should be required")

  // Test 'unsigned' constraint
  const error2 = await t.throwsAsync(
    FieldsTests.query().insert({ name: "John Doe", age: -5 }),
    { instanceOf: ValidationError },
  )
  t.is(error2.inner[0].path, "age", "'age' field should be unsigned")
})

test.serial("Model Validator: custom rule (email)", async (t) => {
  await setupFieldsTestTable()
  const error = await t.throwsAsync(
    FieldsTests.query().insert({ name: "Jane Doe", email: "invalid-email" }),
    { instanceOf: ValidationError },
  )
  t.is(error.inner[0].path, "email", "should validate email format")
})

test.serial("Model Validator: patch option and no schema", async (t) => {
  await setupFieldsTestTable()
  const user = new FieldsTests()

  // Test patch option
  const partialData = { age: 30 }
  const validatedData = user.constructor.createValidator().validate({
    json: partialData,
    options: { patch: true },
  })
  t.is(
    validatedData.age,
    30,
    "should validate partial object with patch option",
  )

  // Test no schema
  class NoSchemaModel extends Model {}
  const noSchemaValidator = NoSchemaModel.createValidator()
  const data = { foo: "bar" }
  const validated = noSchemaValidator.validate({ json: data })
  t.deepEqual(
    validated,
    data,
    "should return original json if no schema is defined",
  )
})

test.serial(
  "Model Lifecycle: formatter, parser, and virtual fields",
  async (t) => {
    await setupFieldsTestTable()
    const record = await FieldsTests.query().insert({
      name: "Case Test",
      formatter: "initial",
    })

    // Test formatter
    const raw = await Model.knex()
      .select()
      .from(FieldsTests.tableName)
      .where("id", record.id)
      .first()
    t.is(
      raw.formatter,
      "INITIAL",
      "formatter should convert to uppercase on save",
    )

    // Test parser
    const refreshed = await FieldsTests.query().findById(record.id)
    t.is(
      refreshed.formatter,
      "initial",
      "parser should convert to lowercase on fetch",
    )

    // Test virtual field
    t.true(refreshed.isNew, "virtual field 'isNew' should be true")
  },
)

test.serial("Model Lifecycle: timestamps", async (t) => {
  await setupFieldsTestTable()
  const record = await FieldsTests.query().insert({ name: "Timestamp Test" })

  t.true(record.createdAt instanceof Date, "createdAt should be set on insert")
  t.is(record.updatedAt, undefined, "updatedAt should be undefined on insert")

  await record.$query().patch({ name: "Updated Name" })
  t.true(record.updatedAt instanceof Date, "updatedAt should be set on update")
})

test.serial("Model Function: upsert", async (t) => {
  await setupFieldsTestTable()
  const initialData = { name: "Upsert Test", status: "active" }
  const created = await FieldsTests.query().insert(initialData)

  // Test update part of upsert
  const updatedData = { name: "Updated Upsert" }
  const updated = await FieldsTests.upsert({ id: created.id }, updatedData)
  t.is(updated.id, created.id, "upsert should update existing record")
  t.is(updated.name, updatedData.name, "upsert should update correct fields")

  // Test insert part of upsert
  const newData = { name: "New Upsert", status: "inactive" }
  const inserted = await FieldsTests.upsert({ id: 999 }, newData)
  t.is(inserted.id, 999, "upsert should insert new record with specified id")
  t.is(inserted.name, newData.name, "upsert should insert correct data")
})

test.serial("Model data types: successful insertion", async (t) => {
  await setupFieldsTestTable()
  const data = {
    name: "Data Type Test",
    email: "test@example.com",
    age: 50,
    status: "inactive",
    formatter: "some data",
    uuid: faker.string.uuid(),
    config: { key: "value", nested: [1, 2] },
  }
  const record = await FieldsTests.query().insert(data)
  t.true(
    !!record.id,
    "should insert record with various data types successfully",
  )
  t.deepEqual(
    record.config,
    data.config,
    "json field should be stored and retrieved correctly",
  )
})
test("foreignKeyName should works", (t) => {
  t.is(
    FieldsTests.foreignKeyName,
    "fields_testId",
    "foreignKeyName should be field_testId",
  )
  class ForeignKeyTest extends Model {
    static tableName = "foreign_key_tests"
    static fields = {
      id: {
        type: "increments",
        constraints: {
          primary: true,
        },
      },
      name: {
        type: "string",
        validator: {
          required: "name is required",
        },
      },
    }
    static get foreignKeyName() {
      return "foreign_key_id"
    }
  }
  t.is(
    ForeignKeyTest.foreignKeyName,
    "foreign_key_id",
    "foreignKeyName should be overwrite",
  )
})

// --- Original and Extended Tests ---

test("Model basic", async (t) => {
  class BasicTests extends Model {
    static tableName = "basic_tests"
    static fields = {
      id: {
        type: "increments",
        constraints: {
          primary: true,
        },
      },
      name: {
        type: "string",
        validator: {
          required: "name is required",
        },
      },
    }
  }
  await knexMigration([BasicTests], { drop: true })
  await knexMigration([BasicTests])
  const test = await BasicTests.query().insert({ name: "First" })
  t.is(test.name, "First")
})

test.serial("Model Relation: error handling for composite keys", (t) => {
  class User extends Model {
    static tableName = "users_composite"
    static idColumn = ["id1", "id2"] // Composite key
  }

  class Post extends Model {
    static tableName = "posts_composite"
  }

  const error = t.throws(() => User.hasMany(Post), { instanceOf: Error })
  t.is(
    error.message,
    "Composite keys are not supported in hasMany shortcut currently",
  )
})

test("Model Relation: mappings and complex table creation", async (t) => {
  class A extends Model {
    static tableName = "a"
    static fields = {
      id: {
        type: "increments",
        constraints: {
          primary: true,
        },
      },
    }
    static get relations() {
      return {
        b: A.hasOne(B),
        c: A.hasMany(C),
        d: A.manyToMany(D, {
          throughTable: "a_d",
        }),
        profile: A.hasOne(Profile),
      }
    }
  }
  class B extends Model {
    static tableName = "b"
    static fields = {
      id: {
        type: "increments",
        constraints: {
          primary: true,
        },
      },
      aId: {
        type: "integer",
      },
    }
    static get relations() {
      return {
        a: B.belongsTo(A),
      }
    }
  }
  class C extends Model {
    static tableName = "c"
    static fields = {
      id: {
        type: "increments",
        constraints: {
          primary: true,
        },
      },
      aId: {
        type: "integer",
      },
    }
    static get relations() {
      return {
        a: C.belongsTo(A),
      }
    }
  }
  class D extends Model {
    static tableName = "d"
    static fields = {
      id: {
        type: "increments",
        constraints: {
          primary: true,
        },
      },
    }
    static get relations() {
      return {
        a: D.manyToMany(A, {
          throughTable: "a_d",
        }),
      }
    }
  }
  class Profile extends Model {
    static tableName = "profiles"
    static fields = {
      id: { type: "increments", constraints: { primary: true } },
      bio: {
        type: "text",
        constraints: { nullable: true, comment: "User biography" },
      },
      aId: {
        type: "integer",
        constraints: { unique: true, references: "a.id", onDelete: "CASCADE" },
      },
    }
  }

  // Test createTable with more constraints
  await knexMigration([A, B, C, D, Profile], { drop: true })
  await knexMigration([A, B, C, D, Profile])
  t.pass(
    "createTable with unique, references, and onDelete constraints ran successfully",
  )

  // Test relation mappings
  t.deepEqual(
    A.relationMappings.b,
    {
      relation: Model.HasOneRelation,
      modelClass: B,
      foreignKey: "aId",
      parentForeignKey: "id",
      join: {
        from: "a.id",
        to: "b.aId",
      },
    },
    "A.b should have correct hasOne relationMappings",
  )
})
