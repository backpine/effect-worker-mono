/**
 * Database RPC Middleware
 *
 * RpcMiddleware that provides the `Database` service to RPC handlers. The
 * implementation (which opens the request-scoped connection) is provided by the
 * worker.
 *
 * Note: unlike `HttpApiMiddleware`, an `RpcMiddleware` error must be a `Schema`
 * (it is encoded and sent to the client). `DatabaseConnectionError` is a
 * `Schema.TaggedErrorClass`, so it qualifies.
 *
 * @module
 */
import { RpcMiddleware } from "effect/unstable/rpc"
import { Database } from "@repo/db/database"
import { DatabaseConnectionError } from "@repo/domain"

export class DatabaseRpcMiddleware extends RpcMiddleware.Service<
  DatabaseRpcMiddleware,
  { provides: Database }
>()("@repo/rpc/DatabaseRpcMiddleware", {
  error: DatabaseConnectionError,
  requiredForClient: false
}) {}
