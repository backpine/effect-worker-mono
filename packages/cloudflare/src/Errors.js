/**
 * Error Types
 *
 * Error classes for Cloudflare Worker services.
 * These are shared between HTTP and RPC middleware.
 *
 * @module
 */
import { HttpApiSchema } from "@effect/platform";
import { Schema as S } from "effect";
/**
 * Error when Cloudflare bindings are not available.
 *
 * HTTP Status: 500 Internal Server Error
 */
export class CloudflareBindingsError extends S.TaggedError()("CloudflareBindingsError", { message: S.String }, HttpApiSchema.annotations({ status: 500 })) {
}
/**
 * Error when database connection fails.
 *
 * HTTP Status: 503 Service Unavailable
 */
export class DatabaseConnectionError extends S.TaggedError()("DatabaseConnectionError", { message: S.String }, HttpApiSchema.annotations({ status: 503 })) {
}
//# sourceMappingURL=Errors.js.map