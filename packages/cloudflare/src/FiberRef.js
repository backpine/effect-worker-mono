/**
 * FiberRef Bridge
 *
 * Provides request-scoped access to Cloudflare's `env` and `ExecutionContext`
 * bindings through Effect's FiberRef system.
 *
 * @module
 */
import { Effect, FiberRef } from "effect";
/**
 * FiberRef holding the current request's Cloudflare environment bindings.
 * Type is `unknown` to allow apps to specify their own Env type.
 */
export const currentEnv = FiberRef.unsafeMake(null);
/**
 * FiberRef holding the current request's ExecutionContext.
 */
export const currentCtx = FiberRef.unsafeMake(null);
/**
 * Set Cloudflare bindings for the scope of an effect.
 *
 * Call this at the request boundary in your worker's fetch handler:
 *
 * ```typescript
 * const effect = handleRequest(request).pipe(
 *   withCloudflareBindings(env, ctx),
 * )
 * return runtime.runPromise(effect)
 * ```
 *
 * @param env - Cloudflare environment bindings
 * @param ctx - Cloudflare ExecutionContext
 */
export const withCloudflareBindings = (env, ctx) => (effect) => effect.pipe(Effect.locally(currentEnv, env), Effect.locally(currentCtx, ctx));
/**
 * Schedule a background task that runs after the response is sent.
 *
 * Uses ctx.waitUntil() to keep the Worker alive while the effect runs.
 * Errors are logged but don't affect the response.
 *
 * ```typescript
 * yield* waitUntil(
 *   Effect.log("Background task running...")
 * )
 * ```
 */
export const waitUntil = (effect) => Effect.gen(function* () {
    const ctx = yield* FiberRef.get(currentCtx);
    if (ctx) {
        ctx.waitUntil(Effect.runPromise(effect.pipe(Effect.tapErrorCause(Effect.logError), Effect.catchAll(() => Effect.void))));
    }
});
//# sourceMappingURL=FiberRef.js.map