/**
 * RPC Runtime Configuration
 *
 * Sets up the RPC server using HttpRouter.toWebHandler.
 *
 * @module
 */
import { Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { RpcServer, RpcSerialization } from "effect/unstable/rpc"
import { UsersRpc } from "@repo/contracts"
import { UsersRpcHandlersLive } from "@/handlers"
import {
  RpcCloudflareMiddlewareLive,
  RpcDatabaseMiddlewareLive
} from "@/services"

// ============================================================================
// Layer Composition
// ============================================================================

/**
 * Combined middleware layer.
 */
const RpcMiddlewareLive = Layer.mergeAll(
  RpcCloudflareMiddlewareLive,
  RpcDatabaseMiddlewareLive
)

/**
 * Protocol layer — HTTP transport with ndjson serialization.
 *
 * layerProtocolHttp requires RpcSerialization + HttpRouter.
 * We provide RpcSerialization here; HttpRouter is provided by toWebHandler.
 */
const ProtocolLayer = RpcServer.layerProtocolHttp({ path: "/rpc" }).pipe(
  Layer.provide(RpcSerialization.layerNdjson)
)

/**
 * Full RPC routes layer.
 *
 * RpcServer.layer requires Protocol + handlers + middleware.
 * After composition, only HttpRouter remains as a requirement
 * (provided by HttpRouter.toWebHandler).
 */
const RpcRoutes = RpcServer.layer(UsersRpc).pipe(
  Layer.provide(UsersRpcHandlersLive),
  Layer.provide(RpcMiddlewareLive),
  Layer.provide(ProtocolLayer)
)

/**
 * Web handler for RPC requests.
 *
 * Layers are memoized internally — built once at startup.
 * Per-request services (env/ctx) are passed via the ServiceMap context.
 */
export const { handler: rpcHandler, dispose } = HttpRouter.toWebHandler(
  RpcRoutes.pipe(Layer.provide(HttpServer.layerServices))
)
