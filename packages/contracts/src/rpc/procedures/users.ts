import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import {
  CreateUserSchema,
  DatabaseConnectionError,
  UserCreationError,
  UserNotFoundError,
} from "@repo/domain"

/** `createdAt` is a Date in the application and an ISO string on the wire. */
export const UserRpcSchema = Schema.Struct({
  id: Schema.Number,
  email: Schema.String,
  name: Schema.String,
  createdAt: Schema.DateFromString,
})

export const UsersListRpcSchema = Schema.Struct({
  users: Schema.Array(UserRpcSchema),
  total: Schema.Number,
})

export const getUser = Rpc.make("getUser", {
  payload: Schema.Struct({ id: Schema.Number }),
  success: UserRpcSchema,
  error: Schema.Union([UserNotFoundError, DatabaseConnectionError]),
})

export const listUsers = Rpc.make("listUsers", {
  success: UsersListRpcSchema,
  error: DatabaseConnectionError,
})

export const createUser = Rpc.make("createUser", {
  payload: CreateUserSchema,
  success: UserRpcSchema,
  error: Schema.Union([UserCreationError, DatabaseConnectionError]),
})

export const UsersRpc = RpcGroup.make(getUser, listUsers, createUser)
