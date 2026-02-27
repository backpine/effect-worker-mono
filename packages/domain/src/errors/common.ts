/**
 * Common Errors
 *
 * Generic error types shared across the application.
 *
 * @module
 */
import { Schema as S } from "effect"

/**
 * Generic error returned when a resource or route is not found.
 *
 * HTTP Status: 404 Not Found
 */
export class NotFoundError extends S.TaggedErrorClass<NotFoundError>()(
  "NotFoundError",
  {
    path: S.String,
    message: S.String
  },
  { httpApiStatus: 404 }
) {}

/**
 * Error returned for invalid request data.
 *
 * HTTP Status: 400 Bad Request
 */
export class ValidationError extends S.TaggedErrorClass<ValidationError>()(
  "ValidationError",
  {
    message: S.String,
    errors: S.Array(S.String)
  },
  { httpApiStatus: 400 }
) {}

/**
 * Error when Cloudflare bindings are not available.
 *
 * HTTP Status: 500 Internal Server Error
 */
export class CloudflareBindingsError extends S.TaggedErrorClass<CloudflareBindingsError>()(
  "CloudflareBindingsError",
  { message: S.String },
  { httpApiStatus: 500 }
) {}

/**
 * Error when database connection fails.
 *
 * HTTP Status: 503 Service Unavailable
 */
export class DatabaseConnectionError extends S.TaggedErrorClass<DatabaseConnectionError>()(
  "DatabaseConnectionError",
  { message: S.String },
  { httpApiStatus: 503 }
) {}
