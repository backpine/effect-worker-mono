/**
 * Users Endpoint Definition
 *
 * Endpoint schemas only — no handler implementation. The success shape mirrors
 * the database row returned by `@repo/db` queries directly (no domain mapping),
 * so handlers can return query results as-is.
 *
 * @module
 */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { Schema as S } from "effect"
import { CreateUserSchema } from "@repo/domain"
import { UserCreationError, UserNotFoundError } from "@repo/domain"
import { DatabaseMiddleware } from "../middleware"

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

/**
 * Users endpoint group definition.
 *
 * DatabaseMiddleware provides request-scoped database connections.
 */
export const UsersGroup = HttpApiGroup.make("users")
  .add(HttpApiEndpoint.get("list", "/", { success: UsersListSchema }))
  .add(
    HttpApiEndpoint.get("get", "/:id", {
      params: { id: S.NumberFromString },
      success: UserSchema,
      error: UserNotFoundError
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateUserSchema,
      success: UserSchema,
      error: UserCreationError
    })
  )
  .middleware(DatabaseMiddleware)
  .prefix("/users")
