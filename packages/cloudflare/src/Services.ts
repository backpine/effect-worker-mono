/**
 * Service Tags
 *
 * Context tags for Cloudflare Worker services.
 * These are shared between HTTP and RPC middleware.
 *
 * @module
 */
import { Context } from "effect"
import type { WorkerExecutionContext } from "./FiberRef.js"

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
  "@backpine/cloudflare/CloudflareBindings"
)<
  CloudflareBindings,
  { readonly env: unknown; readonly ctx: WorkerExecutionContext }
>() {}

/**
 * DatabaseService provides access to a request-scoped database instance.
 *
 * Apps should cast the `db` to their specific database type when accessing:
 *
 * ```typescript
 * const { db } = yield* DatabaseService
 * const drizzle = db as DrizzleInstance
 * ```
 */
export class DatabaseService extends Context.Tag(
  "@backpine/cloudflare/DatabaseService"
)<DatabaseService, { readonly db: unknown }>() {}
