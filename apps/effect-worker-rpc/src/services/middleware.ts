/**
 * RPC Middleware Implementations
 *
 * Provides the actual implementations for RPC middleware tags.
 * In Effect v4, middleware with `provides` is a function that wraps the
 * RPC effect and provides the required service to it.
 *
 * @module
 */
import { Effect, Layer } from "effect"
import {
  RpcCloudflareMiddleware,
  RpcDatabaseMiddleware,
  CloudflareBindings,
  CloudflareBindingsError,
  DatabaseConnectionError,
} from "@repo/contracts"
import { PgDrizzle, makeDrizzle } from "@repo/db"
import { currentEnv, currentCtx } from "@/services/cloudflare"

// ============================================================================
// Cloudflare Middleware Implementation
// ============================================================================

/**
 * Live implementation of RpcCloudflareMiddleware.
 *
 * Reads env/ctx from ServiceMap.Reference and provides CloudflareBindings
 * to the downstream RPC handler effect.
 */
export const RpcCloudflareMiddlewareLive = Layer.succeed(
  RpcCloudflareMiddleware,
  (effect) =>
    Effect.gen(function* () {
      const env = yield* currentEnv
      const ctx = yield* currentCtx

      if (env === null || ctx === null) {
        return yield* Effect.fail(
          new CloudflareBindingsError({
            message:
              "Cloudflare bindings not available. Ensure withCloudflareBindings() wraps the handler."
          })
        )
      }

      return yield* effect.pipe(
        Effect.provideService(CloudflareBindings, { env, ctx })
      )
    })
)

// ============================================================================
// Database Middleware Implementation
// ============================================================================

/**
 * Live implementation of RpcDatabaseMiddleware.
 *
 * Creates a scoped database connection per-request and provides PgDrizzle
 * to the downstream RPC handler effect.
 */
export const RpcDatabaseMiddlewareLive = Layer.succeed(
  RpcDatabaseMiddleware,
  (effect) =>
    Effect.gen(function* () {
      const env = yield* currentEnv
      if (env === null) {
        return yield* Effect.fail(
          new DatabaseConnectionError({
            message:
              "Cloudflare env not available. Ensure withCloudflareBindings() wraps the handler."
          })
        )
      }

      const db = yield* makeDrizzle(env.HYPERDRIVE.connectionString)

      return yield* effect.pipe(
        Effect.provideService(PgDrizzle, db)
      )
    }).pipe(
      Effect.catch(() =>
        Effect.fail(
          new DatabaseConnectionError({
            message: "Database connection failed"
          })
        )
      )
    )
)
