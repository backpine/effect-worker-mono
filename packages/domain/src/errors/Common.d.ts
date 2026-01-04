import { Schema as S } from "effect";
declare const NotFoundError_base: S.TaggedErrorClass<NotFoundError, "NotFoundError", {
    readonly _tag: S.tag<"NotFoundError">;
} & {
    path: typeof S.String;
    message: typeof S.String;
}>;
/**
 * Generic error returned when a resource or route is not found.
 *
 * HTTP Status: 404 Not Found
 */
export declare class NotFoundError extends NotFoundError_base {
}
declare const ValidationError_base: S.TaggedErrorClass<ValidationError, "ValidationError", {
    readonly _tag: S.tag<"ValidationError">;
} & {
    message: typeof S.String;
    errors: S.Array$<typeof S.String>;
}>;
/**
 * Error returned for invalid request data.
 *
 * HTTP Status: 400 Bad Request
 */
export declare class ValidationError extends ValidationError_base {
}
export {};
//# sourceMappingURL=Common.d.ts.map