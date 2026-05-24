/**
 * Middleware Implementations
 *
 * App-specific implementation of the `DatabaseMiddleware` tag from
 * `@repo/contracts`. In Effect v4, a middleware that `provides` a service is a
 * function that wraps the downstream HTTP effect and provides that service.
 *
 * The middleware reads the typed `Bindings` at layer-build time (so the per-request
 * `env` is a layer dependency, not a leftover requirement of the wrapped effect),
 * then opens a request-scoped `PgDrizzle` connection from the Hyperdrive binding.
 * Only groups that declare `DatabaseMiddleware` (the `users` group) connect — the
 * health check never touches the database.
 *
 * @module
 */
import { Effect, Layer } from "effect"
import { DatabaseMiddleware, DatabaseConnectionError } from "@repo/contracts"
import { PgDrizzle, makeDrizzle } from "@repo/db"
import { Bindings } from "@/services/cloudflare"

export const DatabaseMiddlewareLive = Layer.effect(
  DatabaseMiddleware,
  Effect.gen(function* () {
    const { env } = yield* Bindings
    return (httpEffect) =>
      Effect.gen(function* () {
        // Only the connection attempt maps to DatabaseConnectionError; downstream
        // handler errors (e.g. UserCreationError) must propagate unchanged.
        const db = yield* makeDrizzle(env.HYPERDRIVE.connectionString).pipe(
          Effect.catch(() =>
            Effect.fail(
              new DatabaseConnectionError({
                message: "Database connection failed",
              }),
            ),
          ),
        )
        return yield* httpEffect.pipe(Effect.provideService(PgDrizzle, db))
      })
  }),
)

/** Combined middleware layer (currently just the database middleware). */
export const MiddlewareLive = DatabaseMiddlewareLive
