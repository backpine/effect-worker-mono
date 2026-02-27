/**
 * Database RPC Middleware Tag
 *
 * RpcMiddleware tag that provides PgDrizzle to RPC handlers.
 * The implementation is provided by the app using ServiceMap.Reference.
 *
 * @module
 */
import { RpcMiddleware } from "effect/unstable/rpc"
import { PgDrizzle } from "@repo/db/pg-drizzle/tag"
import { DatabaseConnectionError } from "@repo/domain"

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
export class RpcDatabaseMiddleware extends RpcMiddleware.Service<
  RpcDatabaseMiddleware,
  { provides: PgDrizzle }
>()("@repo/rpc/RpcDatabaseMiddleware", {
  error: DatabaseConnectionError,
  requiredForClient: false
}) {}
