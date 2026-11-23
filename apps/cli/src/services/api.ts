import { Config, Effect, Option, Schema } from "effect"
import { HttpClient, type HttpClientRequest } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { ApiOriginSchema, WorkerApi } from "@repo/contracts/api"
import { CliFailure } from "../errors"

const resolveOrigin = (flag: Option.Option<string>) => {
  const origin: Effect.Effect<URL, Schema.SchemaError | Config.ConfigError> = Option.isSome(flag)
    ? Schema.decodeUnknownEffect(ApiOriginSchema)(flag.value)
    : Config.schema(ApiOriginSchema, "API_URL")
  // Use a fixed diagnostic because a rejected URL can contain credentials.
  return origin.pipe(Effect.mapError(() => new CliFailure({
    exitCode: 2,
    message: "Pass --api-url or set API_URL to an HTTP(S) origin such as http://localhost:8787.",
  })))
}

const withReadRetries = (client: HttpClient.HttpClient) => {
  const reads = client.pipe(HttpClient.retryTransient({ times: 1 }))
  return HttpClient.makeWith(
    (pending: Effect.Effect<HttpClientRequest.HttpClientRequest>) => Effect.flatMap(pending, (request) =>
      (request.method === "GET" ? reads : client).execute(request)),
    Effect.succeed,
  )
}

export const requestApi = <A, E>(
  flag: Option.Option<string>,
  request: (client: HttpApiClient.ForApi<typeof WorkerApi>) => Effect.Effect<A, E>,
) => Effect.gen(function* () {
  const baseUrl = yield* resolveOrigin(flag)
  const client = yield* HttpApiClient.make(WorkerApi, { baseUrl, transformClient: withReadRetries })
  // Bound retries and response decoding with one deadline for the command.
  return yield* request(client).pipe(Effect.timeout("10 seconds"))
})
