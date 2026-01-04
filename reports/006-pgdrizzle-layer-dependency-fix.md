# PgDrizzle Layer Dependency Issue

## The Error

```
Argument of type
Layer<HttpPlatform | Generator | FileSystem | Path | Api | Router | Middleware, never, PgDrizzle>
is not assignable to parameter of type
Layer<HttpPlatform | Generator | FileSystem | Path | Api | Router | Middleware, never, never>
. Type PgDrizzle is not assignable to type never. (ts 2345)
```

## Root Cause Analysis

The error occurs in `apps/effect-worker-api/src/runtime.ts` at:
```typescript
export const runtime = ManagedRuntime.make(ApiLayer)
```

`ManagedRuntime.make` requires a Layer with no unsatisfied dependencies (the `R` type parameter must be `never`). But `ApiLayer` has `PgDrizzle` as an unsatisfied dependency.

### The Dependency Mismatch

**What middleware provides:**
```typescript
// packages/api/src/middleware/database.ts
export class DatabaseMiddleware extends HttpApiMiddleware.Tag<DatabaseMiddleware>()(
  "@backpine/api/DatabaseMiddleware",
  {
    failure: DatabaseConnectionError,
    provides: DatabaseService  // ← Provides DatabaseService
  }
) {}
```

**What handlers consume:**
```typescript
// apps/effect-worker-api/src/handlers/users.ts
const drizzle = yield* PgDrizzle;  // ← Uses PgDrizzle directly
```

**The problem:** `DatabaseService` and `PgDrizzle` are completely different services!

- `DatabaseService` is a custom Context.Tag: `{ readonly db: unknown }`
- `PgDrizzle` is from `@effect/sql-drizzle/Pg` with full Drizzle typing

The middleware implementation creates a Drizzle instance and wraps it in `DatabaseService`, but handlers bypass this wrapper and directly request `PgDrizzle` - which is never provided.

### The Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT (BROKEN)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Middleware provides:     DatabaseService { db: drizzle }       │
│                                    │                            │
│                                    ▼                            │
│  Handlers expect:         PgDrizzle (never provided!)           │
│                                    │                            │
│                                    ▼                            │
│  Result:                  Layer<..., PgDrizzle> dependency      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Solution Options

### Option A: Change Handlers to Use DatabaseService (Quick Fix)

Modify handlers to use `DatabaseService` instead of `PgDrizzle`:

```typescript
// apps/effect-worker-api/src/handlers/users.ts
import { DatabaseService, type DrizzleInstance } from "@backpine/cloudflare"

// Instead of:
const drizzle = yield* PgDrizzle;

// Use:
const { db } = yield* DatabaseService;
const drizzle = db as DrizzleInstance;
```

**Pros:** Minimal changes
**Cons:** Requires type casting, loses type safety

### Option B: Change Middleware to Provide PgDrizzle Directly (Recommended)

This is the cleaner solution - make middleware provide what handlers actually need.

**Step 1: Update DatabaseMiddleware to provide PgDrizzle**

```typescript
// packages/api/src/middleware/database.ts
import { HttpApiMiddleware } from "@effect/platform"
import { PgDrizzle } from "@effect/sql-drizzle/Pg"
import { DatabaseConnectionError } from "@backpine/cloudflare"

export class DatabaseMiddleware extends HttpApiMiddleware.Tag<DatabaseMiddleware>()(
  "@backpine/api/DatabaseMiddleware",
  {
    failure: DatabaseConnectionError,
    provides: PgDrizzle  // ← Changed from DatabaseService
  }
) {}

export { DatabaseConnectionError }
```

**Step 2: Update makeDrizzle to return PgDrizzle context**

