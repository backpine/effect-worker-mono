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
  "@app/rpc/currentEnv",
  { defaultValue: () => null }
)

/**
 * Reference holding the current request's ExecutionContext.
 */
export const currentCtx = ServiceMap.Reference<ExecutionContext | null>(
  "@app/rpc/currentCtx",
  { defaultValue: () => null }
)

/**
 * Set Cloudflare bindings for the scope of an effect.
 */
export const withCloudflareBindings = (env: Env, ctx: ExecutionContext) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(currentEnv, env),
      Effect.provideService(currentCtx, ctx)
    )

/**
 * Schedule a background task that runs after the response is sent.
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
