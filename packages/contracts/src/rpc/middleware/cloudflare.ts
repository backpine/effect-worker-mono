/**
 * Cloudflare Bindings RPC Middleware Tag
 *
 * RpcMiddleware tag that provides CloudflareBindings to RPC handlers.
 * The implementation is provided by the app using ServiceMap.Reference.
 *
 * @module
 */
import { RpcMiddleware } from "effect/unstable/rpc"
import { CloudflareBindings } from "../../services"
import { CloudflareBindingsError } from "@repo/domain"

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
export class RpcCloudflareMiddleware extends RpcMiddleware.Service<
  RpcCloudflareMiddleware,
  { provides: CloudflareBindings }
>()("@repo/rpc/RpcCloudflareMiddleware", {
  error: CloudflareBindingsError,
  requiredForClient: false
}) {}
