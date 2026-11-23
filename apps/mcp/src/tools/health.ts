import { HealthResponseSchema } from "@repo/contracts/api"
import { Effect, Layer } from "effect"
import { McpServer, Tool, Toolkit } from "effect/ai"
import { ApiClient, ApiUnavailable, apiUnavailable, withApiDeadline } from "../services/api"

const Health = Toolkit.make(Tool.make("health", {
  description: "Check API health and return its current timestamp.",
  parameters: Tool.EmptyParams,
  success: HealthResponseSchema,
  failure: ApiUnavailable,
}).annotate(Tool.Readonly, true))

const handlers = Health.toLayer(Effect.gen(function* () {
  const api = yield* ApiClient
  return Health.of({
    health: () => api.health.check().pipe(withApiDeadline, Effect.mapError(apiUnavailable)),
  })
}))

export const HealthTools = McpServer.toolkit(Health).pipe(Layer.provide(handlers))
