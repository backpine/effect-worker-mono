/**
 * Users RPC Procedures
 *
 * RPC procedure definitions for user operations. The success shape mirrors the
 * `@repo/db` `users` row directly (numeric id, no domain mapping), and errors
 * reuse the shared domain error classes the queries fail with. The whole group
 * requires `Database`, provided by `DatabaseRpcMiddleware`.
 *
 * @module
 */
import { Rpc, RpcGroup } from "effect/unstable/rpc"
import { Schema as S } from "effect"
import { UserNotFoundError, UserCreationError } from "@repo/domain"
import { DatabaseRpcMiddleware } from "../middleware"

/**
 * User RPC response schema — matches the `users` table row from `@repo/db`.
 * `createdAt` is a `Date` on the server and an ISO string on the wire.
 */
export const UserRpcSchema = S.Struct({
  id: S.Number,
  email: S.String,
  name: S.String,
  createdAt: S.DateFromString
})

/**
 * Users list response schema.
 */
export const UsersListRpcSchema = S.Struct({
  users: S.Array(UserRpcSchema),
  total: S.Number
})

/** Get a user by numeric id. */
export const getUser = Rpc.make("getUser", {
  payload: S.Struct({ id: S.Number }),
  success: UserRpcSchema,
  error: UserNotFoundError
})

/** List all users. */
export const listUsers = Rpc.make("listUsers", {
  success: UsersListRpcSchema
})

/** Create a new user. */
export const createUser = Rpc.make("createUser", {
  payload: S.Struct({ email: S.String, name: S.String }),
  success: UserRpcSchema,
  error: UserCreationError
})

/**
 * Users RPC group. `DatabaseRpcMiddleware` provides the request-scoped database
 * to every procedure (and type-subtracts `Database` from their requirements).
 */
export const UsersRpc = RpcGroup.make(getUser, listUsers, createUser).middleware(
  DatabaseRpcMiddleware
)
