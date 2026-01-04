/**
 * Users RPC Handlers
 *
 * Handler implementations for the users RPC procedures.
 *
 * @module
 */
import { Effect } from "effect"
import { UsersRpc } from "@repo/contracts"
import { UserQueries } from "@repo/db"
import type { UserId, CreateUser } from "@repo/domain"

/**
 * Users RPC handler layer.
 */
export const UsersRpcHandlersLive = UsersRpc.toLayer({
  getUser: ({ id }) =>
    UserQueries.findUserById(id as UserId).pipe(
      Effect.mapError((e) => ({
        _tag: "UserNotFound" as const,
        id: e.id,
        message: e.message
      }))
    ),

  listUsers: () =>
    Effect.gen(function* () {
      const users = yield* UserQueries.findAllUsers
      return { users, total: users.length }
    }),

  createUser: (data) =>
    UserQueries.createUser(data as CreateUser).pipe(
      Effect.mapError((e) => ({
        _tag: "DuplicateEmail" as const,
        email: e.email
      }))
    )
})
