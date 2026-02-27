/**
 * Server-side Type Definitions
 *
 * Types shared across server functions and middleware.
 */
import type { Effect } from "effect"
// Uncomment when adding PgDrizzle service:
// import type { PgDrizzle } from "@repo/db"
import { env } from "cloudflare:workers"

/**
 * Infer the Env type from cloudflare:workers.
 */
export type CloudflareEnv = typeof env

/**
 * Services available in the Effect runtime.
 *
 * Add your service types here as you create them:
 * @example
 * ```typescript
 * import type { PgDrizzle } from "@repo/db"
 * import type { MyCustomService } from "./services/my-service"
 *
 * export type EffectServices = PgDrizzle | MyCustomService
 * ```
 */
export type EffectServices = never // Add service types here: PgDrizzle | MyService

/**
 * Context provided by the effect runtime middleware.
 * Available to all subsequent middleware and handlers.
 */
export type EffectContext = {
  env: CloudflareEnv
  runEffect: <A, E>(effect: Effect.Effect<A, E, EffectServices>) => Promise<A>
}

/**
 * Context type for handlers that use Effect runtime.
 */
export type WithEffect<T = object> = EffectContext & T
