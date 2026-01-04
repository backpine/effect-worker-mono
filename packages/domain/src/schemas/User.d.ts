/**
 * User Schemas
 *
 * Effect Schema definitions for user-related data structures.
 * These schemas provide both compile-time types and runtime validation.
 *
 * @module
 */
import { Schema as S } from "effect";
/**
 * User ID with format validation.
 * Format: usr_[alphanumeric]
 */
export declare const UserIdSchema: S.brand<S.filter<typeof S.String>, "UserId">;
export type UserId = typeof UserIdSchema.Type;
/**
 * Email with basic format validation.
 */
export declare const EmailSchema: S.brand<S.filter<typeof S.String>, "Email">;
export type Email = typeof EmailSchema.Type;
/**
 * User entity schema.
 */
export declare const UserSchema: S.Struct<{
    id: S.brand<S.filter<typeof S.String>, "UserId">;
    email: S.brand<S.filter<typeof S.String>, "Email">;
    name: typeof S.String;
    createdAt: typeof S.DateTimeUtc;
}>;
export type User = typeof UserSchema.Type;
/**
 * Create user request payload.
 */
export declare const CreateUserSchema: S.Struct<{
    email: S.filter<typeof S.String>;
    name: S.filter<typeof S.String>;
}>;
export type CreateUser = typeof CreateUserSchema.Type;
/**
 * User ID path parameter schema.
 */
export declare const UserIdPathSchema: S.Struct<{
    id: S.brand<S.filter<typeof S.String>, "UserId">;
}>;
//# sourceMappingURL=User.d.ts.map