/**
 * Cloudflare Bindings HTTP Middleware
 *
 * HttpApiMiddleware that provides CloudflareBindings to HTTP handlers.
 * The implementation is provided by the app.
 *
 * @module
 */
import { HttpApiMiddleware } from "@effect/platform"
import {
  CloudflareBindings,
  CloudflareBindingsError
} from "@backpine/cloudflare"

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

// Re-export for convenience
export { CloudflareBindings, CloudflareBindingsError }
