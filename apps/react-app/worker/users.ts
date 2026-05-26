/**
 * Users RPC handlers (database-backed)
 *
 * Implements the shared `UsersRpc` contract using the same `@repo/db` query
 * programs as the HTTP API — one source of truth for both transports. The
 * handlers require `Database`, which `DatabaseRpcMiddleware` provides per request.
 *
 * @module
 */
import { Effect } from "effect"
import { UsersRpc } from "@repo/contracts/rpc"
import { UserQueries } from "@repo/db"

export const UsersHandlers = UsersRpc.toLayer({
  listUsers: () =>
    Effect.map(UserQueries.findAllUsers, (users) => ({
      users,
      total: users.length
    })),

  getUser: ({ id }) => UserQueries.findUserById(id),

  createUser: ({ email, name }) => UserQueries.createUser({ email, name })
})
