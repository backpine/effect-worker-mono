# Pure Effect Database Pattern Migration

## Problem Statement

Current pattern in `effect-worker-mono`:

```typescript
const { db } = yield* DatabaseService
const drizzle = db as DrizzleInstance
```

This is verbose and requires manual casting because `DatabaseService` is defined with `unknown` type:

```typescript
export class DatabaseService extends Context.Tag(
  "@backpine/cloudflare/DatabaseService"
)<DatabaseService, { readonly db: unknown }>() {}
```

Desired pattern (from `effect-api-example`):

```typescript
const drizzle = yield* PgDrizzle
```

## Root Cause Analysis

The current pattern exists because:

1. **Generic Service Design**: `DatabaseService` in `@backpine/cloudflare` was designed to be app-agnostic (using `unknown`)
2. **Middleware Architecture**: The database connection is created per-request via middleware
3. **Missing Layer Integration**: `PgDrizzle` layer isn't being provided directly; instead, a custom service wraps it

## Solution: Use @effect/sql-drizzle's PgDrizzle Directly

The `@effect/sql-drizzle` package already exports `PgDrizzle` as a properly typed `Context.Tag`. We should provide it as a layer instead of wrapping it in a custom service.

---

## Migration Plan

### Step 1: Update Database.ts to Return Effect That Provides PgDrizzle

**File:** `packages/cloudflare/src/Database.ts`

```typescript
import { PgClient, PgDrizzle } from "@effect/sql-drizzle/Pg"
import { Reactivity } from "@effect/sql/Reactivity"
import { SqlClient } from "@effect/sql"
import { Context, Effect, Layer, Redacted } from "effect"

/**
 * Creates a scoped database layer for request-scoped usage.
 * Returns a Layer that provides PgDrizzle directly.
 */
export const makeDatabaseLayer = (connectionString: string) =>
  Layer.scoped(
    PgDrizzle.PgDrizzle,
    Effect.gen(function* () {
      const pgClient = yield* PgClient.make({
        url: Redacted.make(connectionString),
      })

      const drizzle = yield* PgDrizzle.make({
        casing: "snake_case",
      }).pipe(Effect.provideService(SqlClient.SqlClient, pgClient))

      return drizzle
    }).pipe(Effect.provide(Reactivity.layer))
  )

/**
 * Creates an Effect that provides PgDrizzle context.
 * Use with Effect.provide or in middleware.
 */
export const makeDatabaseContext = (connectionString: string) =>
  Effect.gen(function* () {
    const pgClient = yield* PgClient.make({
      url: Redacted.make(connectionString),
    })

    const drizzle = yield* PgDrizzle.make({
      casing: "snake_case",
    }).pipe(Effect.provideService(SqlClient.SqlClient, pgClient))

    return Context.make(PgDrizzle.PgDrizzle, drizzle)
  }).pipe(Effect.provide(Reactivity.layer))
```

### Step 2: Update Middleware to Provide PgDrizzle Context

**File:** `apps/effect-worker-api/src/services/middleware.ts`

```typescript
import { PgDrizzle } from "@effect/sql-drizzle/Pg"
import { makeDatabaseContext } from "@backpine/cloudflare"
import { Effect, FiberRef, Layer } from "effect"
import { currentEnv, LOCAL_DATABASE_URL } from "./cloudflare"
import { DatabaseMiddleware, DatabaseConnectionError } from "@backpine/api"

export const DatabaseMiddlewareLive = Layer.effect(
  DatabaseMiddleware,
  Effect.gen(function* () {
    // Return middleware effect that provides PgDrizzle context
    return Effect.gen(function* () {
      const env = yield* FiberRef.get(currentEnv)
      if (env === null) {
        return yield* Effect.fail(
          new DatabaseConnectionError({
            message: "Cloudflare environment not available",
          })
        )
      }

      const connectionString = env.DATABASE_URL ?? LOCAL_DATABASE_URL
      return yield* makeDatabaseContext(connectionString)
    })
  })
)
```

### Step 3: Update API Middleware Definition

**File:** `packages/api/src/middleware/DatabaseMiddleware.ts`

```typescript
import { PgDrizzle } from "@effect/sql-drizzle/Pg"
import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import { Context, Effect, Schema } from "effect"

export class DatabaseConnectionError extends Schema.TaggedError<DatabaseConnectionError>()(
  "DatabaseConnectionError",
  { message: Schema.String }
) {}

/**
 * Middleware that provides PgDrizzle to handlers.
 * The middleware implementation provides the actual database context.
 */
export class DatabaseMiddleware extends HttpApiMiddleware.Tag<DatabaseMiddleware>()(
  "@backpine/api/DatabaseMiddleware",
  {
    failure: DatabaseConnectionError,
    provides: PgDrizzle.PgDrizzle,  // <-- KEY: Middleware provides PgDrizzle
    security: {},
  }
) {}
```

### Step 4: Update Handler Usage

**File:** `apps/effect-worker-api/src/handlers/users.ts`

Before:
```typescript
import { DatabaseService } from "@backpine/cloudflare"
import type { DrizzleInstance } from "@backpine/cloudflare"

const { db } = yield* DatabaseService
const drizzle = db as DrizzleInstance
```

After:
```typescript
import { PgDrizzle } from "@effect/sql-drizzle/Pg"

const drizzle = yield* PgDrizzle
```

---

## Files to Modify

### Package: `@backpine/cloudflare`

| File | Change |
|------|--------|
| `src/Database.ts` | Replace `makeDatabaseConnection` with `makeDatabaseContext` |
| `src/Services.ts` | Remove `DatabaseService` tag (or deprecate) |
| `src/index.ts` | Update exports |

### Package: `@backpine/api`

| File | Change |
|------|--------|
| `src/middleware/DatabaseMiddleware.ts` | Update `provides` to use `PgDrizzle.PgDrizzle` |

### App: `effect-worker-api`

| File | Change |
|------|--------|
| `src/services/middleware.ts` | Use `makeDatabaseContext` |
| `src/handlers/users.ts` | `yield* PgDrizzle` instead of casting |
| Any other handlers using database | Same update |

---

## Benefits

1. **Type Safety**: No more `as DrizzleInstance` casting
2. **Cleaner Syntax**: `yield* PgDrizzle` is idiomatic Effect
3. **Better Integration**: Aligns with `@effect/sql-drizzle` patterns
4. **Reduced Boilerplate**: Remove custom `DatabaseService` tag
5. **Consistency**: Same pattern as `effect-api-example`

## Considerations

### Request Scoping Still Works

The middleware pattern still creates per-request connections. The difference is:
- Before: Middleware provides `DatabaseService` containing db
- After: Middleware provides `PgDrizzle` context directly

### SqlClient Access

If handlers need raw `SqlClient` access (for transactions, etc.), the middleware can provide both:

```typescript
return Context.make(PgDrizzle.PgDrizzle, drizzle)
  .pipe(Context.add(SqlClient.SqlClient, pgClient))
```

### Connection Pooling

Consider whether request-scoped connections are optimal. For high-throughput scenarios, a connection pool might be better. The `PgClient.make` function supports pool configuration:

```typescript
const pgClient = yield* PgClient.make({
  url: Redacted.make(connectionString),
  minConnections: 2,
  maxConnections: 10,
})
```

---

## Implementation Order

1. Update `@backpine/cloudflare/Database.ts` with new exports
2. Update `@backpine/api/middleware/DatabaseMiddleware.ts`
3. Update `effect-worker-api/services/middleware.ts`
4. Update all handlers to use `yield* PgDrizzle`
5. Remove deprecated `DatabaseService` exports
6. Run tests to verify
