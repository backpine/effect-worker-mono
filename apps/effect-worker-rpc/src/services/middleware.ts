/**
 * RPC Middleware Implementations
 *
 * Provides the actual implementations for RPC middleware tags.
 * These use FiberRefs to access request-scoped Cloudflare bindings.
 *
 * @module
 */
import { Effect, FiberRef, Layer } from "effect"
import {
  CloudflareBindings,
  CloudflareBindingsError,
  DatabaseService,
  DatabaseConnectionError
} from "@backpine/cloudflare"
import { RpcCloudflareMiddleware, RpcDatabaseMiddleware } from "@backpine/rpc"
import { currentEnv, currentCtx } from "./cloudflare.js"
import { makeDatabaseConnection, LOCAL_DATABASE_URL, type DrizzleInstance } from "./database.js"

// ============================================================================
// Cloudflare Middleware Implementation
// ============================================================================

/**
 * Live implementation of RpcCloudflareMiddleware.
 *
 * Reads env/ctx from FiberRef and provides them as the CloudflareBindings service.
 */
export const RpcCloudflareMiddlewareLive = Layer.succeed(
  RpcCloudflareMiddleware,
  // Middleware function runs per-RPC-call
  () =>
    Effect.gen(function* () {
      const env = yield* FiberRef.get(currentEnv)
      const ctx = yield* FiberRef.get(currentCtx)

      if (env === null || ctx === null) {
        return yield* Effect.fail(
          new CloudflareBindingsError({
            message:
              "Cloudflare bindings not available. Ensure withCloudflareBindings() wraps the handler."
          })
        )
      }

      return { env, ctx }
    })
)

// ============================================================================
// Database Middleware Implementation
// ============================================================================

/**
 * Live implementation of RpcDatabaseMiddleware.
 *
 * Creates a scoped database connection per-request.
 * The connection is automatically closed when the request scope ends.
 *
 * Note: The middleware returns a scoped Effect. The RpcServer provides
 * the Scope at runtime when executing handlers.
 */
export const RpcDatabaseMiddlewareLive = Layer.succeed(
  RpcDatabaseMiddleware,
  // Middleware function runs per-RPC-call
  // Note: Type cast needed because RpcMiddleware doesn't include Scope in type,
  // but RpcServer runs handlers in a scoped context
  (() =>
    Effect.gen(function* () {
      // Get connection string from Cloudflare env via FiberRef
      const env = yield* FiberRef.get(currentEnv)
      if (env === null) {
        return yield* Effect.fail(
          new DatabaseConnectionError({
            message:
              "Cloudflare env not available. Ensure withCloudflareBindings() wraps the handler."
          })
        )
      }

      const connectionString = env.DATABASE_URL ?? LOCAL_DATABASE_URL
      return yield* makeDatabaseConnection(connectionString)
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new DatabaseConnectionError({
            message: `Database connection failed: ${String(error)}`
          })
        )
      )
    )) as unknown as () => Effect.Effect<
    { readonly db: DrizzleInstance },
    DatabaseConnectionError
  >
)
