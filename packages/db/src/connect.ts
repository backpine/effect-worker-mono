import { Context, Effect, Layer, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
import { makeWithDefaults } from "drizzle-orm/effect-postgres"

/** Open a Drizzle database in the caller's scope. */
export const connect = (connectionString: string) =>
  Effect.gen(function* () {
    const pg = yield* Layer.build(
      PgClient.layer({ url: Redacted.make(connectionString) }),
    )
    // The pool is lazy. Check out a connection so acquisition failures surface here.
    yield* Effect.scoped(Context.get(pg, PgClient.PgClient).reserve)
    return yield* makeWithDefaults().pipe(Effect.provide(pg))
  })
