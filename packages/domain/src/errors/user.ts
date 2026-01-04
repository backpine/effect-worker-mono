/**
 * User Errors
 *
 * Error types for user-related operations with automatic status code mapping.
 *
 * @module
 */
import { HttpApiSchema } from "@effect/platform"
import { Schema as S } from "effect"
import { UserIdSchema } from "../schemas/user"

/**
 * Error returned when a user creation fails.
 *
 * HTTP Status: 400 Bad Request
 */
export class UserCreationError extends S.TaggedError<UserCreationError>()(
  "UserCreationError",
  {
    email: S.String,
    name: S.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/**
 * Error returned when a user is not found.
 *
 * HTTP Status: 404 Not Found
 */
export class UserNotFoundError extends S.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  {
    id: UserIdSchema,
    message: S.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {}
