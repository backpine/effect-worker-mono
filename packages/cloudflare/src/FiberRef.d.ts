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
 * ExecutionContext interface for Cloudflare Workers.
 */
export interface WorkerExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
}
/**
 * FiberRef holding the current request's Cloudflare environment bindings.
 * Type is `unknown` to allow apps to specify their own Env type.
 */
export declare const currentEnv: FiberRef.FiberRef<unknown>;
/**
 * FiberRef holding the current request's ExecutionContext.
 */
export declare const currentCtx: FiberRef.FiberRef<WorkerExecutionContext | null>;
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
export declare const withCloudflareBindings: <Env>(env: Env, ctx: WorkerExecutionContext) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
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
export declare const waitUntil: <A, E>(effect: Effect.Effect<A, E>) => Effect.Effect<void>;
//# sourceMappingURL=FiberRef.d.ts.map