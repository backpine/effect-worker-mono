import { Context, Effect, Layer, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
import { SqlClient } from "effect/sql"

/** Open one PostgreSQL connection for the caller's scope. */
export const connect = (connectionString: string) =>
  Layer.build(
    PgClient.layerFrom(PgClient.makeClient({ url: Redacted.make(connectionString) })),
  ).pipe(Effect.map(Context.get(SqlClient.SqlClient)))
