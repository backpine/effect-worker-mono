/**
 * Database HTTP Middleware
 *
 * HttpApiMiddleware that provides DatabaseService to HTTP handlers.
 * The implementation is provided by the app.
 *
 * @module
 */
import { HttpApiMiddleware } from "@effect/platform"
import { DatabaseService, DatabaseConnectionError } from "@backpine/cloudflare"

/**
 * Middleware that provides DatabaseService to HTTP handlers.
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
 */
export class DatabaseMiddleware extends HttpApiMiddleware.Tag<DatabaseMiddleware>()(
  "@backpine/api/DatabaseMiddleware",
  {
    failure: DatabaseConnectionError,
    provides: DatabaseService
  }
) {}

// Re-export for convenience
export { DatabaseService, DatabaseConnectionError }
