/**
 * RPC Middleware Implementations
 *
 * Live implementation of the `DatabaseRpcMiddleware` tag from `@repo/contracts/rpc`.
 * Mirrors the HTTP worker's `DatabaseMiddlewareLive`: it reads the Hyperdrive
 * binding via `@repo/cloudflare` and opens a request-scoped `Database` connection
 * (the request `Scope` comes from `RpcMiddleware`'s context), then provides it to
 * the downstream RPC handler.
 *
 * @module
 */
import { Effect, Layer } from "effect"
import { DatabaseRpcMiddleware } from "@repo/contracts/rpc"
import { DatabaseConnectionError } from "@repo/domain"
import { Database, connect } from "@repo/db"
import { hyperdrive } from "./cloudflare"

export const DatabaseRpcMiddlewareLive = Layer.succeed(
  DatabaseRpcMiddleware,
  (effect) =>
    Effect.gen(function* () {
      const { connectionString } = yield* hyperdrive((e) => e.HYPERDRIVE)
      const db = yield* connect(connectionString).pipe(
        Effect.catch(() =>
          Effect.fail(
            new DatabaseConnectionError({
              message: "Database connection failed"
            })
          )
        )
      )
      return yield* effect.pipe(Effect.provideService(Database, db))
    })
)
