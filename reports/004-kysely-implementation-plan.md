# Kysely Migration Plan: Replace Drizzle with Kysely

## Overview

This report outlines a complete replacement of Drizzle ORM with Kysely in `effect-worker-mono`, including:
- Docker setup for local PostgreSQL
- Effect-native migrations using `@effect/sql` Migrator
- Kysely type definitions and query patterns

## 1. Understanding the Stack

### @effect/sql-kysely

Kysely integration with Effect works by:
1. **Patching Kysely builders** to be Effect-compatible (queries ARE Effects)
2. **Using a DummyDriver** - Kysely doesn't execute queries directly
3. **Routing through `@effect/sql` SqlClient** - shares connection pool

```typescript
// Kysely queries are Effects - just yield* them
const users = yield* db.selectFrom("users").selectAll()
```

### @effect/sql Migrator

Effect provides a database-agnostic migration system:
- Numeric prefixes: `0001_create_users.ts`, `0002_add_posts.ts`
- Each migration exports a default Effect
- Tracks migrations in `effect_sql_migrations` table
- Loaders: `fromGlob`, `fromBabelGlob`, `fromRecord`

## 2. Current vs Target Architecture

### Current (Drizzle)
```
packages/
├── db/                     # Drizzle schema (pgTable definitions)
├── cloudflare/
│   └── Database.ts         # PgDrizzle.make()
apps/
├── effect-worker-api/
│   └── drizzle.config.ts   # drizzle-kit for migrations
```

### Target (Kysely)
```
packages/
├── db/                     # Kysely types + Effect migrations
│   ├── src/
│   │   ├── schema.ts       # Kysely interface types
│   │   ├── migrations/     # Effect-based migrations
│   │   └── migrator.ts     # Migration runner
├── cloudflare/
│   └── Database.ts         # PgKysely.make()
apps/
├── effect-worker-api/
│   └── docker-compose.yml  # Local PostgreSQL
```

## 3. Implementation Steps

### Step 1: Add Docker Compose to Root

**docker-compose.yml** (at monorepo root):
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: effect-worker-postgres
    environment:
      POSTGRES_DB: effect_worker
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - effect_worker_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d effect_worker"]
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  effect_worker_data:
```

**Root package.json** - add scripts:
```json
{
  "scripts": {
    "db:start": "docker-compose up -d",
    "db:stop": "docker-compose down",
    "db:reset": "docker-compose down -v && docker-compose up -d",
    "db:logs": "docker-compose logs -f postgres"
  }
}
```

### Step 2: Update @backpine/db Package

Replace Drizzle schema with Kysely types and Effect migrations.

**packages/db/package.json:**
```json
{
  "name": "@backpine/db",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "description": "Database schema and migrations for Effect Worker",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts",
    "./migrations": "./src/migrations/index.ts",
    "./migrator": "./src/migrator.ts"
  },
  "dependencies": {
    "@effect/sql": "latest",
    "@effect/sql-pg": "latest",
    "effect": "latest",
    "kysely": "^0.27.0"
  }
}
```

**packages/db/src/schema.ts:**
```typescript
/**
 * Kysely Database Schema
 *
 * Type definitions for database tables.
 * These types are used by Kysely for type-safe queries.
 *
 * @module
 */
import type { Generated, Insertable, Selectable, Updateable } from "kysely"

// ============================================================================
// Users Table
// ============================================================================

export interface UsersTable {
  id: Generated<number>
  email: string
  name: string
  created_at: Generated<Date>
}

export type User = Selectable<UsersTable>
export type NewUser = Insertable<UsersTable>
export type UserUpdate = Updateable<UsersTable>

// ============================================================================
// Database Interface
// ============================================================================

/**
 * Complete database schema.
 * Add new tables here as the schema grows.
 */
export interface Database {
  users: UsersTable
}
```

**packages/db/src/migrations/0001_create_users.ts:**
```typescript
/**
 * Migration: Create users table
 */
import * as SqlClient from "@effect/sql/SqlClient"
import { Effect } from "effect"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
  `
})
```

**packages/db/src/migrations/index.ts:**
```typescript
/**
 * Migration loader using glob import
 *
 * @module
 */
import * as Migrator from "@effect/sql/Migrator"

// Vite/esbuild glob import pattern
const migrations = import.meta.glob("./*.ts", { eager: false })

export const loader = Migrator.fromGlob(
  migrations as Record<string, () => Promise<any>>
)
```

