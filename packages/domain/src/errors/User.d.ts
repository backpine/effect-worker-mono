import { Schema as S } from "effect";
declare const UserCreationError_base: S.TaggedErrorClass<UserCreationError, "UserCreationError", {
    readonly _tag: S.tag<"UserCreationError">;
} & {
    email: typeof S.String;
    name: typeof S.String;
}>;
/**
 * Error returned when a user creation fails.
 *
 * HTTP Status: 400 Bad Request
 */
export declare class UserCreationError extends UserCreationError_base {
}
declare const UserNotFoundError_base: S.TaggedErrorClass<UserNotFoundError, "UserNotFoundError", {
    readonly _tag: S.tag<"UserNotFoundError">;
} & {
    id: S.brand<S.filter<typeof S.String>, "UserId">;
    message: typeof S.String;
}>;
/**
 * Error returned when a user is not found.
 *
 * HTTP Status: 404 Not Found
 */
export declare class UserNotFoundError extends UserNotFoundError_base {
}
export {};
//# sourceMappingURL=User.d.ts.map