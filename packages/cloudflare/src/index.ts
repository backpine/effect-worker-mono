/**
 * @backpine/cloudflare
 *
 * Cloudflare Worker infrastructure for Effect.
 *
 * This package provides shared infrastructure for building Cloudflare Workers
 * with Effect, including:
 *
 * - FiberRef bridge for request-scoped bindings
 * - Service tags for CloudflareBindings and DatabaseService
 * - Error types for middleware
 * - Database connection factory
 *
 * @module
 */

// FiberRef bridge
export {
  currentEnv,
  currentCtx,
  withCloudflareBindings,
  waitUntil,
  type WorkerExecutionContext
} from "./FiberRef.js"

// Service tags
export { CloudflareBindings, DatabaseService } from "./Services.js"

// Error types
export { CloudflareBindingsError, DatabaseConnectionError } from "./Errors.js"

// Database utilities
export {
  makeDatabaseConnection,
  LOCAL_DATABASE_URL,
  PgDrizzle,
  type DrizzleInstance
} from "./Database.js"
