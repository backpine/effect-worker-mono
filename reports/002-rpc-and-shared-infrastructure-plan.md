# RPC App & Shared Infrastructure - Implementation Plan

## Overview

This document outlines the plan to:
1. Extract shared Cloudflare infrastructure into `@backpine/cloudflare`
2. Create `@backpine/rpc` package for RPC definitions and middleware
3. Create `effect-worker-rpc` app in the monorepo

---

## Analysis: Current State

### What exists in `effect-worker-api`:

```
apps/effect-worker-api/src/services/
├── cloudflare.ts       # FiberRef bridge (currentEnv, currentCtx, withCloudflareBindings)
├── database.ts         # makeDatabaseConnection, DrizzleInstance type
└── middleware.ts       # HTTP middleware implementations
```

### What exists in `@effect-worker/` RPC:

```
src/rpc/
├── middleware/
│   ├── cloudflare.ts   # RpcCloudflareMiddleware (uses shared FiberRefs)
│   └── database.ts     # RpcDatabaseMiddleware (uses shared makeDatabaseConnection)
├── procedures/
│   └── users.ts        # RpcGroup definitions (Rpc.make + schemas)
├── handlers/
│   └── users.ts        # UsersRpc.toLayer handlers
└── runtime.ts          # RpcServer setup + handleRpcRequest
```

---

## Key Insight: HTTP vs RPC Middleware Difference

### HTTP Middleware Pattern
```typescript
// Definition (HttpApiMiddleware.Tag)
export class CloudflareBindingsMiddleware extends HttpApiMiddleware.Tag<...>()

// Implementation (Layer.effect returning an Effect)
export const CloudflareBindingsMiddlewareLive = Layer.effect(
  CloudflareBindingsMiddleware,
  Effect.gen(function* () {
    return Effect.gen(function* () {  // Returns Effect
      const env = yield* FiberRef.get(currentEnv)
      return { env, ctx }
    })
  })
)
```

### RPC Middleware Pattern
```typescript
// Definition (RpcMiddleware.Tag)
export class RpcCloudflareMiddleware extends RpcMiddleware.Tag<...>()

// Implementation (Layer.succeed with a function)
export const RpcCloudflareMiddlewareLive = Layer.succeed(
  RpcCloudflareMiddleware,
  () =>  // Returns a function that returns Effect
    Effect.gen(function* () {
      const env = yield* FiberRef.get(currentEnv)
      return { env, ctx }
    })
)
```

**Key difference**: HTTP middleware returns an Effect, RPC middleware returns a function that returns an Effect.

---

## Shared Infrastructure Analysis

### What MUST be shared (identical between HTTP and RPC):

| Component | Location Now | Used By |
|-----------|--------------|---------|
| `currentEnv` FiberRef | app/services/cloudflare.ts | Both middleware types |
| `currentCtx` FiberRef | app/services/cloudflare.ts | Both middleware types |
| `withCloudflareBindings()` | app/services/cloudflare.ts | Both app entry points |
| `waitUntil()` | app/services/cloudflare.ts | Background tasks |
| `makeDatabaseConnection()` | app/services/database.ts | Both middleware types |
| `LOCAL_DATABASE_URL` | app/services/database.ts | Both middleware types |
| `DrizzleInstance` type | app/services/database.ts | Both apps |

### What SHOULD be shared (service definitions):

| Component | Location Now | Notes |
|-----------|--------------|-------|
| `CloudflareBindings` tag | @backpine/api/middleware | Both HTTP and RPC provide this |
| `CloudflareBindingsError` | @backpine/api/middleware | Shared error type |
| `DatabaseService` tag | @backpine/api/middleware | Both HTTP and RPC provide this |
| `DatabaseConnectionError` | @backpine/api/middleware | Shared error type |

### What is transport-specific:

| Component | HTTP | RPC |
|-----------|------|-----|
| Middleware tag base | `HttpApiMiddleware.Tag` | `RpcMiddleware.Tag` |
| Implementation pattern | `Layer.effect` | `Layer.succeed` with fn |
| Request handler | `HttpApiBuilder.httpApp` | `RpcServer.toHttpApp` |
| Group builder | `HttpApiBuilder.group` | `RpcGroup.make` + `.toLayer` |

---

## Proposed Package Structure

