import { ApiOriginSchema } from "@repo/contracts/api"
import { Worker } from "@repo/cloudflare"
import { Cause, Effect, Layer, Schema } from "effect"
import { McpProtocol, McpServer } from "effect/ai"
import { HttpRouter, HttpServer } from "effect/http"
import { version } from "../package.json"
import { makeApiClient } from "./services/api"
import { HealthTools } from "./tools/health"
import { UserTools } from "./tools/users"

export const makeRegistrations = (localUserTools: boolean) =>
  localUserTools ? Layer.merge(HealthTools, UserTools) : HealthTools

export const makeWorker = (options: { readonly apiUrl: string; readonly localUserTools: boolean }) =>
  Worker.make(Effect.gen(function* () {
    const baseUrl = yield* Schema.decodeUnknownEffect(ApiOriginSchema)(options.apiUrl).pipe(
      Effect.mapError(() => new Cause.IllegalArgumentError("Set API_URL to an HTTP(S) origin.")),
    )
    // The unauthenticated user API is available to MCP only in loopback development.
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname)
    const registrations = makeRegistrations(local && options.localUserTools).pipe(
      Layer.provide(makeApiClient(baseUrl)),
    )

    // Build the router and registrations once. Each POST owns its MCP execution scope.
    const fetch = yield* HttpRouter.toHttpEffect(
      McpServer.layerHttpRequestScoped({
        name: "effect-worker",
        version,
        path: "/mcp",
        protocols: [McpProtocol.v2026_07_28],
        registrations,
      }).pipe(Layer.provide(HttpServer.layerServices)),
    )
    return { fetch }
  }))
