/**
 * Database Connection Factory
 *
 * Provides utilities for creating request-scoped database connections.
 *
 * @module
 */
import { Effect } from "effect";
import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import type { PgRemoteDatabase } from "drizzle-orm/pg-proxy";
/**
 * Type alias for the Drizzle database instance.
 */
export type DrizzleInstance = PgRemoteDatabase<Record<string, never>>;
/**
 * Default database URL for local development.
 */
export declare const LOCAL_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/effect_worker";
/**
 * Create a scoped database connection.
 *
 * Used by middleware to provide request-scoped database access.
 * The connection is automatically closed when the scope ends.
 *
 * @param connectionString - PostgreSQL connection URL
 *
 * @example
 * ```typescript
 * const { db } = yield* makeDatabaseConnection(connectionString)
 * const users = yield* db.select().from(usersTable)
 * ```
 */
export declare const makeDatabaseConnection: (connectionString: string) => Effect.Effect<{
    db: import("drizzle-orm/pg-proxy/driver", { with: { "resolution-mode": "require" } }).PgRemoteDatabase<Record<string, never>>;
}, import("@effect/sql/SqlError").SqlError, import("effect/Scope").Scope>;
export { PgDrizzle };
//# sourceMappingURL=Database.d.ts.map