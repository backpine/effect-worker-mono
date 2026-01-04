/**
 * Users Handler Implementation
 *
 * @module
 */
import { HttpApiBuilder } from "@effect/platform"
import { DateTime, Effect } from "effect"
import { WorkerApi, DatabaseService } from "@backpine/api"
import type { UserId, Email, User } from "@backpine/domain"
import { UserCreationError, UserNotFoundError } from "@backpine/domain"
import { users } from "@/db"
import { eq } from "drizzle-orm"
import type { DrizzleInstance } from "@/services"

/**
 * Convert database user id to UserId format.
 */
const toUserId = (id: number): UserId => `usr_${id}` as UserId

/**
 * Parse UserId to extract the database id.
 */
const parseUserId = (id: UserId): number | null => {
  const match = id.match(/^usr_(\d+)$/)
  return match ? parseInt(match[1]!, 10) : null
}

/**
 * Users endpoint handler implementation.
 */
export const UsersGroupLive = HttpApiBuilder.group(
  WorkerApi,
  "users",
  (handlers) =>
    Effect.gen(function* () {
      return handlers
        .handle("list", () =>
          Effect.gen(function* () {
            const { db } = yield* DatabaseService
            const drizzle = db as DrizzleInstance
            const dbUsers = yield* Effect.tryPromise({
              try: () => drizzle.select().from(users),
              catch: () => [] as typeof users.$inferSelect[]
            }).pipe(Effect.orElseSucceed(() => []))

            const userList: User[] = dbUsers.map((u: typeof users.$inferSelect) => ({
              id: toUserId(u.id),
              email: u.email as Email,
              name: u.name,
              createdAt: DateTime.unsafeFromDate(u.createdAt)
            }))

            return {
              users: userList,
              total: userList.length
            }
          })
        )

        .handle("get", ({ path: { id } }) =>
          Effect.gen(function* () {
            const dbId = parseUserId(id)
            if (dbId === null) {
              return yield* Effect.fail(
                new UserNotFoundError({
                  id,
                  message: `Invalid user ID format: ${id}`
                })
              )
            }

            const { db } = yield* DatabaseService
            const drizzle = db as DrizzleInstance
            const result = yield* Effect.tryPromise({
              try: () => drizzle.select().from(users).where(eq(users.id, dbId)),
              catch: () =>
                new UserNotFoundError({
                  id,
                  message: `User not found: ${id}`
                })
            })

            const dbUser = result[0]
            if (!dbUser) {
              return yield* Effect.fail(
                new UserNotFoundError({
                  id,
                  message: `User not found: ${id}`
                })
              )
            }

            return {
              id: toUserId(dbUser.id),
              email: dbUser.email as Email,
              name: dbUser.name,
              createdAt: DateTime.unsafeFromDate(dbUser.createdAt)
            } satisfies User
          })
        )

        .handle("create", ({ payload: { email, name } }) =>
          Effect.gen(function* () {
            const { db } = yield* DatabaseService
            const drizzle = db as DrizzleInstance
            const result = yield* Effect.tryPromise({
              try: () =>
                drizzle.insert(users).values({ email, name }).returning(),
              catch: () => new UserCreationError({ email, name })
            })

            const newUser = result[0]
            if (!newUser) {
              return yield* Effect.fail(new UserCreationError({ email, name }))
            }

            return {
              id: toUserId(newUser.id),
              email: newUser.email as Email,
              name: newUser.name,
              createdAt: DateTime.unsafeFromDate(newUser.createdAt)
            } satisfies User
          })
        )
    })
)
