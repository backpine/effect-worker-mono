/**
 * Cloudflare Bindings Service
 *
 * ServiceMap.Reference bridge for providing Cloudflare's `env` and `ExecutionContext`
 * to Effect handlers.
 *
 * @module
 */
import { Effect, ServiceMap } from "effect"

/**
 * Reference holding the current request's Cloudflare environment bindings.
 */
export const currentEnv = ServiceMap.Reference<Env | null>(
  "@app/api/currentEnv",
  { defaultValue: () => null }
)

/**
 * Reference holding the current request's ExecutionContext.
 */
export const currentCtx = ServiceMap.Reference<ExecutionContext | null>(
  "@app/api/currentCtx",
  { defaultValue: () => null }
)

/**
 * Set Cloudflare bindings for the scope of an effect.
 *
 * Call this at the request boundary in index.ts:
 *
 * ```typescript
 * const effect = handleRequest(request).pipe(
 *   withCloudflareBindings(env, ctx),
 * )
 * return runtime.runPromise(effect)
 * ```
 */
export const withCloudflareBindings = (env: Env, ctx: ExecutionContext) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(currentEnv, env),
      Effect.provideService(currentCtx, ctx)
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
    const ctx = yield* currentCtx
    if (ctx) {
      ctx.waitUntil(
        Effect.runPromise(
          effect.pipe(
            Effect.tapCause(Effect.logError),
            Effect.catch(() => Effect.void)
          )
        )
      )
    }
  })
