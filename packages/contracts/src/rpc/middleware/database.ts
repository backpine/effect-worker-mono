/**
 * Database RPC Middleware Tag
 *
 * RpcMiddleware tag that provides PgDrizzle to RPC handlers.
 * The implementation is provided by the app using FiberRefs.
 *
 * @module
 */
import { RpcMiddleware } from "@effect/rpc"
import { PgDrizzle, DatabaseConnectionError } from "@backpine/cloudflare"

/**
 * Middleware that provides PgDrizzle to RPC handlers.
 *
 * Apply to RPC procedures that need database access:
 *
 * ```typescript
 * const myRpc = Rpc.make("myRpc", { ... })
 *   .middleware(RpcDatabaseMiddleware)
 * ```
 *
 * Implementation is provided by the app layer.
 *
 * Handlers can then use PgDrizzle directly:
 *
 * ```typescript
 * const drizzle = yield* PgDrizzle
 * const users = yield* drizzle.select().from(usersTable)
 * ```
 */
export class RpcDatabaseMiddleware extends RpcMiddleware.Tag<RpcDatabaseMiddleware>()(
  "@backpine/rpc/RpcDatabaseMiddleware",
  {
    failure: DatabaseConnectionError,
    provides: PgDrizzle
  }
) {}
