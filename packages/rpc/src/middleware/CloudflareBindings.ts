/**
 * Cloudflare Bindings RPC Middleware Tag
 *
 * RpcMiddleware tag that provides CloudflareBindings to RPC handlers.
 * The implementation is provided by the app using FiberRefs.
 *
 * @module
 */
import { RpcMiddleware } from "@effect/rpc"
import {
  CloudflareBindings,
  CloudflareBindingsError
} from "@backpine/cloudflare"

/**
 * Middleware that provides CloudflareBindings to RPC handlers.
 *
 * Apply to RPC procedures that need access to Cloudflare env/ctx:
 *
 * ```typescript
 * const myRpc = Rpc.make("myRpc", { ... })
 *   .middleware(RpcCloudflareMiddleware)
 * ```
 *
 * Implementation is provided by the app layer.
 */
export class RpcCloudflareMiddleware extends RpcMiddleware.Tag<RpcCloudflareMiddleware>()(
  "@backpine/rpc/RpcCloudflareMiddleware",
  {
    failure: CloudflareBindingsError,
    provides: CloudflareBindings
  }
) {}
