/**
 * @repo/db
 *
 * Database schema and queries for Effect Worker.
 *
 * This package contains Drizzle ORM schema definitions and
 * reusable Effect query programs shared across all apps.
 *
 * @module
 */

// Schema exports
export { users, type User as DbUser, type NewUser } from "./schema"

// Query exports
export * from "./queries"

// PgDrizzle service and layers
export {
  PgDrizzle,
  PgDrizzleLive,
  PgDrizzleLiveWithConfig,
  makePgDrizzleLayer,
  makeDrizzle,
  makeRemoteCallback
} from "./pg-drizzle/index.js"