**packages/db/src/migrator.ts:**
```typescript
/**
 * Database Migrator
 *
 * Runs Effect-based migrations against the database.
 *
 * @module
 */
import * as Migrator from "@effect/sql/Migrator"
import * as SqlClient from "@effect/sql/SqlClient"
import { PgClient } from "@effect/sql-pg"
import { Effect, Redacted, Layer } from "effect"
import { loader } from "./migrations/index.js"

/**
 * Run all pending migrations
 */
export const runMigrations = Migrator.make({})({
  loader,
  table: "effect_sql_migrations"
})

/**
 * Create a migrator layer for a given database URL
 */
export const MigratorLive = (databaseUrl: string) =>
  Layer.effectDiscard(runMigrations).pipe(
    Layer.provide(
      PgClient.layer({
        url: Redacted.make(databaseUrl)
      })
    )
  )

/**
 * CLI entry point for running migrations
 *
 * Usage: npx tsx packages/db/src/migrator.ts
 */
const main = Effect.gen(function* () {
  const databaseUrl = process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/effect_worker"

  yield* Effect.logInfo("Running migrations...")

  const completed = yield* runMigrations.pipe(
    Effect.provide(
      PgClient.layer({
        url: Redacted.make(databaseUrl)
      })
    )
  )

  if (completed.length === 0) {
    yield* Effect.logInfo("No new migrations to run")
  } else {
    yield* Effect.logInfo(`Completed ${completed.length} migrations:`)
    for (const [id, name] of completed) {
      yield* Effect.logInfo(`  - ${id}_${name}`)
    }
  }
})

// Run if executed directly
main.pipe(Effect.runPromise).catch(console.error)

export { loader }
```

**packages/db/src/index.ts:**
```typescript
/**
 * @backpine/db
 *
 * Database schema and migrations.
 *
 * @module
 */
export * from "./schema.js"
export { runMigrations, MigratorLive, loader } from "./migrator.js"
```

### Step 3: Update @backpine/cloudflare

**packages/cloudflare/package.json:**
```json
{
  "name": "@backpine/cloudflare",
  "dependencies": {
    "@effect/experimental": "latest",
    "@effect/platform": "latest",
    "@effect/sql": "latest",
    "@effect/sql-kysely": "latest",
    "@effect/sql-pg": "latest",
    "effect": "latest",
    "kysely": "^0.27.0"
  }
}
```

**packages/cloudflare/src/Database.ts:**
```typescript
/**
 * Database Connection Factory
 *
 * Provides Kysely database connections for Effect Workers.
 *
 * @module
 */
import { Effect, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
import * as PgKysely from "@effect/sql-kysely/Pg"
import * as Reactivity from "@effect/experimental/Reactivity"
import * as SqlClient from "@effect/sql/SqlClient"
import type { EffectKysely } from "@effect/sql-kysely/Pg"

/**
 * Type alias for Kysely database instance.
 * The DB type parameter is the database schema interface.
 */
export type KyselyInstance<DB> = EffectKysely<DB>

/**
 * Default database URL for local development.
 */
export const LOCAL_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/effect_worker"

/**
 * Create a scoped Kysely database connection.
 *
 * Used by middleware to provide request-scoped database access.
 * The connection is automatically closed when the scope ends.
 *
 * @param connectionString - PostgreSQL connection URL
 *
 * @example
 * ```typescript
 * import type { Database } from "@backpine/db/schema"
 *
 * const { db } = yield* makeDatabaseConnection<Database>(connectionString)
 *
 * // Queries are Effects - just yield* them
 * const users = yield* db.selectFrom("users").selectAll()
 * ```
 */
export const makeDatabaseConnection = <DB>(connectionString: string) =>
  Effect.gen(function* () {
    const pgClient = yield* PgClient.make({
      url: Redacted.make(connectionString)
    }).pipe(Effect.provide(Reactivity.layer))

    const db = yield* PgKysely.make<DB>().pipe(
      Effect.provideService(SqlClient.SqlClient, pgClient)
    )

    return { db }
  })

/**
 * Create a raw SqlClient connection (for migrations, raw SQL).
 */
export const makeSqlConnection = (connectionString: string) =>
  Effect.gen(function* () {
    const pgClient = yield* PgClient.make({
      url: Redacted.make(connectionString)
    }).pipe(Effect.provide(Reactivity.layer))

    return { sql: pgClient }
  })

// Re-export for convenience
export { PgKysely }
```

