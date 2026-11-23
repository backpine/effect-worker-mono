import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { WorkerApi } from "@repo/contracts/http"
import { type Database, UserQueries } from "@repo/db"
import type { DatabaseConnectionError } from "@repo/domain"

export const makeUsersGroup = (database: Layer.Layer<Database, DatabaseConnectionError>) => {
  // Each handler gets a fresh layer, even when several requests overlap.
  const withDatabase = Effect.provide(database, { local: true })

  return HttpApiBuilder.group(WorkerApi, "users", (handlers) =>
    handlers
      .handle("list", () =>
        UserQueries.findAllUsers.pipe(
          Effect.map((users) => ({ users, total: users.length })),
          withDatabase,
        )
      )
      .handle("get", ({ params: { id } }) => UserQueries.findUserById(id).pipe(withDatabase))
      .handle("create", ({ payload }) => UserQueries.createUser(payload).pipe(withDatabase)),
  )
}
