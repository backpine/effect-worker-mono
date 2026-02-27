/**
 * Effect Runtime Middleware
 *
 * Creates a scoped Effect runtime that provides services to all handlers.
 * The runtime is created per-request and cleaned up when the request completes.
 *
 * To add services:
 * 1. Create a Layer for your service
 * 2. Add it to servicesLayer via Layer.mergeAll
 * 3. Add the service type to EffectServices in types.ts
 *
 * @example Adding PgDrizzle (requires HYPERDRIVE binding in wrangler.jsonc):
 * ```typescript
 * import { PgDrizzle, makePgDrizzleLayer } from "@repo/db"
 *
 * const dbLayer = makePgDrizzleLayer(env.HYPERDRIVE.connectionString)
 * const servicesLayer = Layer.mergeAll(dbLayer, otherServiceLayer)
 * ```
 */
import { createMiddleware } from "@tanstack/react-start"
import { Effect, Layer, ManagedRuntime } from "effect"
import { env } from "cloudflare:workers"
import type { EffectServices } from "../types"

/**
 * Middleware that creates a scoped Effect runtime.
 *
 * Provides `runEffect` to handlers for executing Effect programs.
 *
 * @example
 * ```typescript
 * // In a server function:
 * export const myFunction = createServerFn()
 *   .middleware([effectRuntimeMiddleware])
 *   .handler(async ({ context }) => {
 *     return context.runEffect(
 *       Effect.gen(function* () {
 *         // Access services via yield*
 *         return { success: true }
 *       })
 *     )
 *   })
 * ```
 */
export const effectRuntimeMiddleware = createMiddleware().server(
  async ({ next }) => {
    // Create service layers
    // Add your service layers here and merge them:
    //
    // Example with PgDrizzle (uncomment when HYPERDRIVE is configured):
    // const dbLayer = makePgDrizzleLayer(env.HYPERDRIVE.connectionString)
    // const servicesLayer = Layer.mergeAll(dbLayer, otherServiceLayer)

    // Empty layer - add your services above
    const servicesLayer = Layer.empty

    const runtime = ManagedRuntime.make(servicesLayer)

    try {
      const runEffect = <A, E>(
        effect: Effect.Effect<A, E, EffectServices>
      ) => {
        return runtime.runPromise(effect)
      }

      return await next({
        context: {
          env,
          runEffect,
        },
      })
    } finally {
      await runtime.dispose()
    }
  }
)
