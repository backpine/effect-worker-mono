# CLAUDE.md - Effect Worker API

This document provides guidance for AI assistants working with the Effect Worker API codebase.

## Project Overview

**Effect Worker API** is a Cloudflare Worker HTTP API built with Effect-TS. It uses the monorepo's shared packages for domain models and API definitions.

### Key Concepts

1. **Effect-TS Integration**: All operations use Effect types for composition, error handling, and dependency injection
2. **Request-Scoped Runtime**: FiberRef bridge makes Cloudflare bindings available at request time
3. **Layer Memoization**: Static services are instantiated once, request-scoped services via middleware
4. **Monorepo Packages**: Imports from `@backpine/domain` and `@backpine/api`

## Repository Structure

```
effect-worker-api/
├── src/
│   ├── index.ts              # Worker entry point (export default)
│   ├── runtime.ts            # ManagedRuntime + handleRequest
│   ├── handlers/             # Handler implementations
│   │   ├── health.ts
│   │   ├── users.ts
│   │   └── index.ts
│   ├── services/             # App-specific services
│   │   ├── cloudflare.ts     # FiberRef bridge
│   │   ├── database.ts       # DB connection factory
│   │   ├── middleware.ts     # Middleware implementations
│   │   └── index.ts
│   └── db/
│       └── schema.ts         # Drizzle schema
├── test/                     # Test files
├── wrangler.jsonc            # Cloudflare configuration
├── package.json
└── tsconfig.json
```

## Core Patterns

### 1. FiberRef Bridge

Cloudflare bindings flow into Effect context via FiberRef:

```typescript
// Entry point wraps effect with bindings
const effect = handleRequest(request).pipe(
  withCloudflareBindings(env, ctx)
)
return runtime.runPromise(effect)
```

### 2. Middleware Pattern

Middleware definitions come from `@backpine/api`, implementations are local:

```typescript
// From @backpine/api
export class CloudflareBindingsMiddleware extends HttpApiMiddleware.Tag<...>()

// Local implementation
export const CloudflareBindingsMiddlewareLive = Layer.effect(
  CloudflareBindingsMiddleware,
  Effect.gen(function* () {
    return Effect.gen(function* () {
      const env = yield* FiberRef.get(currentEnv)
      // ...
    })
  })
)
```

### 3. Handler Pattern

Handlers implement group definitions from `@backpine/api`:

```typescript
export const UsersGroupLive = HttpApiBuilder.group(
  WorkerApi,  // From @backpine/api
  "users",
  (handlers) => Effect.gen(function* () {
    return handlers
      .handle("list", () => ...)
      .handle("get", ({ path }) => ...)
  })
)
```

## Development Commands

```bash
pnpm dev              # Start local dev server with wrangler
pnpm test             # Run tests
pnpm check            # Type checking
pnpm build            # Build for production
pnpm deploy           # Deploy to Cloudflare
```

Database operations are centralized in `@backpine/db`:
```bash
cd packages/db
DATABASE_URL=... pnpm db:push    # Push schema to database
DATABASE_URL=... pnpm db:studio  # Open Drizzle Studio
```

## Dependencies

- `@backpine/domain` - Domain types, schemas, errors
- `@backpine/api` - API definitions, middleware tags
- `effect` - Core Effect-TS library
- `@effect/platform` - HTTP API building
- `@effect/sql-drizzle` - Database integration
- `drizzle-orm` - ORM

## Cloudflare Constraints

- No global state persistence between requests
- `env` bindings only available in handler context
- Limited CPU time (10-30ms per request)
- 128MB memory limit per isolate

## When Making Changes

1. Domain types go in `@backpine/domain`
2. API definitions go in `@backpine/api`
3. Implementations stay in this app
4. Use `yield* DatabaseService` for DB access
5. Use `yield* CloudflareBindings` for env/ctx access
