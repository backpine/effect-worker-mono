/**
 * Service Tags
 *
 * Context tags for Cloudflare Worker services.
 * These are shared between HTTP and RPC middleware.
 *
 * @module
 */
import { Context } from "effect"
import type { WorkerExecutionContext } from "./fiber-ref"

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
export class CloudflareBindings extends Context.Tag(
  "@repo/cloudflare/CloudflareBindings"
)<
  CloudflareBindings,
  { readonly env: unknown; readonly ctx: WorkerExecutionContext }
>() {}
