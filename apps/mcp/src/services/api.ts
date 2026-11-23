import { WorkerApi } from "@repo/contracts/api"
import { Context, Effect, Layer, Schema } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiClient } from "effect/http-api"

export const ApiClient = Context.Service<HttpApiClient.ForApi<typeof WorkerApi>>("mcp/ApiClient")

export const makeApiClient = (baseUrl: URL) =>
  Layer.effect(ApiClient, HttpApiClient.make(WorkerApi, { baseUrl })).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" })),
  )

export class ApiUnavailable extends Schema.TaggedError<ApiUnavailable>()(
  "ApiUnavailable",
  { message: Schema.Literal("The API is unavailable.") },
) {}

export const apiUnavailable = () => new ApiUnavailable({ message: "The API is unavailable." })
export const withApiDeadline = Effect.timeout("10 seconds")