```
effect-worker-mono/
├── packages/
│   ├── domain/                     # @backpine/domain (existing)
│   │   └── src/
│   │       ├── schemas/            # UserId, Email, UserSchema
│   │       └── errors/             # UserCreationError, UserNotFoundError
│   │
│   ├── cloudflare/                 # @backpine/cloudflare (NEW)
│   │   └── src/
│   │       ├── FiberRef.ts         # currentEnv, currentCtx, withCloudflareBindings
│   │       ├── Database.ts         # makeDatabaseConnection, DrizzleInstance
│   │       ├── Services.ts         # CloudflareBindings, DatabaseService tags
│   │       ├── Errors.ts           # CloudflareBindingsError, DatabaseConnectionError
│   │       └── index.ts
│   │
│   ├── api/                        # @backpine/api (update to use cloudflare)
│   │   └── src/
│   │       ├── middleware/         # HTTP middleware TAGS only
│   │       │   ├── CloudflareBindings.ts  # re-exports from cloudflare
│   │       │   └── Database.ts            # re-exports from cloudflare
│   │       ├── groups/
│   │       └── WorkerApi.ts
│   │
│   └── rpc/                        # @backpine/rpc (NEW)
│       └── src/
│           ├── middleware/         # RPC middleware TAGS
│           │   ├── CloudflareBindings.ts
│           │   └── Database.ts
│           ├── procedures/         # RPC procedure definitions
│           │   ├── users.ts
│           │   └── index.ts
│           └── index.ts
│
└── apps/
    ├── effect-worker-api/          # HTTP app (update to use cloudflare)
    │   └── src/
    │       ├── services/
    │       │   └── middleware.ts   # HTTP middleware IMPLEMENTATIONS
    │       └── ...
    │
    └── effect-worker-rpc/          # RPC app (NEW)
        └── src/
            ├── index.ts            # Worker entry point
            ├── runtime.ts          # RPC runtime + handleRpcRequest
            ├── handlers/           # RPC handler implementations
            │   └── users.ts
            ├── services/
            │   └── middleware.ts   # RPC middleware IMPLEMENTATIONS
            └── db/
                └── schema.ts       # Shared with HTTP? Or link?
```

---

## Package Responsibilities

### `@backpine/cloudflare` (NEW)

**Purpose**: Cloudflare Worker infrastructure shared by all apps

```typescript
// FiberRef.ts - Request-scoped binding bridge
export const currentEnv = FiberRef.unsafeMake<unknown>(null)
export const currentCtx = FiberRef.unsafeMake<WorkerExecutionContext | null>(null)
export const withCloudflareBindings = <Env>(env: Env, ctx: WorkerExecutionContext) => ...
export const waitUntil = <A, E>(effect: Effect<A, E>) => ...

// Services.ts - Context tags (shared by HTTP and RPC)
export class CloudflareBindings extends Context.Tag("@backpine/cloudflare/CloudflareBindings")
export class DatabaseService extends Context.Tag("@backpine/cloudflare/DatabaseService")

// Errors.ts - Error types
export class CloudflareBindingsError extends S.TaggedError<...>()
export class DatabaseConnectionError extends S.TaggedError<...>()

// Database.ts - Connection factory
export type DrizzleInstance = PgRemoteDatabase<Record<string, never>>
export const LOCAL_DATABASE_URL = "postgres://..."
export const makeDatabaseConnection = (connectionString: string) => ...
```

### `@backpine/api` (UPDATE)

**Change**: Import service tags from `@backpine/cloudflare`, only define HTTP middleware tags

```typescript
// middleware/CloudflareBindings.ts
import { CloudflareBindings, CloudflareBindingsError } from "@backpine/cloudflare"

// HttpApiMiddleware tag that provides the shared CloudflareBindings service
export class CloudflareBindingsMiddleware extends HttpApiMiddleware.Tag<...>()(..., {
  provides: CloudflareBindings  // From @backpine/cloudflare
})
```

### `@backpine/rpc` (NEW)

**Purpose**: RPC procedure definitions and middleware tags

```typescript
// middleware/CloudflareBindings.ts
import { CloudflareBindings, CloudflareBindingsError } from "@backpine/cloudflare"

export class RpcCloudflareMiddleware extends RpcMiddleware.Tag<...>()(..., {
  provides: CloudflareBindings  // Same service tag as HTTP
})

// procedures/users.ts
export const getUser = Rpc.make("getUser", { ... }).middleware(RpcDatabaseMiddleware)
export const UsersRpc = RpcGroup.make(getUser, listUsers, createUser)
```

### `effect-worker-rpc` (NEW APP)

**Purpose**: Cloudflare Worker running RPC server

```typescript
// services/middleware.ts - RPC middleware IMPLEMENTATIONS
import { RpcCloudflareMiddleware, RpcDatabaseMiddleware } from "@backpine/rpc"
import { currentEnv, currentCtx, makeDatabaseConnection } from "@backpine/cloudflare"

export const RpcCloudflareMiddlewareLive = Layer.succeed(
  RpcCloudflareMiddleware,
  () => Effect.gen(function* () {
    const env = yield* FiberRef.get(currentEnv)
    const ctx = yield* FiberRef.get(currentCtx)
    return { env, ctx }
  })
)
```

---

## Database Schema: Shared or Separate?

### Option A: Duplicate in each app
```
apps/effect-worker-api/src/db/schema.ts   # Copy
apps/effect-worker-rpc/src/db/schema.ts   # Copy
```
- Pros: Apps are fully independent
- Cons: Schema drift risk

### Option B: Shared in `@backpine/domain`
```
packages/domain/src/db/
├── schema.ts          # Drizzle schema
└── index.ts
```
- Pros: Single source of truth
- Cons: Domain package gets database dependency

### Option C: New `@backpine/db` package
```
packages/db/src/
├── schema.ts          # Drizzle schema
└── index.ts
```
- Pros: Clean separation, single source of truth
- Cons: Another package to maintain

