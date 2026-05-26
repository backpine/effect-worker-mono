/**
 * Common Errors
 *
 * Generic error types shared across the application.
 *
 * @module
 */
import { Schema as S } from "effect"

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
