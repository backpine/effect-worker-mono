import { DateTime, Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { WorkerApi } from "@repo/contracts/api"

/** Liveness is independent of the database. */
export const HealthGroupLive = HttpApiBuilder.group(WorkerApi, "health", (handlers) =>
  handlers.handle("check", () =>
    Effect.succeed({ status: "ok", timestamp: DateTime.nowUnsafe() })
  )
)
