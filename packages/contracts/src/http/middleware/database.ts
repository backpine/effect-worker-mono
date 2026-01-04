/**
 * Database HTTP Middleware
 *
 * HttpApiMiddleware that provides PgDrizzle to HTTP handlers.
 * The implementation is provided by the app.
 *
 * @module
 */
import { HttpApiMiddleware } from "@effect/platform"
import { PgDrizzle, DatabaseConnectionError } from "@backpine/cloudflare"

/**
 * Middleware that provides PgDrizzle to HTTP handlers.
 *
 * Apply to groups that need database access:
 *
 * ```typescript
 * export const UsersGroup = HttpApiGroup.make("users")
 *   .add(...)
 *   .middleware(DatabaseMiddleware)
 *   .prefix("/users")
 * ```
 *
 * The implementation must be provided by the app via Layer.
 *
 * Handlers can then use PgDrizzle directly:
 *
 * ```typescript
 * const drizzle = yield* PgDrizzle
 * const users = yield* drizzle.select().from(usersTable)
 * ```
 */
export class DatabaseMiddleware extends HttpApiMiddleware.Tag<DatabaseMiddleware>()(
  "@backpine/api/DatabaseMiddleware",
  {
    failure: DatabaseConnectionError,
    provides: PgDrizzle
  }
) {}

// Re-export for convenience
export { DatabaseConnectionError }
