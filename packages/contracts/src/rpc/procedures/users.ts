/**
 * Users RPC Procedures
 *
 * RPC procedure definitions for user operations.
 * Uses the same domain schemas as HTTP but with RPC-specific error types.
 *
 * @module
 */
import { Rpc, RpcGroup } from "effect/unstable/rpc"
import { Schema as S } from "effect"
import { RpcDatabaseMiddleware } from "../middleware"

// ============================================================================
// RPC Error Schemas
// ============================================================================

/**
 * Error returned when a user is not found.
 */
export const UserNotFoundErrorSchema = S.Struct({
  _tag: S.Literal("UserNotFound"),
  id: S.String,
  message: S.String
})

/**
 * Error returned when user creation fails due to duplicate email.
 */
export const DuplicateEmailErrorSchema = S.Struct({
  _tag: S.Literal("DuplicateEmail"),
  email: S.String
})

/**
 * Error returned when validation fails.
 */
export const ValidationErrorSchema = S.Struct({
  _tag: S.Literal("ValidationError"),
  message: S.String
})

// ============================================================================
// Shared Schemas
// ============================================================================

/**
 * User schema for RPC responses.
 */
export const UserRpcSchema = S.Struct({
  id: S.String,
  email: S.String,
  name: S.String,
  createdAt: S.DateTimeUtc
})

/**
 * Users list response schema.
 */
export const UsersListRpcSchema = S.Struct({
  users: S.Array(UserRpcSchema),
  total: S.Number
})

// ============================================================================
// RPC Procedure Definitions
// ============================================================================

/**
 * Get a user by ID.
 */
export const getUser = Rpc.make("getUser", {
  payload: S.Struct({ id: S.String }),
  success: UserRpcSchema,
  error: UserNotFoundErrorSchema
}).middleware(RpcDatabaseMiddleware)

/**
 * List all users.
 */
export const listUsers = Rpc.make("listUsers", {
  success: UsersListRpcSchema
}).middleware(RpcDatabaseMiddleware)

/**
 * Create a new user.
 */
export const createUser = Rpc.make("createUser", {
  payload: S.Struct({
    email: S.String,
    name: S.String
  }),
  success: UserRpcSchema,
  error: S.Union([DuplicateEmailErrorSchema, ValidationErrorSchema])
}).middleware(RpcDatabaseMiddleware)

// ============================================================================
// RPC Group
// ============================================================================

/**
 * Users RPC group containing all user-related procedures.
 */
export const UsersRpc = RpcGroup.make(getUser, listUsers, createUser)
