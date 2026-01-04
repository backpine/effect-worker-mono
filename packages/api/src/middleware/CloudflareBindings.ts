/**
 * Cloudflare Bindings Middleware Definition
 *
 * Defines the middleware tag for providing Cloudflare bindings to handlers.
 * The implementation is provided by the app since it requires access to
 * app-specific FiberRefs.
 *
 * @module
 */
import { HttpApiMiddleware, HttpApiSchema } from "@effect/platform"
import { Context, Schema as S } from "effect"

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
 * Apps should cast the `env` to their specific Env type when accessing.
 */
export class CloudflareBindings extends Context.Tag(
  "@backpine/api/CloudflareBindings"
)<
  CloudflareBindings,
  { readonly env: unknown; readonly ctx: WorkerExecutionContext }
>() {}

/**
 * Error when Cloudflare bindings are not available.
 */
export class CloudflareBindingsError extends S.TaggedError<CloudflareBindingsError>()(
  "CloudflareBindingsError",
  { message: S.String },
  HttpApiSchema.annotations({ status: 500 })
) {}

/**
 * Middleware that provides CloudflareBindings to HTTP handlers.
 *
 * Apply at the API level to make env/ctx available everywhere:
 *
 * ```typescript
 * export class WorkerApi extends HttpApi.make("WorkerApi")
 *   .add(UsersGroup)
 *   .middleware(CloudflareBindingsMiddleware)
 *   .prefix("/api") {}
 * ```
 *
 * The implementation must be provided by the app via Layer.
 */
export class CloudflareBindingsMiddleware extends HttpApiMiddleware.Tag<CloudflareBindingsMiddleware>()(
  "@backpine/api/CloudflareBindingsMiddleware",
  {
    failure: CloudflareBindingsError,
    provides: CloudflareBindings
  }
) {}
