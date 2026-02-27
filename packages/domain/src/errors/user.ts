/**
 * User Errors
 *
 * Error types for user-related operations with automatic status code mapping.
 *
 * @module
 */
import { Schema as S } from "effect"
import { UserIdSchema } from "../schemas/user"

/**
 * Error returned when a user creation fails.
 *
 * HTTP Status: 400 Bad Request
 */
export class UserCreationError extends S.TaggedErrorClass<UserCreationError>()(
  "UserCreationError",
  {
    email: S.String,
    name: S.String
  },
  { httpApiStatus: 400 }
) {}

/**
 * Error returned when a user is not found.
 *
 * HTTP Status: 404 Not Found
 */
export class UserNotFoundError extends S.TaggedErrorClass<UserNotFoundError>()(
  "UserNotFoundError",
  {
    id: UserIdSchema,
    message: S.String
  },
  { httpApiStatus: 404 }
) {}