```typescript
// packages/cloudflare/src/database.ts
import { Effect, Layer, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import * as Reactivity from "@effect/experimental/Reactivity"
import * as SqlClient from "@effect/sql/SqlClient"

export const LOCAL_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/effect_worker"

/**
 * Creates a scoped Layer that provides PgDrizzle.
 */
export const makeDrizzleLayer = (connectionString: string) =>
  Layer.unwrapScoped(
    Effect.gen(function* () {
      const pgClient = yield* PgClient.make({
        url: Redacted.make(connectionString)
      }).pipe(Effect.provide(Reactivity.layer))

      return PgDrizzle.layer({ casing: "snake_case" }).pipe(
        Layer.provide(Layer.succeed(SqlClient.SqlClient, pgClient))
      )
    })
  )

/**
 * Creates a scoped PgDrizzle instance for middleware.
 * Returns the drizzle instance directly (not wrapped).
 */
export const makeDrizzle = (connectionString: string) =>
  Effect.gen(function* () {
    const pgClient = yield* PgClient.make({
      url: Redacted.make(connectionString)
    }).pipe(Effect.provide(Reactivity.layer))

    return yield* PgDrizzle.make({ casing: "snake_case" }).pipe(
      Effect.provideService(SqlClient.SqlClient, pgClient)
    )
  })

export { PgDrizzle }
```

**Step 3: Update middleware implementation**

```typescript
// apps/effect-worker-api/src/services/middleware.ts
export const DatabaseMiddlewareLive = Layer.effect(
  DatabaseMiddleware,
  Effect.gen(function* () {
    return Effect.gen(function* () {
      const env = yield* FiberRef.get(currentEnv);
      if (env === null) {
        return yield* Effect.fail(
          new DatabaseConnectionError({
            message: "Cloudflare env not available.",
          }),
        );
      }

      const connectionString = env.DATABASE_URL ?? LOCAL_DATABASE_URL;
      // Returns PgDrizzle instance directly
      return yield* makeDrizzle(connectionString);
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new DatabaseConnectionError({
            message: `Database connection failed: ${String(error)}`,
          }),
        ),
      ),
    );
  }),
);
```

**Step 4: Clean up cloudflare package exports**

```typescript
// packages/cloudflare/src/index.ts
export {
  makeDrizzle,
  makeDrizzleLayer,
  LOCAL_DATABASE_URL,
  PgDrizzle,
} from "./database"

// Remove DatabaseService export (no longer needed)
export { CloudflareBindings } from "./services"
export { CloudflareBindingsError, DatabaseConnectionError } from "./errors"
```

**Step 5: Handlers stay the same (already correct)**

```typescript
// apps/effect-worker-api/src/handlers/users.ts
const drizzle = yield* PgDrizzle;  // ✓ Works - PgDrizzle now provided
```

### The Fixed Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIXED (Option B)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Middleware provides:     PgDrizzle (drizzle instance)          │
│                                    │                            │
│                                    ▼                            │
│  Handlers expect:         PgDrizzle                             │
│                                    │                            │
│                                    ▼                            │
│  Result:                  Layer<..., never> ✓                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Pattern is Better

1. **Type Safety:** Handlers get full Drizzle typing without casting
2. **IDE Support:** Auto-completion for all Drizzle methods
3. **Effect Idiom:** Uses the native `@effect/sql-drizzle` service directly
4. **Simplicity:** No intermediate wrapper service

## Files to Modify

| File | Change |
|------|--------|
| `packages/api/src/middleware/database.ts` | `provides: PgDrizzle` |
| `packages/cloudflare/src/database.ts` | Return drizzle directly |
| `packages/cloudflare/src/index.ts` | Update exports |
| `packages/cloudflare/src/services.ts` | Remove DatabaseService |
| `apps/effect-worker-api/src/services/middleware.ts` | Use makeDrizzle |
| `apps/effect-worker-rpc/src/services/middleware.ts` | Use makeDrizzle |

## Summary

The error occurs because there's a service mismatch:
- Middleware provides `DatabaseService` (custom wrapper)
- Handlers use `PgDrizzle` (from @effect/sql-drizzle)

Fix by making middleware provide `PgDrizzle` directly, eliminating the unnecessary wrapper and giving handlers exactly what they need with full type safety.

## Implementation Note

When re-exporting `PgDrizzle` from `@effect/sql-drizzle/Pg`, use named import:

```typescript
// CORRECT - exports the class/tag
import { PgDrizzle, make as makePgDrizzle } from "@effect/sql-drizzle/Pg"
export { PgDrizzle }

// WRONG - exports the namespace
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
export { PgDrizzle }  // This exports typeof module, not the class!
```
