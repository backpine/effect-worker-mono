import { Effect, Schema } from "effect"
import type { SqlClient } from "effect/sql"
import { UserCreationError, UserNotFoundError, type CreateUser } from "@repo/domain"
import { Database } from "../database.js"
import type { User } from "../schema/users.js"

const userRow = Schema.Struct({
  id: Schema.Int,
  email: Schema.String,
  name: Schema.String,
  createdAt: Schema.Date,
}) satisfies Schema.Schema<User>

const decodeUsers = Schema.decodeUnknownEffect(Schema.Array(userRow))
const decodeUser = Schema.decodeUnknownEffect(userRow)
const columns = (sql: SqlClient.SqlClient) => sql`id, email, name, created_at AS "createdAt"`

export const findAllUsers = Effect.gen(function* () {
  const sql = yield* Database
  const rows = yield* sql`SELECT ${columns(sql)} FROM users ORDER BY id`
  return yield* decodeUsers(rows)
}).pipe(Effect.orDie)

export const findUserById = (id: number) =>
  Effect.gen(function* () {
    // Only PostgreSQL integer values can match the primary key.
    if (Number.isInteger(id) && id >= -2147483648 && id <= 2147483647) {
      const sql = yield* Database
      const rows = yield* sql`SELECT ${columns(sql)} FROM users WHERE id = ${id}`.pipe(Effect.orDie)
      if (rows.length > 0) return yield* decodeUser(rows[0]).pipe(Effect.orDie)
    }

    return yield* new UserNotFoundError({ id, message: `User not found: ${id}` })
  })

export const createUser = (data: CreateUser) =>
  Effect.gen(function* () {
    const sql = yield* Database
    const [row] = yield* sql`
      INSERT INTO users (email, name) VALUES (${data.email}, ${data.name})
      RETURNING ${columns(sql)}
    `.pipe(Effect.mapError(() => new UserCreationError(data)))
    if (row === undefined) return yield* new UserCreationError(data)
    return yield* decodeUser(row).pipe(Effect.orDie)
  })
