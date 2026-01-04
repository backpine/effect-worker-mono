/**
 * Users Endpoint Definition
 *
 * Contains only the endpoint schema definitions, no handler implementation.
 * This separation allows sharing API contracts without implementation coupling.
 *
 * @module
 */
import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema as S } from "effect"
import {
  UserSchema,
  UserIdPathSchema,
  CreateUserSchema
} from "@backpine/domain"
import { UserCreationError, UserNotFoundError } from "@backpine/domain"
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
  .add(HttpApiEndpoint.get("list", "/").addSuccess(UsersListSchema))
  .add(
    HttpApiEndpoint.get("get", "/:id")
      .setPath(UserIdPathSchema)
      .addSuccess(UserSchema)
      .addError(UserNotFoundError)
  )
  .add(
    HttpApiEndpoint.post("create", "/")
      .setPayload(CreateUserSchema)
      .addSuccess(UserSchema)
      .addError(UserCreationError)
  )
  .middleware(DatabaseMiddleware)
  .prefix("/users")
