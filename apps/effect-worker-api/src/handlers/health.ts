/**
 * Health Handler Implementation
 *
 * @module
 */
import { HttpApiBuilder } from "@effect/platform"
import { DateTime, Effect } from "effect"
import { WorkerApi } from "@repo/contracts"

/**
 * Health endpoint handler implementation.
 */
export const HealthGroupLive = HttpApiBuilder.group(
  WorkerApi,
  "health",
  (handlers) =>
    Effect.gen(function* () {
      return handlers.handle("check", () =>
        Effect.gen(function* () {
          return {
            status: "ok" as const,
            timestamp: DateTime.unsafeNow()
          }
        })
      )
    })
)
