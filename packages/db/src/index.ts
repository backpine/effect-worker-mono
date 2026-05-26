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

// Database service tag + request-scoped connection factory
// (first-class drizzle-orm/effect-postgres client)
export { Database } from "./database.js"
export { connect } from "./connect.js"
