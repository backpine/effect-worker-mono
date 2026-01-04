/**
 * Database Service
 *
 * Provides access to a Drizzle ORM instance for database operations.
 *
 * @module
 */
import { Effect, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import * as Reactivity from "@effect/experimental/Reactivity"
import * as SqlClient from "@effect/sql/SqlClient"
import type { PgRemoteDatabase } from "drizzle-orm/pg-proxy"

/**
 * Type alias for the Drizzle database instance.
 */
export type DrizzleInstance = PgRemoteDatabase<Record<string, never>>

/**
 * Default database URL for local development.
 */
export const LOCAL_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/effect_worker"

/**
 * Create a scoped database connection.
 *
 * Used by middleware to provide request-scoped database access.
 * The connection is automatically closed when the scope ends.
 *
 * @param connectionString - PostgreSQL connection URL
 */
export const makeDatabaseConnection = (connectionString: string) =>
  Effect.gen(function* () {
    const pgClient = yield* PgClient.make({
      url: Redacted.make(connectionString)
    }).pipe(Effect.provide(Reactivity.layer))

    const drizzle = yield* PgDrizzle.make({
      casing: "snake_case"
    }).pipe(Effect.provideService(SqlClient.SqlClient, pgClient))

    return { db: drizzle }
  })

// Re-export for convenience
export { PgDrizzle }
