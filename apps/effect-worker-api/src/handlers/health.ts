/**
 * Health Handler Implementation
 *
 * @module
 */
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { DateTime, Effect } from "effect"
import { WorkerApi } from "@repo/contracts"

/**
 * Health endpoint handler implementation.
 */
export const HealthGroupLive = HttpApiBuilder.group(
  WorkerApi,
  "health",
  (handlers) =>
    handlers.handle("check", () =>
      Effect.gen(function* () {
        return {
          status: "ok" as const,
          timestamp: DateTime.nowUnsafe()
        }
      })
    )
)
