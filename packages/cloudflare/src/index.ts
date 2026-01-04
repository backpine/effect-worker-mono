/**
 * @backpine/cloudflare
 *
 * Cloudflare Worker infrastructure for Effect.
 *
 * This package provides shared infrastructure for building Cloudflare Workers
 * with Effect, including:
 *
 * - FiberRef bridge for request-scoped bindings
 * - Service tag for CloudflareBindings
 * - Error types for middleware
 * - PgDrizzle connection factory
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
} from "./fiber-ref"

// Service tags
export { CloudflareBindings } from "./services"

// Error types
export { CloudflareBindingsError, DatabaseConnectionError } from "./errors"

// Database utilities
export {
  makeDrizzle,
  PgDrizzle
} from "./database"
