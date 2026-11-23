import { env } from "cloudflare:workers"
import { Effect, Layer } from "effect"
import { makeCloudflare } from "@repo/cloudflare"
import { connect } from "@repo/db/connect"
import { Database } from "@repo/db/database"
import { DatabaseConnectionError } from "@repo/domain"

const { hyperdrive } = makeCloudflare<Env>(() => env)

/** The users group builds this layer in the request, where Hyperdrive can connect. */
export const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const { connectionString } = yield* hyperdrive((bindings) => bindings.HYPERDRIVE)
    return yield* connect(connectionString).pipe(
      Effect.mapError(() => new DatabaseConnectionError({ message: "Database connection failed" })),
    )
  }),
)
