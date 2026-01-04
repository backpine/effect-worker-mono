# Effect Worker API - Implementation Plan

## Overview

This document outlines the plan to create `effect-worker-api`, a Cloudflare Worker app that sources from shared packages in the monorepo. The implementation is based on patterns from the existing `@effect-worker/` project, focusing on HTTP only (no RPC).

---

## Architecture Analysis: @effect-worker/

### Core Pattern: FiberRef Bridge

The key insight is how Cloudflare's request-scoped bindings (`env`, `ctx`) flow into Effect's context:

```
Request → FiberRef.locally() → HttpApiMiddleware → Handler
```

1. **Entry Point** (`index.ts`): Wraps the Effect with `withCloudflareBindings(env, ctx)`
2. **FiberRef Bridge** (`services/cloudflare.ts`): Stores env/ctx in FiberRefs via `Effect.locally`
3. **Middleware** (`http/middleware/cloudflare.ts`): Reads from FiberRef, provides as service
4. **Handler**: Accesses via `yield* CloudflareBindings`

### Layer Composition

```
ManagedRuntime (static, built once)
├── HttpApiBuilder.api(WorkerApi)
│   └── HttpGroupsLive (handler implementations)
├── HttpApiBuilder.Router.Live
├── HttpApiBuilder.Middleware.layer
├── HttpServer.layerContext
└── MiddlewareLive
    ├── CloudflareBindingsMiddlewareLive
    └── DatabaseMiddlewareLive

Per-Request (via FiberRef)
├── CloudflareBindings (env, ctx)
└── DatabaseService (drizzle connection)
```

### File Structure Pattern

```
src/
├── index.ts              # Worker entry point (export default)
├── runtime.ts            # ManagedRuntime + handleRequest
├── http/
│   ├── api.ts            # HttpApi definition (WorkerApi class)
│   ├── index.ts          # Re-exports
│   ├── groups/
│   │   ├── *.definition.ts   # Endpoint schemas (no handler deps)
│   │   ├── *.handlers.ts     # Handler implementations
│   │   └── index.ts          # HttpGroupsLive layer
│   ├── middleware/
│   │   ├── cloudflare.ts     # CloudflareBindingsMiddleware
│   │   ├── database.ts       # DatabaseMiddleware
│   │   └── index.ts
│   ├── schemas/              # Request/response schemas
│   └── errors/               # API error types
├── services/
│   ├── cloudflare.ts         # FiberRef bridge + CloudflareBindings tag
│   └── database.ts           # DatabaseService + connection factory
└── db/
    └── schema.ts             # Drizzle schema
```

---

## Proposed Monorepo Structure

### Package Responsibilities

| Package | Purpose | Contents |
|---------|---------|----------|
| `@backpine/domain` | Domain models, schemas, errors | Branded types, Effect schemas, domain errors |
| `@backpine/api` | API definitions + middleware | HttpApiGroup definitions, middleware tags & implementations |
| `effect-worker-api` (app) | Cloudflare Worker | Entry point, runtime, wrangler config |

### Directory Layout

```
effect-worker-mono/
├── packages/
│   ├── domain/                    # Domain layer
│   │   └── src/
│   │       ├── index.ts
│   │       ├── schemas/           # Branded types, domain schemas
│   │       │   ├── User.ts
│   │       │   └── index.ts
│   │       └── errors/            # Domain errors
│   │           ├── UserError.ts
│   │           └── index.ts
│   │
│   └── api/                       # API layer (NEW)
│       └── src/
│           ├── index.ts
│           ├── groups/            # HttpApiGroup definitions
│           │   ├── health.ts
│           │   ├── users.ts
│           │   └── index.ts
│           ├── middleware/        # Middleware definitions & implementations
│           │   ├── CloudflareBindings.ts
│           │   ├── Database.ts
│           │   └── index.ts
│           └── WorkerApi.ts       # Main HttpApi class
│
└── apps/
    └── effect-worker-api/         # Cloudflare Worker app (NEW)
        ├── src/
        │   ├── index.ts           # Worker entry point
        │   ├── runtime.ts         # ManagedRuntime setup
        │   ├── handlers/          # Handler implementations
        │   │   ├── health.ts
        │   │   ├── users.ts
        │   │   └── index.ts
        │   ├── services/          # App-specific services
        │   │   ├── cloudflare.ts  # FiberRef bridge
        │   │   └── database.ts    # DB connection factory
        │   └── db/
        │       └── schema.ts      # Drizzle schema
        ├── wrangler.jsonc
        ├── package.json
        └── tsconfig.json
```

---

## Implementation Steps

### Phase 1: Create `@backpine/api` Package

1. **Scaffold package structure**
   - Copy package.json from existing package template
   - Update name to `@backpine/api`
   - Add dependencies: `@effect/platform`, `@backpine/domain`, `effect`

2. **Create middleware definitions**
   ```typescript
   // packages/api/src/middleware/CloudflareBindings.ts
   export class CloudflareBindingsMiddleware extends HttpApiMiddleware.Tag<...>()
   export class CloudflareBindingsError extends S.TaggedError<...>()
   ```

3. **Create group definitions**
   ```typescript
   // packages/api/src/groups/users.ts
   export const UsersGroup = HttpApiGroup.make("users")
     .add(HttpApiEndpoint.get("list", "/")...)
     .middleware(DatabaseMiddleware)
     .prefix("/users")
   ```

4. **Create WorkerApi class**
   ```typescript
   // packages/api/src/WorkerApi.ts
   export class WorkerApi extends HttpApi.make("WorkerApi")
     .add(HealthGroup)
     .add(UsersGroup)
     .middleware(CloudflareBindingsMiddleware)
     .prefix("/api") {}
   ```

### Phase 2: Clean Up `@backpine/domain`

