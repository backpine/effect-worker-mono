/**
 * Request-scoped database connection factory.
 *
 * Builds the first-class `drizzle-orm/effect-postgres` database over an
 * `@effect/sql-pg` `PgClient`. The `PgClient` pool is built into the **ambient
 * `Scope`** (the request scope, provided by the middleware) via `Layer.build`,
 * so the socket stays open for the whole request and closes when that scope
 * closes. Nothing connects at module load.
 *
 * @module
 */
import { Effect, Layer, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
import { makeWithDefaults } from "drizzle-orm/effect-postgres"

/**
 * Open a request-scoped Drizzle database for the given Hyperdrive connection
 * string. Requires `Scope` in context (the request scope) — the pool's lifetime
 * is tied to it.
 */
export const connect = (connectionString: string) =>
  Effect.gen(function* () {
    const pg = yield* Layer.build(
      PgClient.layer({ url: Redacted.make(connectionString) }),
    )
    return yield* makeWithDefaults().pipe(Effect.provide(pg))
  })
