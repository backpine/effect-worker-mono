/**
 * User Schemas
 *
 * Effect Schema definitions for user-related data structures.
 * These schemas provide both compile-time types and runtime validation.
 *
 * @module
 */
import { Schema as S } from "effect"

/**
 * User ID with format validation.
 * Format: usr_[alphanumeric]
 */
export const UserIdSchema = S.String.pipe(
  S.pattern(/^usr_[a-zA-Z0-9]+$/),
  S.brand("UserId")
)
export type UserId = typeof UserIdSchema.Type

/**
 * Email with basic format validation.
 */
export const EmailSchema = S.String.pipe(
  S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  S.brand("Email")
)
export type Email = typeof EmailSchema.Type

/**
 * User entity schema.
 */
export const UserSchema = S.Struct({
  id: UserIdSchema,
  email: EmailSchema,
  name: S.String,
  createdAt: S.DateTimeUtc
})
export type User = typeof UserSchema.Type

/**
 * Create user request payload.
 */
export const CreateUserSchema = S.Struct({
  email: S.String.pipe(
    S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: () => "Invalid email format"
    })
  ),
  name: S.String.pipe(S.minLength(1, { message: () => "Name is required" }))
})
export type CreateUser = typeof CreateUserSchema.Type

/**
 * User ID path parameter schema.
 */
export const UserIdPathSchema = S.Struct({
  id: UserIdSchema
})
