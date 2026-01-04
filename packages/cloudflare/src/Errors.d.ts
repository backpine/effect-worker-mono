import { Schema as S } from "effect";
declare const CloudflareBindingsError_base: S.TaggedErrorClass<CloudflareBindingsError, "CloudflareBindingsError", {
    readonly _tag: S.tag<"CloudflareBindingsError">;
} & {
    message: typeof S.String;
}>;
/**
 * Error when Cloudflare bindings are not available.
 *
 * HTTP Status: 500 Internal Server Error
 */
export declare class CloudflareBindingsError extends CloudflareBindingsError_base {
}
declare const DatabaseConnectionError_base: S.TaggedErrorClass<DatabaseConnectionError, "DatabaseConnectionError", {
    readonly _tag: S.tag<"DatabaseConnectionError">;
} & {
    message: typeof S.String;
}>;
/**
 * Error when database connection fails.
 *
 * HTTP Status: 503 Service Unavailable
 */
export declare class DatabaseConnectionError extends DatabaseConnectionError_base {
}
export {};
//# sourceMappingURL=Errors.d.ts.map