**packages/cloudflare/src/Services.ts:**
```typescript
/**
 * Service Tags
 *
 * Context tags for Cloudflare Worker services.
 *
 * @module
 */
import { Context } from "effect"
import type { WorkerExecutionContext } from "./FiberRef.js"

/**
 * CloudflareBindings service provides access to Cloudflare's env and ctx.
 */
export class CloudflareBindings extends Context.Tag(
  "@backpine/cloudflare/CloudflareBindings"
)<
  CloudflareBindings,
  { readonly env: unknown; readonly ctx: WorkerExecutionContext }
>() {}

/**
 * DatabaseService provides access to a request-scoped Kysely instance.
 *
 * @example
 * ```typescript
 * import type { Database } from "@backpine/db/schema"
 * import type { KyselyInstance } from "@backpine/cloudflare"
 *
 * const { db } = yield* DatabaseService
 * const kysely = db as KyselyInstance<Database>
 *
 * const users = yield* kysely.selectFrom("users").selectAll()
 * ```
 */
export class DatabaseService extends Context.Tag(
  "@backpine/cloudflare/DatabaseService"
)<DatabaseService, { readonly db: unknown }>() {}
```

### Step 4: Update App Middleware

**apps/effect-worker-api/src/services/middleware.ts** (example):
```typescript
import { Effect, Layer } from "effect"
import {
  CloudflareBindings,
  DatabaseService,
  makeDatabaseConnection,
  LOCAL_DATABASE_URL
} from "@backpine/cloudflare"
import type { Database } from "@backpine/db/schema"

// ... existing CloudflareBindingsMiddleware ...

export const DatabaseMiddlewareLive = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    const { env } = yield* CloudflareBindings
    const typedEnv = env as { DATABASE_URL?: string }

    const connectionString = typedEnv.DATABASE_URL ?? LOCAL_DATABASE_URL

    const { db } = yield* makeDatabaseConnection<Database>(connectionString)

    return { db }
  })
)
```

### Step 5: Update Handlers to Use Kysely

**apps/effect-worker-api/src/handlers/users.ts:**
```typescript
import { Effect } from "effect"
import { DatabaseService, type KyselyInstance } from "@backpine/cloudflare"
import type { Database, User, NewUser } from "@backpine/db/schema"

/**
 * Get all users
 */
export const getUsers = Effect.gen(function* () {
  const { db } = yield* DatabaseService
  const kysely = db as KyselyInstance<Database>

  // Kysely queries ARE Effects - no Effect.tryPromise needed!
  const users = yield* kysely
    .selectFrom("users")
    .selectAll()
    .orderBy("created_at", "desc")

  return users
})

/**
 * Get user by ID
 */
export const getUserById = (id: number) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService
    const kysely = db as KyselyInstance<Database>

    const user = yield* kysely
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()

    if (!user) {
      return yield* Effect.fail(new UserNotFoundError({ id }))
    }

    return user
  })

/**
 * Create a new user
 */
export const createUser = (data: NewUser) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService
    const kysely = db as KyselyInstance<Database>

    const [user] = yield* kysely
      .insertInto("users")
      .values(data)
      .returningAll()

    return user
  })

/**
 * Update a user
 */
export const updateUser = (id: number, data: Partial<NewUser>) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService
    const kysely = db as KyselyInstance<Database>

    const [user] = yield* kysely
      .updateTable("users")
      .set(data)
      .where("id", "=", id)
      .returningAll()

    if (!user) {
      return yield* Effect.fail(new UserNotFoundError({ id }))
    }

    return user
  })

/**
 * Delete a user
 */
export const deleteUser = (id: number) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService
    const kysely = db as KyselyInstance<Database>

    const [user] = yield* kysely
      .deleteFrom("users")
      .where("id", "=", id)
      .returningAll()

    if (!user) {
      return yield* Effect.fail(new UserNotFoundError({ id }))
    }

    return user
  })

// Error types
import { Data } from "effect"

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly id: number
}> {}
```

### Step 6: Package Scripts

**packages/db/package.json** - add scripts:
```json
{
  "scripts": {
    "migrate": "tsx src/migrator.ts",
    "migrate:create": "echo 'Create new migration file in src/migrations/'"
  }
}
```

**apps/effect-worker-api/package.json** - update scripts:
```json
{
  "scripts": {
    "dev": "wrangler dev",
    "db:migrate": "pnpm --filter @backpine/db migrate",
    "db:start": "docker-compose -f ../../docker-compose.yml up -d",
    "db:stop": "docker-compose -f ../../docker-compose.yml down"
  }
}
```

## 4. Migration Workflow

### Creating New Migrations

1. Create a new file in `packages/db/src/migrations/`:
   ```
   0002_add_posts.ts
   ```

