/**
 * Users RPC handlers (in-memory, no database)
 *
 * Implements the shared `UsersRpc` contract from `@repo/contracts/rpc`. The same
 * contract is consumed by the React client (`src/atoms`), so the request/response
 * types are guaranteed identical on both ends — no casting required.
 *
 * State is a module-level array purely for the demo; a Worker isolate is not a
 * durable store, so created users live only for the lifetime of the isolate. A
 * real database can be reintroduced later behind these same handlers.
 *
 * @module
 */
import { DateTime, Effect } from "effect"
import {
  UsersRpc,
  UserRpcSchema,
  UserNotFoundErrorSchema,
  DuplicateEmailErrorSchema,
} from "@repo/contracts/rpc"

/** Decoded shape of a user, derived from the shared schema. */
type User = typeof UserRpcSchema.Type

/** In-memory seed data. `createdAt` is a real `DateTime.Utc`, built without casts. */
const users: Array<User> = [
  {
    id: "1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    createdAt: DateTime.makeUnsafe(Date.UTC(2024, 0, 1)),
  },
  {
    id: "2",
    name: "Alan Turing",
    email: "alan@example.com",
    createdAt: DateTime.makeUnsafe(Date.UTC(2024, 5, 23)),
  },
]

// Error constructors with explicit return annotations so the `_tag` literals are
// contextually typed to the schema — keeps everything inferred, no `as` anywhere.
const userNotFound = (id: string): typeof UserNotFoundErrorSchema.Type => ({
  _tag: "UserNotFound",
  id,
  message: `User ${id} not found`,
})

const duplicateEmail = (
  email: string,
): typeof DuplicateEmailErrorSchema.Type => ({
  _tag: "DuplicateEmail",
  email,
})

/**
 * The handler layer for the `UsersRpc` group. `toLayer` checks each handler's
 * success/error/requirements against the contract, so a mismatch is a type error.
 */
export const UsersHandlers = UsersRpc.toLayer({
  listUsers: () => Effect.succeed({ users, total: users.length }),

  getUser: ({ id }) => {
    const user = users.find((u) => u.id === id)
    return user ? Effect.succeed(user) : Effect.fail(userNotFound(id))
  },

  createUser: ({ email, name }) =>
    Effect.gen(function* () {
      if (users.some((u) => u.email === email)) {
        return yield* Effect.fail(duplicateEmail(email))
      }
      const user: User = {
        id: crypto.randomUUID(),
        email,
        name,
        createdAt: DateTime.nowUnsafe(),
      }
      users.push(user)
      return user
    }),
})
