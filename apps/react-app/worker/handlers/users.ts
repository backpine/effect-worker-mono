import { Effect, type Layer } from "effect"
import { UsersRpc } from "@repo/contracts/rpc"
import type { Database } from "@repo/db/database"
import { UserQueries } from "@repo/db/queries"
import type { DatabaseConnectionError } from "@repo/domain"

export const makeUsersHandlers = (database: Layer.Layer<Database, DatabaseConnectionError>) => {
  // Each decoded call owns its connection, including calls in the same batch.
  const withDatabase = Effect.provide(database, { local: true })

  return UsersRpc.toLayer({
    listUsers: () =>
      UserQueries.findAllUsers.pipe(
        Effect.map((users) => ({ users, total: users.length })),
        withDatabase,
      ),
    getUser: ({ id }) => UserQueries.findUserById(id).pipe(withDatabase),
    createUser: (payload) => UserQueries.createUser(payload).pipe(withDatabase),
  })
}
