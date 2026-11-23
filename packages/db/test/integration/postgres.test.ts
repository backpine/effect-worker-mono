import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { Database } from "../../src/database.js"
import { UserQueries } from "../../src/queries/index.js"
import { migrate, startTestPostgres } from "../support/postgres.js"
import { seedUsers } from "../support/seeds.js"

let postgres: Awaited<ReturnType<typeof startTestPostgres>>
beforeAll(async () => {
  postgres = await startTestPostgres()
}, 120_000)
afterAll(async () => {
  await postgres?.stop()
})

const ada = { email: "ada@example.com", name: "Ada" }
const grace = { email: "grace@example.com", name: "Grace" }
const createdAt = new Date("2026-01-02T03:04:05.678Z")

describe("user queries", () => {
  it("lists users in ID order and decodes timestamps as Dates", () =>
    postgres.withDatabase(async (db) => {
      await db.run(seedUsers({ ...ada, createdAt }, { ...grace, createdAt }))
      expect(await db.run(UserQueries.findAllUsers)).toEqual([
        { ...ada, id: 1, createdAt },
        { ...grace, id: 2, createdAt },
      ])
    }))

  it("starts each test with an empty users table", () =>
    postgres.withDatabase(async (db) => {
      expect(await db.run(UserQueries.findAllUsers)).toEqual([])
    }))

  it("looks up the requested ID and reports missing or out-of-range IDs", () =>
    postgres.withDatabase(async (db) => {
      await db.run(seedUsers({ ...ada, createdAt }, { ...grace, createdAt }))
      expect(await db.run(UserQueries.findUserById(2))).toEqual({ ...grace, id: 2, createdAt })

      for (const id of [3, 1.5, 2147483648]) {
        const result = await db.run(Effect.result(UserQueries.findUserById(id)))
        expect(result).toMatchObject({ _tag: "Failure", failure: { _tag: "UserNotFoundError", id } })
      }
    }))

  it("creates a user with database defaults and parameterizes values", () =>
    postgres.withDatabase(async (db) => {
      const input = { email: "marie@example.com", name: "Marie'); DROP TABLE users; --" }
      const user = await db.run(UserQueries.createUser(input))
      expect(user).toEqual({ ...input, id: 1, createdAt: expect.any(Date) })
      expect(await db.run(UserQueries.findUserById(user.id))).toEqual(user)
    }))

  it("reports duplicate email and oversized columns without changing existing rows", () =>
    postgres.withDatabase(async (db) => {
      await db.run(seedUsers({ ...ada, createdAt }))
      for (const input of [{ ...ada, name: "Other" }, { ...grace, name: "a".repeat(256) }]) {
        const result = await db.run(Effect.result(UserQueries.createUser(input)))
        expect(result).toMatchObject({ _tag: "Failure", failure: { _tag: "UserCreationError", ...input } })
      }
      expect(await db.run(UserQueries.findAllUsers)).toEqual([{ ...ada, id: 1, createdAt }])
    }))

  it("does not report a failed read as an empty result", () =>
    postgres.withDatabase(async (db) => {
      await db.run(Effect.gen(function* () {
        const sql = yield* Database
        yield* sql`DROP TABLE users`
      }))
      await expect(db.run(UserQueries.findAllUsers)).rejects.toMatchObject({ _tag: "SqlError" })
      await expect(db.run(UserQueries.findUserById(1))).rejects.toMatchObject({ _tag: "SqlError" })
    }))

  it("isolates concurrent fixtures", async () => {
    const [first, second] = await Promise.all([
      postgres.withDatabase((db) => db.run(UserQueries.createUser(ada))),
      postgres.withDatabase((db) => db.run(UserQueries.createUser(ada))),
    ])
    expect(first.id).toBe(1)
    expect(second.id).toBe(1)
  })
})

describe("migrations", () => {
  it("can be reapplied without changing existing rows", () =>
    postgres.withDatabase(async (db) => {
      await db.run(seedUsers({ ...ada, createdAt }))
      await migrate(db.connectionString)
      expect(await db.run(UserQueries.findAllUsers)).toEqual([{ ...ada, id: 1, createdAt }])
    }))

  it("recognizes the initial migration in the previous Drizzle journal", () =>
    postgres.withDatabase(async (db) => {
      const initial = await Bun.file(new URL("../../migrations/0000_reflective_ultron.sql", import.meta.url)).text()
      const originalHash = "4aec985c9f98c755ad75aeafe0ebea37540ec6c8de6e52f5666d5f18b23021f8"
      expect(new Bun.CryptoHasher("sha256").update(initial).digest("hex")).toBe(originalHash)
      await db.run(Effect.gen(function* () {
        const sql = yield* Database
        yield* sql.unsafe(initial)
        yield* sql`CREATE SCHEMA drizzle`
        yield* sql`
          CREATE TABLE drizzle.__drizzle_migrations (
            id serial PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint,
            name text,
            applied_at timestamp with time zone DEFAULT now()
          )
        `
        yield* sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at, name)
          VALUES (${originalHash}, ${1779816782000}, ${"20260526173302_reflective_ultron"})
        `
        yield* seedUsers({ ...ada, createdAt })
      }))

      await migrate(db.connectionString)
      expect(await db.run(UserQueries.findAllUsers)).toEqual([{ ...ada, id: 1, createdAt }])
    }, { migrated: false }))
})
