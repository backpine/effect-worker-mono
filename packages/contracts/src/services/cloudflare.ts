/**
 * Cloudflare Bindings Service Tag
 *
 * Context tag for Cloudflare Worker bindings.
 * Shared between HTTP and RPC middleware.
 *
 * @module
 */
import { ServiceMap } from "effect"

/**
 * ExecutionContext interface for Cloudflare Workers.
 */
export interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

/**
 * CloudflareBindings service provides access to Cloudflare's env and ctx.
 *
 * Apps should cast the `env` to their specific Env type when accessing:
 *
 * ```typescript
 * const { env, ctx } = yield* CloudflareBindings
 * const myEnv = env as MyEnvType
 * ```
 */
export class CloudflareBindings extends ServiceMap.Service<
  CloudflareBindings,
  { readonly env: unknown; readonly ctx: WorkerExecutionContext }
>()("@repo/cloudflare/CloudflareBindings") {}
