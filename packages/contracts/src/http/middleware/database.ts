/**
 * Database HTTP Middleware
 *
 * HttpApiMiddleware that provides the `Database` service to HTTP handlers.
 * The implementation (which opens the request-scoped connection) is provided
 * by the app.
 *
 * @module
 */
import { HttpApiMiddleware } from "effect/unstable/httpapi"
import { Database } from "@repo/db/database"
import { DatabaseConnectionError } from "@repo/domain"

/**
 * Middleware that provides `Database` to HTTP handlers.
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
 * Handlers can then use `Database` directly:
 *
 * ```typescript
 * const db = yield* Database
 * const users = yield* db.select().from(usersTable)
 * ```
 */
export class DatabaseMiddleware extends HttpApiMiddleware.Service<
  DatabaseMiddleware,
  { provides: Database }
>()("@repo/api/DatabaseMiddleware", {
  error: DatabaseConnectionError
}) {}

// Re-export for convenience
export { DatabaseConnectionError }
