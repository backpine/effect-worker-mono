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
 * Create user request payload.
 */
export const CreateUserSchema = S.Struct({
  email: S.String.pipe(
    S.check(S.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: "Invalid email format"
    }))
  ),
  name: S.String.pipe(S.check(S.isMinLength(1, { message: "Name is required" })))
})
export type CreateUser = typeof CreateUserSchema.Type
