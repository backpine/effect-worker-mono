# 009: Shared Query Layer in @backpine/db

## Problem

Database queries are duplicated across apps. Both `effect-worker-api` and `effect-worker-rpc` contain identical:

- ID conversion helpers (`toUserId`, `parseUserId`)
- Query logic (select, insert with Drizzle)
- DB-to-domain type mapping
- Error handling patterns

**HTTP API** (`apps/effect-worker-api/src/handlers/users.ts`):
```typescript
const drizzle = yield* PgDrizzle
const result = yield* drizzle.select().from(users).where(eq(users.id, dbId))
const user = { id: toUserId(dbUser.id), email: dbUser.email as Email, ... }
```

**RPC** (`apps/effect-worker-rpc/src/handlers/users.ts`):
```typescript
const drizzle = yield* PgDrizzle
const result = yield* drizzle.select().from(users).where(eq(users.id, dbId))
const user = { id: toUserId(dbUser.id), email: dbUser.email, ... }
```

## Solution

Add a query layer to `@backpine/db` that exports Effect programs. These programs:

1. Require `PgDrizzle` as a dependency
2. Accept/return domain types (not DB types)
3. Handle ID conversions internally
4. Return typed domain errors

## Package Dependency Flow

```
┌─────────────────┐
│  @backpine/db   │  ← Queries + Schema
│  (queries.ts)   │
└────────┬────────┘
         │ depends on
         ▼
┌─────────────────┐     ┌──────────────────┐
│@backpine/domain │     │ @effect/sql-drizzle │
│ (types/errors)  │     │    (PgDrizzle)      │
└─────────────────┘     └──────────────────────┘
```

**Key insight**: `@backpine/db` will depend on `@backpine/domain` for types and errors. This is correct because queries need to return domain types.

## Implementation

### 1. Update `@backpine/db/package.json`

```json
{
  "name": "@backpine/db",
  "dependencies": {
    "drizzle-orm": "^0.45.0",
    "effect": "latest",
    "@effect/sql-drizzle": "latest",
    "@backpine/domain": "workspace:*"
  }
}
```

### 2. Create Query Module

**`packages/db/src/queries/users.ts`**:

```typescript
/**
 * User Queries
 *
 * Reusable Effect programs for user database operations.
 *
 * @module
 */
import { DateTime, Effect } from "effect"
import { PgDrizzle } from "@effect/sql-drizzle/Pg"
import { eq } from "drizzle-orm"

import { users } from "../schema"
import type { UserId, Email, User, CreateUser } from "@backpine/domain"
import { UserNotFoundError, UserCreationError } from "@backpine/domain"

// ============================================================================
// Internal Helpers
// ============================================================================

/** Convert database ID to branded UserId */
const toUserId = (id: number): UserId => `usr_${id}` as UserId

/** Parse UserId to database ID, returns null if invalid format */
const parseUserId = (id: UserId): number | null => {
  const match = id.match(/^usr_(\d+)$/)
  return match ? parseInt(match[1]!, 10) : null
}

/** Map database row to domain User */
const toDomainUser = (row: typeof users.$inferSelect): User => ({
  id: toUserId(row.id),
  email: row.email as Email,
  name: row.name,
  createdAt: DateTime.unsafeFromDate(row.createdAt)
})

// ============================================================================
// Query Programs
// ============================================================================

/**
 * Find all users.
 *
 * @returns Effect that yields array of domain Users
 */
export const findAllUsers: Effect.Effect<
  User[],
  never,
  PgDrizzle
> = Effect.gen(function* () {
  const drizzle = yield* PgDrizzle
  const rows = yield* drizzle
    .select()
    .from(users)
    .pipe(Effect.orElseSucceed(() => []))

  return rows.map(toDomainUser)
})

/**
 * Find user by ID.
 *
 * @param id - Branded UserId
 * @returns Effect that yields User or fails with UserNotFoundError
 */
export const findUserById = (
  id: UserId
): Effect.Effect<User, UserNotFoundError, PgDrizzle> =>
  Effect.gen(function* () {
    const dbId = parseUserId(id)

    if (dbId === null) {
      return yield* Effect.fail(
        new UserNotFoundError({ id, message: `Invalid user ID format: ${id}` })
      )
    }

    const drizzle = yield* PgDrizzle
    const rows = yield* drizzle
      .select()
      .from(users)
      .where(eq(users.id, dbId))
      .pipe(Effect.orElseSucceed(() => []))

    const row = rows[0]

    if (!row) {
      return yield* Effect.fail(
        new UserNotFoundError({ id, message: `User not found: ${id}` })
      )
    }

    return toDomainUser(row)
  })

/**
 * Create a new user.
 *
 * @param data - CreateUser payload (email, name)
 * @returns Effect that yields created User or fails with UserCreationError
 */
export const createUser = (
  data: CreateUser
): Effect.Effect<User, UserCreationError, PgDrizzle> =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle
    const rows = yield* drizzle
      .insert(users)
      .values({ email: data.email, name: data.name })
      .returning()
      .pipe(
        Effect.mapError(() => new UserCreationError(data))
      )

    const row = rows[0]

    if (!row) {
      return yield* Effect.fail(new UserCreationError(data))
    }

    return toDomainUser(row)
  })
```

