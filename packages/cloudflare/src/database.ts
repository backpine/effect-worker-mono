/**
 * Database Connection Factory
 *
 * Provides utilities for creating request-scoped database connections.
 * Uses @effect/sql-drizzle's PgDrizzle directly for type-safe database access.
 *
 * @module
 */
import { Effect, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
import { PgDrizzle, make as makePgDrizzle } from "@effect/sql-drizzle/Pg"
import * as Reactivity from "@effect/experimental/Reactivity"
import * as SqlClient from "@effect/sql/SqlClient"



/**
 * Creates a scoped PgDrizzle instance for request-scoped database access.
 *
 * Used by middleware to provide PgDrizzle to handlers.
 * The connection is automatically closed when the scope ends.
 *
 * @param connectionString - PostgreSQL connection URL
 *
 * @example
 * ```typescript
 * // In middleware:
 * return yield* makeDrizzle(connectionString)
 *
 * // In handlers:
 * const drizzle = yield* PgDrizzle
 * const users = yield* drizzle.select().from(usersTable)
 * ```
 */
export const makeDrizzle = (connectionString: string) =>
  Effect.gen(function* () {
    const pgClient = yield* PgClient.make({
      url: Redacted.make(connectionString)
    }).pipe(Effect.provide(Reactivity.layer))

    return yield* makePgDrizzle({
      casing: "snake_case"
    }).pipe(Effect.provideService(SqlClient.SqlClient, pgClient))
  })

// Re-export the PgDrizzle tag for convenience
export { PgDrizzle }
