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
  CloudflareBindingsError,
  DatabaseConnectionError,
  makeDrizzle,
  LOCAL_DATABASE_URL,

} from "@backpine/cloudflare"
import { RpcCloudflareMiddleware, RpcDatabaseMiddleware } from "@backpine/contracts"
import { currentEnv, currentCtx } from "./cloudflare"

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
 */
export const RpcDatabaseMiddlewareLive = Layer.succeed(
  RpcDatabaseMiddleware,
  // Middleware function runs per-RPC-call
  () =>
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
      return yield* makeDrizzle(connectionString)
    }).pipe(
      Effect.scoped,
      Effect.catchAll((error) =>
        Effect.fail(
          new DatabaseConnectionError({
            message: `Database connection failed: ${String(error)}`
          })
        )
      )
    )
)
