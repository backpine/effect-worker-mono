/**
 * HTTP API runtime
 *
 * Builds the `WorkerApi` into a request-handling `HttpEffect` using
 * `HttpRouter.toHttpEffect` — the HTTP analog of `RpcServer.toHttpEffect`, and
 * the same approach Alchemy v2 uses to serve an `HttpApi` from a Worker. The
 * resulting effect is run per request by `index.ts`.
 *
 * @module
 */
import { Effect, FileSystem, Layer, Path } from "effect"
import { Etag, HttpPlatform, HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { WorkerApi } from "@repo/contracts"
import { HttpGroupsLive } from "@/handlers"
import { MiddlewareLive } from "@/services"

/**
 * `HttpPlatform` stub. This Worker only returns JSON (incl. the OpenAPI spec),
 * never file responses, so we avoid `HttpServer.layerServices` and the
 * `FileSystem` dependency it pulls in (unavailable in Workers). Mirrors Alchemy v2.
 */
const HttpPlatformStub = Layer.succeed(HttpPlatform.HttpPlatform, {
  fileResponse: () =>
    Effect.die("HttpPlatform.fileResponse is not supported in Workers"),
  fileWebResponse: () =>
    Effect.die("HttpPlatform.fileWebResponse is not supported in Workers"),
})

/**
 * The API as a layer: all routes registered into the router (with the OpenAPI
 * spec served at `/api/openapi.json`), handler implementations, the database
 * middleware, and the lean platform services.
 */
const ApiLayer = HttpApiBuilder.layer(WorkerApi, {
  openapiPath: "/api/openapi.json",
}).pipe(
  Layer.provide(HttpGroupsLive),
  Layer.provide(MiddlewareLive),
  Layer.provide([
    Etag.layer,
    HttpPlatformStub,
    Path.layer,
    // Workers have no filesystem; the API never reads files, so a noop satisfies
    // the FileSystem requirement that HttpApiBuilder pulls in.
    FileSystem.layerNoop({}),
  ]),
)

/**
 * The request handler as an `HttpEffect`. `index.ts` provides the per-request
 * `Bindings` and `HttpServerRequest`, runs it in a fresh `Scope`, and converts
 * the response back to a Web `Response`.
 */
export const apiApp = HttpRouter.toHttpEffect(ApiLayer)
