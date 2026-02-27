/**
 * PgDrizzle Service
 *
 * Custom Effect v4 integration for Drizzle ORM with PostgreSQL.
 * Replaces the removed @effect/sql-drizzle package.
 *
 * @module
 */
import "./patch.js"

import { Effect, Layer, Redacted, ServiceMap } from "effect"
import { SqlClient } from "effect/unstable/sql"
import { PgClient } from "@effect/sql-pg"
import { drizzle, type RemoteCallback } from "drizzle-orm/pg-proxy"
import type { DrizzleConfig } from "drizzle-orm"

export { PgDrizzle } from "./tag.js"
import { PgDrizzle } from "./tag.js"

/**
 * Creates the RemoteCallback that bridges Drizzle's pg-proxy to Effect's SqlClient.
 */
export const makeRemoteCallback: Effect.Effect<RemoteCallback, never, SqlClient.SqlClient> =
  Effect.gen(function* () {
    const client = yield* SqlClient.SqlClient
    return ((sql: string, params: any[], method: "all" | "execute") => {
      const statement = client.unsafe(sql, params)
      const baseEffect =
        method === "execute"
          ? Effect.map(statement.raw, (result) => ({ rows: [result] }))
          : Effect.map(statement.values, (result) => ({
              rows: result as any[]
            }))
      return Effect.runPromise(baseEffect) as Promise<{ rows: any[] }>
    }) satisfies RemoteCallback
  })

/**
 * Layer that provides PgDrizzle from an existing SqlClient in context.
 */
export const PgDrizzleLive: Layer.Layer<PgDrizzle, never, SqlClient.SqlClient> =
  Layer.effect(
    PgDrizzle,
    Effect.gen(function* () {
      const callback = yield* makeRemoteCallback
      return drizzle(callback, { casing: "snake_case" })
    })
  )

/**
 * Layer that provides PgDrizzle with custom Drizzle config.
 */
export const PgDrizzleLiveWithConfig = (
  config: DrizzleConfig
): Layer.Layer<PgDrizzle, never, SqlClient.SqlClient> =>
  Layer.effect(
    PgDrizzle,
    Effect.gen(function* () {
      const callback = yield* makeRemoteCallback
      return drizzle(callback, config)
    })
  )

/**
 * Creates a complete PgDrizzle layer from a connection string.
 * Includes PgClient setup with proper lifecycle management.
 */
export const makePgDrizzleLayer = (
  connectionString: string,
  config?: DrizzleConfig
): Layer.Layer<PgDrizzle> =>
  (config
    ? PgDrizzleLiveWithConfig(config)
    : PgDrizzleLiveWithConfig({ casing: "snake_case" })
  ).pipe(
    Layer.provide(PgClient.layer({ url: Redacted.make(connectionString) }))
  ) as Layer.Layer<PgDrizzle>

/**
 * Creates a PgRemoteDatabase instance from a connection string.
 *
 * The underlying SqlClient is tied to the current Scope — it stays alive
 * for the duration of the enclosing scope (e.g. the request scope in
 * middleware).
 *
 * Requires Scope in context to manage the PgClient lifecycle.
 */
export const makeDrizzle = (
  connectionString: string
) =>
  Effect.gen(function* () {
    const services = yield* Layer.build(
      PgClient.layer({ url: Redacted.make(connectionString) })
    )
    const client = ServiceMap.get(services, SqlClient.SqlClient)
    const callback: RemoteCallback = (sql, params, method) => {
      const statement = client.unsafe(sql, params)
      const baseEffect =
        method === "execute"
          ? Effect.map(statement.raw, (result) => ({ rows: [result] }))
          : Effect.map(statement.values, (result) => ({
              rows: result as any[]
            }))
      return Effect.runPromise(baseEffect) as Promise<{ rows: any[] }>
    }
    return drizzle(callback, { casing: "snake_case" })
  })
