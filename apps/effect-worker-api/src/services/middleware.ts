/**
 * Middleware Implementations
 *
 * App-specific implementation of the `DatabaseMiddleware` tag from
 * `@repo/contracts`. In Effect v4, a middleware that `provides` a service is a
 * function that wraps the downstream HTTP effect and provides that service.
 *
 * It yields the Hyperdrive binding via `@repo/cloudflare` (`CloudflareEnv` is a
 * `Context.Reference`, so reading it adds nothing to the requirement channel),
 * opens a request-scoped `Database` connection (first-class
 * `drizzle-orm/effect-postgres` client via `connect`), and provides it
 * downstream. Only groups that declare `DatabaseMiddleware` (the `users` group)
 * connect — the request `Scope` (from `HttpRouter.Provided`) owns the socket.
 *
 * @module
 */
import { Effect, Layer } from "effect"
import { DatabaseMiddleware, DatabaseConnectionError } from "@repo/contracts"
import { Database, connect } from "@repo/db"
import { hyperdrive } from "@/services/cloudflare"

export const DatabaseMiddlewareLive = Layer.succeed(
  DatabaseMiddleware,
  (httpEffect) =>
    Effect.gen(function* () {
      const { connectionString } = yield* hyperdrive((e) => e.HYPERDRIVE)
      // Only the connection attempt maps to DatabaseConnectionError; downstream
      // handler errors (e.g. UserCreationError) must propagate unchanged.
      const db = yield* connect(connectionString).pipe(
        Effect.catch(() =>
          Effect.fail(
            new DatabaseConnectionError({
              message: "Database connection failed",
            }),
          ),
        ),
      )
      return yield* httpEffect.pipe(Effect.provideService(Database, db))
    }),
)

/** Combined middleware layer (currently just the database middleware). */
export const MiddlewareLive = DatabaseMiddlewareLive
