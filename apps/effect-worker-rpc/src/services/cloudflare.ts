/**
 * Cloudflare Bindings Service
 *
 * Re-exports FiberRef bridge from @repo/cloudflare.
 * This provides app-local type inference for the Env type.
 *
 * @module
 */
import { Effect, FiberRef } from "effect"

/**
 * FiberRef holding the current request's Cloudflare environment bindings.
 */
export const currentEnv = FiberRef.unsafeMake<Env | null>(null)

/**
 * FiberRef holding the current request's ExecutionContext.
 */
export const currentCtx = FiberRef.unsafeMake<ExecutionContext | null>(null)

/**
 * Set Cloudflare bindings for the scope of an effect.
 *
 * Call this at the request boundary in index.ts:
 *
 * ```typescript
 * const effect = handleRpcRequest(request).pipe(
 *   withCloudflareBindings(env, ctx),
 * )
 * return rpcRuntime.runPromise(effect)
 * ```
 */
export const withCloudflareBindings = (env: Env, ctx: ExecutionContext) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.locally(currentEnv, env),
      Effect.locally(currentCtx, ctx)
    )

/**
 * Schedule a background task that runs after the response is sent.
 *
 * Uses ctx.waitUntil() to keep the Worker alive while the effect runs.
 * Errors are logged but don't affect the response.
 */
export const waitUntil = <A, E>(
  effect: Effect.Effect<A, E>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const ctx = yield* FiberRef.get(currentCtx)
    if (ctx) {
      ctx.waitUntil(
        Effect.runPromise(
          effect.pipe(
            Effect.tapErrorCause(Effect.logError),
            Effect.catchAll(() => Effect.void)
          )
        )
      )
    }
  })