### Recommendation: Option B for now

The Drizzle schema is essentially a domain concern (table structure mirrors domain entities). Keep it in `@backpine/domain` but in a separate directory. If it grows complex, extract to `@backpine/db` later.

---

## Dependency Graph

```
@backpine/domain
    └── effect, @effect/platform

@backpine/cloudflare
    └── effect, @effect/platform, @effect/sql-pg, @effect/sql-drizzle, drizzle-orm

@backpine/api
    ├── @backpine/domain
    └── @backpine/cloudflare

@backpine/rpc
    ├── @backpine/domain
    ├── @backpine/cloudflare
    └── @effect/rpc

effect-worker-api (app)
    ├── @backpine/domain
    ├── @backpine/api
    └── @backpine/cloudflare

effect-worker-rpc (app)
    ├── @backpine/domain
    ├── @backpine/rpc
    └── @backpine/cloudflare
```

---

## Implementation Steps

### Phase 1: Create `@backpine/cloudflare` Package

1. **Create package structure**
   ```bash
   mkdir -p packages/cloudflare/src
   ```

2. **Create FiberRef bridge**
   - Move from `apps/effect-worker-api/src/services/cloudflare.ts`
   - Make Env type generic

3. **Create service tags**
   - Move `CloudflareBindings` from `@backpine/api`
   - Move `DatabaseService` from `@backpine/api`

4. **Create error classes**
   - Move error classes from `@backpine/api`

5. **Create database factory**
   - Move from `apps/effect-worker-api/src/services/database.ts`

### Phase 2: Update `@backpine/api`

1. **Update imports** to use `@backpine/cloudflare`
2. **Simplify middleware** to only define HttpApiMiddleware tags
3. **Re-export** service tags for convenience

### Phase 3: Create `@backpine/rpc` Package

1. **Create package structure**
2. **Create RPC middleware tags**
   - `RpcCloudflareMiddleware`
   - `RpcDatabaseMiddleware`
3. **Create RPC procedure definitions**
   - Move from `@effect-worker/src/rpc/procedures/`

### Phase 4: Create `effect-worker-rpc` App

1. **Create app structure**
   - Similar to effect-worker-api but for RPC

2. **Create middleware implementations**
   - `RpcCloudflareMiddlewareLive` (Layer.succeed pattern)
   - `RpcDatabaseMiddlewareLive`

3. **Create handlers**
   - `UsersRpcHandlersLive` using `UsersRpc.toLayer`

4. **Create runtime**
   - `rpcRuntime` with `ManagedRuntime`
   - `handleRpcRequest` function

5. **Create entry point**
   - Worker fetch handler routing to RPC

### Phase 5: Update `effect-worker-api`

1. **Update imports** to use `@backpine/cloudflare`
2. **Remove duplicated code** now in cloudflare package

### Phase 6: Add DB Schema to Domain (Optional)

1. **Move schema** to `@backpine/domain/src/db/schema.ts`
2. **Update both apps** to import from domain

---

## File Changes Summary

### New Packages

| Package | Files |
|---------|-------|
| `@backpine/cloudflare` | `FiberRef.ts`, `Services.ts`, `Errors.ts`, `Database.ts`, `index.ts` |
| `@backpine/rpc` | `middleware/*.ts`, `procedures/*.ts`, `index.ts` |

### New App

| App | Files |
|-----|-------|
| `effect-worker-rpc` | `index.ts`, `runtime.ts`, `handlers/users.ts`, `services/middleware.ts`, `db/schema.ts` |

### Modified Packages

| Package | Changes |
|---------|---------|
| `@backpine/api` | Import services from cloudflare, simplify middleware |
| `@backpine/domain` | (Optional) Add db/schema.ts |

### Modified App

| App | Changes |
|-----|---------|
| `effect-worker-api` | Import from cloudflare, remove duplicated services |

---

## Testing Strategy

1. **@backpine/cloudflare**: Unit tests for FiberRef utilities
2. **@backpine/rpc**: Unit tests for procedure schemas
3. **effect-worker-rpc**: Integration tests with miniflare
4. **Cross-app**: Ensure HTTP and RPC can run independently

---

## Migration Notes

### Breaking Changes
- `CloudflareBindings` and `DatabaseService` tags move to `@backpine/cloudflare`
- Apps importing directly from `@backpine/api/middleware` may need updates

### Backward Compatibility
- `@backpine/api` will re-export from cloudflare for convenience
- Existing handler code unchanged (service tags keep same identifier)

---

## Summary

This plan extracts shared Cloudflare infrastructure into a dedicated package, enabling:

1. **Code reuse**: Both HTTP and RPC apps share FiberRef bridge, database factory
2. **Clean separation**: HTTP middleware in api, RPC middleware in rpc
3. **Consistent services**: Same `CloudflareBindings` and `DatabaseService` tags
4. **Independent apps**: effect-worker-api and effect-worker-rpc can evolve separately

The key insight is that the **infrastructure** (FiberRefs, connection factory) is shared, while **middleware patterns** differ by transport. Service tags act as the contract between infrastructure and middleware.
