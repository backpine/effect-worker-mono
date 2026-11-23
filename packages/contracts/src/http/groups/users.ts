/**
 * Users Endpoint Definition
 *
 * Endpoint schemas only — no handler implementation. The success shape mirrors
 * the database row returned by `@repo/db` queries directly (no domain mapping),
 * so handlers can return query results as-is.
 *
 * @module
 */
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { Schema as S } from "effect"
import { CreateUserSchema } from "@repo/domain"
import { DatabaseConnectionError, UserCreationError, UserNotFoundError } from "@repo/domain"

/**
 * User response schema — matches the `users` table row from `@repo/db`.
 * `createdAt` is a `Date` on the server and an ISO string on the wire.
 */
export const UserSchema = S.Struct({
  id: S.Number,
  email: S.String,
  name: S.String,
  createdAt: S.DateFromString
})
export type User = typeof UserSchema.Type

/**
 * Users list response schema.
 */
export const UsersListSchema = S.Struct({
  users: S.Array(UserSchema),
  total: S.Number
})
export type UsersList = typeof UsersListSchema.Type

export const UsersGroup = HttpApiGroup.make("users")
  .add(HttpApiEndpoint.get("list", "/", { success: UsersListSchema, error: DatabaseConnectionError }))
  .add(
    HttpApiEndpoint.get("get", "/:id", {
      params: { id: S.FiniteFromString },
      success: UserSchema,
      error: [UserNotFoundError, DatabaseConnectionError]
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateUserSchema,
      success: UserSchema,
      error: [UserCreationError, DatabaseConnectionError]
    })
  )
  .prefix("/users")