### 3. Create Barrel Export

**`packages/db/src/queries/index.ts`**:

```typescript
export * as UserQueries from "./users"
```

### 4. Update Main Export

**`packages/db/src/index.ts`**:

```typescript
// Schema exports
export { users, type User as DbUser, type NewUser } from "./schema"

// Query exports
export * from "./queries"
```

### 5. Update `tsconfig.base.json` (if needed)

Ensure path alias is correct:
```json
{
  "paths": {
    "@backpine/db": ["./packages/db/src"],
    "@backpine/db/*": ["./packages/db/src/*"]
  }
}
```

## Usage in Apps

### HTTP API Handler (Simplified)

**`apps/effect-worker-api/src/handlers/users.ts`**:

```typescript
import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { WorkerApi } from "@backpine/contracts"
import { UserQueries } from "@backpine/db"

export const UsersGroupLive = HttpApiBuilder.group(
  WorkerApi,
  "users",
  (handlers) =>
    Effect.gen(function* () {
      return handlers
        .handle("list", () =>
          Effect.gen(function* () {
            const users = yield* UserQueries.findAllUsers
            return { users, total: users.length }
          })
        )
        .handle("get", ({ path: { id } }) => UserQueries.findUserById(id))
        .handle("create", ({ payload }) => UserQueries.createUser(payload))
    })
)
```

### RPC Handler (Simplified)

**`apps/effect-worker-rpc/src/handlers/users.ts`**:

```typescript
import { Effect } from "effect"
import { UsersRpc } from "@backpine/contracts"
import { UserQueries } from "@backpine/db"

export const UsersRpcHandlersLive = UsersRpc.toLayer({
  getUser: ({ id }) =>
    UserQueries.findUserById(id as UserId).pipe(
      Effect.mapError((e) => ({ _tag: "UserNotFound" as const, ...e }))
    ),

  listUsers: () =>
    Effect.gen(function* () {
      const users = yield* UserQueries.findAllUsers
      return { users, total: users.length }
    }),

  createUser: (data) =>
    UserQueries.createUser(data).pipe(
      Effect.mapError((e) => ({ _tag: "DuplicateEmail" as const, email: e.email }))
    )
})
```

## Alternative: Service Pattern

For more complex scenarios, wrap queries in a service:

**`packages/db/src/services/user-repository.ts`**:

```typescript
import { Context, Effect, Layer } from "effect"
import { PgDrizzle } from "@effect/sql-drizzle/Pg"
import type { UserId, User, CreateUser } from "@backpine/domain"
import { UserNotFoundError, UserCreationError } from "@backpine/domain"
import * as UserQueries from "../queries/users"

export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  {
    readonly findAll: Effect.Effect<User[]>
    readonly findById: (id: UserId) => Effect.Effect<User, UserNotFoundError>
    readonly create: (data: CreateUser) => Effect.Effect<User, UserCreationError>
  }
>() {}

export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle

    return {
      findAll: UserQueries.findAllUsers.pipe(Effect.provideService(PgDrizzle, drizzle)),
      findById: (id) => UserQueries.findUserById(id).pipe(Effect.provideService(PgDrizzle, drizzle)),
      create: (data) => UserQueries.createUser(data).pipe(Effect.provideService(PgDrizzle, drizzle))
    }
  })
)
```

**Usage**:
```typescript
const users = yield* UserRepository
const allUsers = yield* users.findAll
```

## Recommended Approach

**Use direct query programs** (not the service pattern) because:

1. Simpler - no extra abstraction layer
2. Effect's dependency system already handles `PgDrizzle`
3. Queries compose naturally with `Effect.gen`
4. Service pattern adds boilerplate without benefit here

## File Structure After Implementation

```
packages/db/
├── src/
│   ├── index.ts              # Barrel exports
│   ├── schema.ts             # Drizzle table definitions (unchanged)
│   └── queries/
│       ├── index.ts          # Query barrel exports
│       └── users.ts          # User query programs
├── package.json              # + effect, @effect/sql-drizzle, @backpine/domain
└── tsconfig.json
```

## Build Order

With the new dependency (`@backpine/db` → `@backpine/domain`), update root `package.json`:

```json
{
  "scripts": {
    "build": "pnpm --filter '@backpine/domain' run build && pnpm --filter '@backpine/db' run build && pnpm --filter '@backpine/cloudflare' run build && pnpm --filter '@backpine/contracts' run build"
  }
}
```

## Summary

| Before | After |
|--------|-------|
| Queries in handlers | Queries in `@backpine/db` |
| Duplicated ID helpers | Single source in queries |
| DB types in handlers | Domain types throughout |
| 50+ lines per handler | ~5 lines per handler |

This approach keeps the Effect patterns intact while eliminating duplication and providing a clean separation between database operations and HTTP/RPC concerns.
