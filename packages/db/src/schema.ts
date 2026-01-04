/**
 * Database Schema
 *
 * Drizzle ORM schema definitions shared across all apps.
 *
 * @module
 */
import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core"

/**
 * Users table schema.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

/**
 * Type for selecting a user from the database.
 */
export type User = typeof users.$inferSelect

/**
 * Type for inserting a user into the database.
 */
export type NewUser = typeof users.$inferInsert
