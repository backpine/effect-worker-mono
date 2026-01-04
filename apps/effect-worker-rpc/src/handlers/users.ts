/**
 * Users RPC Handlers
 *
 * Handler implementations for the users RPC procedures.
 * Uses DatabaseService provided by RpcDatabaseMiddleware.
 *
 * @module
 */
import { DateTime, Effect } from "effect"
import { UsersRpc } from "@backpine/rpc"
import { DatabaseService, type DrizzleInstance } from "@backpine/cloudflare"
import { users } from "@backpine/db"
import { eq } from "drizzle-orm"

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert database user id to string format.
 */
const toUserId = (id: number): string => `usr_${id}`

/**
 * Parse user ID to extract the database id.
 */
const parseUserId = (id: string): number | null => {
  const match = id.match(/^usr_(\d+)$/)
  return match ? parseInt(match[1]!, 10) : null
}

/**
 * Get typed database instance from DatabaseService.
 */
const getDb = Effect.gen(function* () {
  const { db } = yield* DatabaseService
  return db as DrizzleInstance
})

// ============================================================================
// Handler Implementation
// ============================================================================

/**
 * Users RPC handler layer.
 */
export const UsersRpcHandlersLive = UsersRpc.toLayer({
  getUser: ({ id }) =>
    Effect.gen(function* () {
      const dbId = parseUserId(id)
      if (dbId === null) {
        return yield* Effect.fail({
          _tag: "UserNotFound" as const,
          id,
          message: `Invalid user ID format: ${id}`
        })
      }

      const db = yield* getDb
      const result = yield* Effect.tryPromise({
        try: () => db.select().from(users).where(eq(users.id, dbId)),
        catch: () => ({
          _tag: "UserNotFound" as const,
          id,
          message: `User not found: ${id}`
        })
      })
      const dbUser = result[0]

      if (!dbUser) {
        return yield* Effect.fail({
          _tag: "UserNotFound" as const,
          id,
          message: `User not found: ${id}`
        })
      }

      return {
        id: toUserId(dbUser.id),
        email: dbUser.email,
        name: dbUser.name,
        createdAt: DateTime.unsafeFromDate(dbUser.createdAt)
      }
    }),

  listUsers: () =>
    Effect.gen(function* () {
      const db = yield* getDb
      const dbUsers = yield* Effect.tryPromise(() => db.select().from(users)).pipe(
        Effect.orElseSucceed(() => [] as typeof users.$inferSelect[])
      )

      return {
        users: dbUsers.map((u) => ({
          id: toUserId(u.id),
          email: u.email,
          name: u.name,
          createdAt: DateTime.unsafeFromDate(u.createdAt)
        })),
        total: dbUsers.length
      }
    }),

  createUser: ({ email, name }) =>
    Effect.gen(function* () {
      const db = yield* getDb
      const result = yield* Effect.tryPromise({
        try: () => db.insert(users).values({ email, name }).returning(),
        catch: () => ({
          _tag: "DuplicateEmail" as const,
          email
        })
      })
      const newUser = result[0]

      if (!newUser) {
        return yield* Effect.fail({
          _tag: "ValidationError" as const,
          message: "Failed to create user"
        })
      }

      return {
        id: toUserId(newUser.id),
        email: newUser.email,
        name: newUser.name,
        createdAt: DateTime.unsafeFromDate(newUser.createdAt)
      }
    })
})
