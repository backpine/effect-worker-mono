import { DateTime, Effect } from "effect"
import { Command } from "effect/cli"
import { HealthResponseSchema } from "@repo/contracts/api"
import { printResult } from "../output"
import { requestApi } from "../services/api"
import { root } from "./root"

export const health = Command.make("health", {}, Effect.fn(function* () {
  const { apiUrl, json } = yield* root
  const result = yield* requestApi(apiUrl, (api) => api.health.check())
  yield* printResult(json, HealthResponseSchema, result, (health) =>
    `API health is ${health.status} at ${DateTime.formatIso(health.timestamp)}`)
})).pipe(Command.withDescription("Check API health"))
