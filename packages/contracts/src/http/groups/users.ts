/**
 * Users Endpoint Definition
 *
 * Contains only the endpoint schema definitions, no handler implementation.
 * This separation allows sharing API contracts without implementation coupling.
 *
 * @module
 */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { Schema as S } from "effect"
import {
  UserSchema,
  UserIdPathSchema,
  CreateUserSchema
} from "@repo/domain"
import { UserCreationError, UserNotFoundError } from "@repo/domain"
import { DatabaseMiddleware } from "../middleware"

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
      params: { id: UserIdPathSchema.fields.id },
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
