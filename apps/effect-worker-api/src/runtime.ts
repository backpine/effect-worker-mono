/**
 * Effect Runtime Configuration
 *
 * Sets up the ManagedRuntime for handling HTTP requests.
 *
 * @module
 */
import { Effect, Layer, ManagedRuntime } from "effect"
import { HttpApiBuilder, HttpServer, OpenApi } from "@effect/platform"
import * as ServerRequest from "@effect/platform/HttpServerRequest"
import * as ServerResponse from "@effect/platform/HttpServerResponse"
import { WorkerApi } from "@backpine/contracts"
import { HttpGroupsLive } from "@/handlers"
import { MiddlewareLive } from "@/services"

/**
 * API Layer combining static services.
 *
 * These layers are memoized by ManagedRuntime - built once at startup.
 * Middleware layers are provided here so their implementations are available,
 * but the middleware effects run per-request.
 */
const ApiLayer = Layer.mergeAll(
  HttpApiBuilder.api(WorkerApi).pipe(Layer.provide(HttpGroupsLive)),
  HttpApiBuilder.Router.Live,
  HttpApiBuilder.Middleware.layer,
  HttpServer.layerContext
).pipe(Layer.provide(MiddlewareLive))

/**
 * Shared runtime instance.
 *
 * Built once at module initialization. Layers are memoized, so subsequent
 * calls to runPromise reuse the same service instances.
 */
export const runtime = ManagedRuntime.make(ApiLayer)

/**
 * Handle an incoming HTTP request.
 *
 * Returns an Effect that can be wrapped with request-scoped services
 * (Cloudflare env/ctx) before execution.
 */
export const handleRequest = (request: Request) =>
  Effect.gen(function* () {
    const app = yield* HttpApiBuilder.httpApp
    const serverRequest = ServerRequest.fromWeb(request)
    const url = new URL(request.url)

    const response = yield* app.pipe(
      Effect.provideService(ServerRequest.HttpServerRequest, serverRequest),
      Effect.scoped,
      Effect.catchAll(() =>
        ServerResponse.json(
          {
            _tag: "NotFoundError",
            path: url.pathname,
            message: `Route not found: ${request.method} ${url.pathname}`
          },
          { status: 404 }
        )
      )
    )

    return ServerResponse.toWeb(response)
  })

/**
 * OpenAPI specification for the API.
 *
 * Generated from the WorkerApi definition.
 */
export const openApiSpec = OpenApi.fromApi(WorkerApi)
