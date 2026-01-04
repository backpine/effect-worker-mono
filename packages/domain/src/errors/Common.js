/**
 * Common Errors
 *
 * Generic error types shared across the application.
 *
 * @module
 */
import { HttpApiSchema } from "@effect/platform";
import { Schema as S } from "effect";
/**
 * Generic error returned when a resource or route is not found.
 *
 * HTTP Status: 404 Not Found
 */
export class NotFoundError extends S.TaggedError()("NotFoundError", {
    path: S.String,
    message: S.String
}, HttpApiSchema.annotations({ status: 404 })) {
}
/**
 * Error returned for invalid request data.
 *
 * HTTP Status: 400 Bad Request
 */
export class ValidationError extends S.TaggedError()("ValidationError", {
    message: S.String,
    errors: S.Array(S.String)
}, HttpApiSchema.annotations({ status: 400 })) {
}
//# sourceMappingURL=Common.js.map