import { PgTypes } from "@effect/sql-pg"
import { Effect } from "effect"
import { Database } from "../../src/database.js"
import type { NewUser } from "../../src/schema/index.js"

export const seedUsers = (...users: Array<Omit<NewUser, "id">>) =>
  Effect.gen(function* () {
    const sql = yield* Database
    yield* sql.withTransaction(Effect.forEach(users, ({ email, name, createdAt }) => sql`
      INSERT INTO users (email, name, created_at)
      VALUES (${email}, ${name}, ${createdAt ? PgTypes.timestamp(createdAt) : sql.literal("DEFAULT")})
    `, { discard: true }))
  })
