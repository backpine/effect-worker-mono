/**
 * RPC Runtime Configuration
 *
 * This module sets up the RPC server for handling RPC requests.
 *
 * ## Request Flow
 *
 * ```
 * fetch(request, env, ctx)
 *   └─> withCloudflareBindings(env, ctx)
 *         └─> handleRpcRequest(request)
 *               └─> Middleware chain:
 *                     ├─> RpcCloudflareMiddleware → provides env/ctx
 *                     └─> RpcDatabaseMiddleware → provides drizzle
 *                           └─> Handler accesses services via:
 *                                 - yield* CloudflareBindings
 *                                 - yield* DatabaseService
 * ```
 *
 * ## Why toHttpApp instead of toWebHandler?
 *
 * `toWebHandler` creates its own runtime internally, so FiberRefs set via
 * `withCloudflareBindings` wouldn't be accessible. By using `toHttpApp`,
 * we get an Effect that can be wrapped with `withCloudflareBindings` and
 * run in our existing ManagedRuntime, preserving FiberRef access.
 *
 * @module
 */
import { Effect, Layer, ManagedRuntime } from "effect"
import { HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { RpcServer, RpcSerialization } from "@effect/rpc"
import { UsersRpc } from "@backpine/contracts"
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
 *
 * Middleware implementations are provided at the runtime level.
 * These are needed by both handlers and RpcServer.toHttpApp.
 */
const RpcMiddlewareLive = Layer.mergeAll(
  RpcCloudflareMiddlewareLive,
  RpcDatabaseMiddlewareLive
)

/**
 * Full RPC layer including handlers, middleware, serialization, and HTTP services.
 *
 * Note: RpcMiddlewareLive is merged (not just provided) because toHttpApp
 * requires the middleware services in its context, not just as dependencies.
 */
const RpcLayer = Layer.mergeAll(
  UsersRpcHandlersLive,
  RpcMiddlewareLive,
  RpcSerialization.layerNdjson,
  HttpServer.layerContext
)

/**
 * Shared runtime for RPC requests.
 *
 * Similar to HTTP runtime, layers are memoized at startup.
 * Request-scoped services are provided via middleware.
 */
export const rpcRuntime = ManagedRuntime.make(RpcLayer)

// ============================================================================
// Request Handler
// ============================================================================

/**
 * Handle an incoming RPC request.
 *
 * Returns an Effect that should be wrapped with `withCloudflareBindings`
 * before execution to make env/ctx available to middleware.
 *
 * ## Usage
 *
 * ```typescript
 * const effect = handleRpcRequest(request).pipe(
 *   withCloudflareBindings(env, ctx),
 * )
 * return rpcRuntime.runPromise(effect)
 * ```
 */
export const handleRpcRequest = (request: Request) =>
  Effect.gen(function* () {
    // Get the RPC HTTP app (yields an httpApp function)
    const httpApp = yield* RpcServer.toHttpApp(UsersRpc, {
      spanPrefix: "RpcServer"
    })

    // Convert web request to Effect platform request
    const serverRequest = HttpServerRequest.fromWeb(request)

    // Handle and return web response
    // httpApp is an Effect<Response, E, HttpServerRequest | Scope>
    const response = yield* httpApp.pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest)
    )

    return HttpServerResponse.toWeb(response)
  }).pipe(Effect.scoped)
