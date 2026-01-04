/**
 * User Queries
 *
 * Reusable Effect programs for user database operations.
 *
 * @module
 */
import { DateTime, Effect } from "effect"
import { PgDrizzle } from "@effect/sql-drizzle/Pg"
import { eq } from "drizzle-orm"

import { users } from "../schema"
import type { UserId, Email, User, CreateUser } from "@backpine/domain"
import { UserNotFoundError, UserCreationError } from "@backpine/domain"

// ============================================================================
// Internal Helpers
// ============================================================================

/** Convert database ID to branded UserId */
const toUserId = (id: number): UserId => `usr_${id}` as UserId

/** Parse UserId to database ID, returns null if invalid format */
const parseUserId = (id: UserId): number | null => {
  const match = id.match(/^usr_(\d+)$/)
  return match ? parseInt(match[1]!, 10) : null
}

/** Map database row to domain User */
const toDomainUser = (row: typeof users.$inferSelect): User => ({
  id: toUserId(row.id),
  email: row.email as Email,
  name: row.name,
  createdAt: DateTime.unsafeFromDate(row.createdAt)
})

// ============================================================================
// Query Programs
// ============================================================================

/**
 * Find all users.
 *
 * @returns Effect that yields array of domain Users
 */
export const findAllUsers: Effect.Effect<
  User[],
  never,
  PgDrizzle
> = Effect.gen(function* () {
  const drizzle = yield* PgDrizzle
  const rows = yield* drizzle
    .select()
    .from(users)
    .pipe(Effect.orElseSucceed(() => []))

  return rows.map(toDomainUser)
})

/**
 * Find user by ID.
 *
 * @param id - Branded UserId
 * @returns Effect that yields User or fails with UserNotFoundError
 */
export const findUserById = (
  id: UserId
): Effect.Effect<User, UserNotFoundError, PgDrizzle> =>
  Effect.gen(function* () {
    const dbId = parseUserId(id)

    if (dbId === null) {
      return yield* Effect.fail(
        new UserNotFoundError({ id, message: `Invalid user ID format: ${id}` })
      )
    }

    const drizzle = yield* PgDrizzle
    const rows = yield* drizzle
      .select()
      .from(users)
      .where(eq(users.id, dbId))
      .pipe(Effect.orElseSucceed(() => []))

    const row = rows[0]

    if (!row) {
      return yield* Effect.fail(
        new UserNotFoundError({ id, message: `User not found: ${id}` })
      )
    }

    return toDomainUser(row)
  })

/**
 * Create a new user.
 *
 * @param data - CreateUser payload (email, name)
 * @returns Effect that yields created User or fails with UserCreationError
 */
export const createUser = (
  data: CreateUser
): Effect.Effect<User, UserCreationError, PgDrizzle> =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle
    const rows = yield* drizzle
      .insert(users)
      .values({ email: data.email, name: data.name })
      .returning()
      .pipe(Effect.mapError(() => new UserCreationError(data)))

    const row = rows[0]

    if (!row) {
      return yield* Effect.fail(new UserCreationError(data))
    }

    return toDomainUser(row)
  })
