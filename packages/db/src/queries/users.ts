/**
 * User Queries
 *
 * Reusable Effect programs for user database operations.
 *
 * @module
 */
import { Effect } from "effect"
import { Database } from "../database.js"
import { eq } from "drizzle-orm"

import { users } from "../schema"
import type { CreateUser } from "@repo/domain"
import { UserNotFoundError, UserCreationError } from "@repo/domain"

// ============================================================================
// Query Programs
// ============================================================================

/**
 * Find all users.
 */
export const findAllUsers = Effect.gen(function* () {
  const drizzle = yield* Database
  const rows = yield* drizzle
    .select()
    .from(users)
    .pipe(Effect.orElseSucceed(() => []))

  return rows
})

/**
 * Find a user by numeric id.
 */
export const findUserById = (id: number) =>
  Effect.gen(function* () {
    const drizzle = yield* Database
    const rows = yield* drizzle
      .select()
      .from(users)
      .where(eq(users.id, id))
      .pipe(Effect.orElseSucceed(() => []))

    const row = rows[0]

    if (!row) {
      return yield* Effect.fail(
        new UserNotFoundError({ id, message: `User not found: ${id}` })
      )
    }

    return row
  })

/**
 * Create a new user.
 *
 * @param data - CreateUser payload (email, name)
 * @returns Effect that yields created User or fails with UserCreationError
 */
export const createUser = (
  data: CreateUser
) =>
  Effect.gen(function* () {
    const drizzle = yield* Database
    const rows = yield* drizzle
      .insert(users)
      .values({ email: data.email, name: data.name })
      .returning()
      .pipe(Effect.mapError(() => new UserCreationError(data)))

    const row = rows[0]

    if (!row) {
      return yield* Effect.fail(new UserCreationError(data))
    }

    return row
  })
