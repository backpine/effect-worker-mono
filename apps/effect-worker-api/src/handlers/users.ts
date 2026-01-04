/**
 * Users Handler Implementation
 *
 * @module
 */
import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { WorkerApi } from "@backpine/contracts"
import { UserQueries } from "@backpine/db"

/**
 * Users endpoint handler implementation.
 */
export const UsersGroupLive = HttpApiBuilder.group(
  WorkerApi,
  "users",
  (handlers) =>
    Effect.gen(function* () {
      return handlers
        .handle("list", () =>
          Effect.gen(function* () {
            const users = yield* UserQueries.findAllUsers
            return { users, total: users.length }
          })
        )
        .handle("get", ({ path: { id } }) => UserQueries.findUserById(id))
        .handle("create", ({ payload }) => UserQueries.createUser(payload))
    })
)
