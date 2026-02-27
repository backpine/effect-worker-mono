/**
 * Effect Runtime Configuration
 *
 * Sets up the HTTP handler using HttpRouter.toWebHandler.
 *
 * @module
 */
import { Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { WorkerApi } from "@repo/contracts"
import { HttpGroupsLive } from "@/handlers"
import { MiddlewareLive } from "@/services"

/**
 * API routes layer.
 *
 * HttpApiBuilder.layer registers all API routes into the HttpRouter.
 * The openapiPath option automatically serves the OpenAPI spec.
 */
const ApiRoutes = HttpApiBuilder.layer(WorkerApi, {
  openapiPath: "/api/openapi.json"
}).pipe(
  Layer.provide(HttpGroupsLive),
  Layer.provide(MiddlewareLive)
)

/**
 * Web handler created from the API routes.
 *
 * Layers are memoized internally — built once at startup.
 * Per-request services (env/ctx) are passed via the ServiceMap context
 * parameter of the handler function.
 */
export const { handler, dispose } = HttpRouter.toWebHandler(
  ApiRoutes.pipe(Layer.provide(HttpServer.layerServices))
)
