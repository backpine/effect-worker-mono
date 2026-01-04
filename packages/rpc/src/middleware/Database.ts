/**
 * Database RPC Middleware Tag
 *
 * RpcMiddleware tag that provides DatabaseService to RPC handlers.
 * The implementation is provided by the app using FiberRefs.
 *
 * @module
 */
import { RpcMiddleware } from "@effect/rpc"
import { DatabaseService, DatabaseConnectionError } from "@backpine/cloudflare"

/**
 * Middleware that provides DatabaseService to RPC handlers.
 *
 * Apply to RPC procedures that need database access:
 *
 * ```typescript
 * const myRpc = Rpc.make("myRpc", { ... })
 *   .middleware(RpcDatabaseMiddleware)
 * ```
 *
 * Implementation is provided by the app layer.
 */
export class RpcDatabaseMiddleware extends RpcMiddleware.Tag<RpcDatabaseMiddleware>()(
  "@backpine/rpc/RpcDatabaseMiddleware",
  {
    failure: DatabaseConnectionError,
    provides: DatabaseService
  }
) {}