2. Export a default Effect:
   ```typescript
   import * as SqlClient from "@effect/sql/SqlClient"
   import { Effect } from "effect"

   export default Effect.gen(function* () {
     const sql = yield* SqlClient.SqlClient

     yield* sql`
       CREATE TABLE posts (
         id SERIAL PRIMARY KEY,
         user_id INTEGER NOT NULL REFERENCES users(id),
         title VARCHAR(255) NOT NULL,
         content TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       )
     `
   })
   ```

3. Update `packages/db/src/schema.ts`:
   ```typescript
   export interface PostsTable {
     id: Generated<number>
     user_id: number
     title: string
     content: string | null
     created_at: Generated<Date>
   }

   export interface Database {
     users: UsersTable
     posts: PostsTable  // Add new table
   }
   ```

4. Run migrations:
   ```bash
   pnpm db:start
   pnpm --filter @backpine/db migrate
   ```

### Migration with Kysely Schema API

You can also use Kysely's schema builder in migrations:

```typescript
import * as SqlClient from "@effect/sql/SqlClient"
import * as PgKysely from "@effect/sql-kysely/Pg"
import { Effect } from "effect"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const db = yield* PgKysely.make()

  // Use Kysely's schema API
  yield* db.schema
    .createTable("posts")
    .addColumn("id", "serial", (c) => c.primaryKey())
    .addColumn("user_id", "integer", (c) => c.notNull().references("users.id"))
    .addColumn("title", "varchar(255)", (c) => c.notNull())
    .addColumn("content", "text")
    .addColumn("created_at", "timestamptz", (c) => c.defaultTo(sql.raw("NOW()")))

  yield* db.schema
    .createIndex("idx_posts_user_id")
    .on("posts")
    .column("user_id")
})
```

## 5. Final File Structure

```
effect-worker-mono/
├── docker-compose.yml              # NEW: PostgreSQL container
├── package.json                    # Updated: db scripts
├── packages/
│   ├── db/
│   │   ├── package.json            # Updated: kysely deps
│   │   └── src/
│   │       ├── index.ts            # Exports
│   │       ├── schema.ts           # Kysely types (replaces Drizzle)
│   │       ├── migrator.ts         # Effect Migrator runner
│   │       └── migrations/
│   │           ├── index.ts        # Glob loader
│   │           └── 0001_create_users.ts
│   ├── cloudflare/
│   │   ├── package.json            # Updated: kysely deps, remove drizzle
│   │   └── src/
│   │       ├── Database.ts         # Updated: PgKysely
│   │       └── Services.ts         # Simplified
│   └── api/                        # Unchanged
│   └── rpc/                        # Unchanged
└── apps/
    ├── effect-worker-api/
    │   ├── package.json            # Remove drizzle deps
    │   └── src/handlers/users.ts   # Updated: Kysely queries
    └── effect-worker-rpc/
        └── ...
```

## 6. Packages to Remove

Remove from all package.json files:
- `drizzle-orm`
- `drizzle-kit`
- `@effect/sql-drizzle`

Delete files:
- `apps/effect-worker-api/drizzle.config.ts`
- `apps/effect-worker-rpc/drizzle.config.ts`

## 7. Key Differences: Drizzle vs Kysely

| Aspect | Drizzle | Kysely |
|--------|---------|--------|
| **Query syntax** | `drizzle.select().from(users)` | `db.selectFrom("users").selectAll()` |
| **Effect integration** | `Effect.tryPromise(() => ...)` | Direct: `yield* db.select...` |
| **Schema definition** | `pgTable()` functions | TypeScript interfaces |
| **Migrations** | `drizzle-kit` CLI | Effect Migrator + manual files |
| **Type inference** | From schema definition | From interface definition |

## 8. Development Workflow

```bash
# Start local database
pnpm db:start

# Run migrations
pnpm --filter @backpine/db migrate

# Start dev server
pnpm --filter @backpine/effect-worker-api dev

# Stop database
pnpm db:stop

# Reset database (destructive)
pnpm db:reset
```

## 9. Summary

This migration:
1. **Removes Drizzle** entirely from the codebase
2. **Adds Kysely** with Effect-native integration
3. **Uses Effect Migrator** for database migrations
4. **Adds Docker** for local PostgreSQL development
5. **Simplifies queries** - Kysely queries ARE Effects, no wrapping needed

The main benefits:
- Cleaner query syntax with direct Effect integration
- Type-safe queries without code generation
- Migrations are just Effect programs
- Shared PostgreSQL connection through `@effect/sql`
