/**
 * Database Middleware Definition
 *
 * Defines the middleware tag for providing database access to handlers.
 * The implementation is provided by the app since it requires access to
 * app-specific database configuration.
 *
 * @module
 */
import { HttpApiMiddleware, HttpApiSchema } from "@effect/platform"
import { Context, Schema as S } from "effect"

/**
 * DatabaseService provides access to a request-scoped database instance.
 *
 * Apps should cast the `db` to their specific database type when accessing.
 */
export class DatabaseService extends Context.Tag(
  "@backpine/api/DatabaseService"
)<DatabaseService, { readonly db: unknown }>() {}

/**
 * Error when database connection fails.
 * Returns 503 Service Unavailable.
 */
export class DatabaseConnectionError extends S.TaggedError<DatabaseConnectionError>()(
  "DatabaseConnectionError",
  { message: S.String },
  HttpApiSchema.annotations({ status: 503 })
) {}

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