1. **Move domain schemas**
   - User schemas (UserId, Email, UserSchema, CreateUserSchema)
   - Path parameter schemas

2. **Move domain errors**
   - UserCreationError
   - UserNotFoundError
   - Generic NotFoundError

3. **Remove existing TodosApi** (replace with user domain)

### Phase 3: Create `effect-worker-api` App

1. **Scaffold app structure**
   - Create `apps/effect-worker-api/`
   - Add package.json with Cloudflare dependencies
   - Add wrangler.jsonc

2. **Create FiberRef bridge**
   ```typescript
   // apps/effect-worker-api/src/services/cloudflare.ts
   export const currentEnv = FiberRef.unsafeMake<Env | null>(null)
   export const currentCtx = FiberRef.unsafeMake<ExecutionContext | null>(null)
   export const withCloudflareBindings = (env, ctx) => ...
   ```

3. **Create middleware implementations**
   ```typescript
   // apps/effect-worker-api/src/services/middleware.ts
   export const CloudflareBindingsMiddlewareLive = Layer.effect(
     CloudflareBindingsMiddleware,  // From @backpine/api
     Effect.gen(function* () {
       return Effect.gen(function* () {
         const env = yield* FiberRef.get(currentEnv)
         // ...
       })
     })
   )
   ```

4. **Create handler implementations**
   ```typescript
   // apps/effect-worker-api/src/handlers/users.ts
   export const UsersGroupLive = HttpApiBuilder.group(
     WorkerApi,  // From @backpine/api
     "users",
     (handlers) => Effect.gen(function* () { ... })
   )
   ```

5. **Create runtime**
   ```typescript
   // apps/effect-worker-api/src/runtime.ts
   const ApiLayer = Layer.mergeAll(
     HttpApiBuilder.api(WorkerApi).pipe(Layer.provide(HttpGroupsLive)),
     HttpApiBuilder.Router.Live,
     HttpApiBuilder.Middleware.layer,
     HttpServer.layerContext,
   ).pipe(Layer.provide(MiddlewareLive))

   export const runtime = ManagedRuntime.make(ApiLayer)
   ```

6. **Create entry point**
   ```typescript
   // apps/effect-worker-api/src/index.ts
   export default {
     async fetch(request: Request, env: Env, ctx: ExecutionContext) {
       const effect = handleRequest(request).pipe(
         withCloudflareBindings(env, ctx)
       )
       return runtime.runPromise(effect)
     }
   } satisfies ExportedHandler<Env>
   ```

### Phase 4: Configuration

1. **Update monorepo tsconfig.base.json**
   - Add path aliases for `@backpine/api`

2. **Update vitest.shared.ts**
   - Add alias for api package

3. **Create app-specific configs**
   - tsconfig.json extending monorepo base
   - wrangler.jsonc with bindings

---

## Package Dependencies

```
@backpine/domain (no workspace deps)
    ├── effect
    └── @effect/platform (for HttpApiSchema)

@backpine/api
    ├── effect
    ├── @effect/platform
    └── @backpine/domain (workspace:^)

effect-worker-api (app)
    ├── effect
    ├── @effect/platform
    ├── @effect/sql-pg
    ├── @effect/sql-drizzle
    ├── drizzle-orm
    ├── @backpine/domain (workspace:^)
    └── @backpine/api (workspace:^)
```

---

## Key Decisions

### 1. Where does the FiberRef bridge live?

**Decision**: In the app (`apps/effect-worker-api/src/services/cloudflare.ts`)

**Rationale**: The FiberRef bridge is tightly coupled to the Cloudflare runtime. Different apps might have different env types or bindings patterns.

### 2. Where do middleware implementations live?

**Decision**: In the app

**Rationale**: Middleware implementations need access to app-specific FiberRefs. The package only defines the middleware tags.

### 3. Where do handlers live?

**Decision**: In the app

**Rationale**: Handlers import from both `@backpine/api` (WorkerApi) and local services (DatabaseService). They're app-specific.

### 4. What about the Drizzle schema?

**Decision**: In the app (`apps/effect-worker-api/src/db/schema.ts`)

**Rationale**: Database schema is deployment-specific. Different apps might have different databases.

---

## Definition vs Implementation Split

| Layer | Package | App |
|-------|---------|-----|
| `CloudflareBindings` tag | - | services/cloudflare.ts |
| `CloudflareBindingsMiddleware` tag | middleware/CloudflareBindings.ts | - |
| `CloudflareBindingsMiddlewareLive` impl | - | services/middleware.ts |
| `UsersGroup` definition | groups/users.ts | - |
| `UsersGroupLive` handlers | - | handlers/users.ts |
| `WorkerApi` class | WorkerApi.ts | - |
| `runtime` + `handleRequest` | - | runtime.ts |

---

## File Naming Conventions

- **Definitions**: `users.ts`, `health.ts` (just the name)
- **Handlers**: `users.handlers.ts` or keep in `handlers/users.ts` directory
- **Middleware**: `CloudflareBindings.ts` (PascalCase, matches class name)
- **Services**: `cloudflare.ts`, `database.ts` (lowercase)

---

## Testing Strategy

1. **Domain package tests**: Schema validation, error types
2. **API package tests**: Group definitions compile, schemas validate
3. **App integration tests**: Use miniflare to test full request flow

---

## Summary

This plan separates concerns across three layers:

1. **Domain** (`@backpine/domain`): Pure domain models, no HTTP concerns
2. **API** (`@backpine/api`): HTTP API structure, middleware contracts
3. **App** (`effect-worker-api`): Cloudflare-specific runtime, implementations

The key insight is that API **definitions** are shareable, but **implementations** are app-specific because they depend on the runtime environment (Cloudflare FiberRefs, database connections, etc.).
