# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Root commands
pnpm install          # Install dependencies
pnpm build            # Build packages in order: domain → db,cloudflare → contracts
pnpm check            # Type check all packages/apps (runs per-package)
pnpm test             # Run all tests with vitest

# App development (run from app directory)
cd apps/effect-worker-api
pnpm dev              # Start local dev server with wrangler
pnpm deploy           # Deploy to Cloudflare

# Database operations (run from packages/db)
cd packages/db
DATABASE_URL=postgres://... pnpm db:push      # Push schema to database
DATABASE_URL=postgres://... pnpm db:studio    # Open Drizzle Studio
DATABASE_URL=postgres://... pnpm db:generate  # Generate migrations
DATABASE_URL=postgres://... pnpm db:migrate   # Run migrations
```

## Architecture

This is a Cloudflare Workers monorepo using Effect-TS. Apps import from shared packages via TypeScript path aliases (`@repo/*`).

### Package Dependency Flow

```
@repo/domain (types, schemas, errors)
       ↓
@repo/db (Drizzle schema + Effect query programs)
       ↓
@repo/cloudflare (FiberRef bridge, service tags, database factory)
       ↓
@repo/contracts (HTTP/RPC API definitions, middleware tags)
       ↓
apps/ (handler implementations, middleware implementations)
```

### Key Patterns

**FiberRef Bridge**: Cloudflare's `env` and `ctx` are request-scoped. The pattern stores them in FiberRefs at request entry, then middleware reads them to provide services:

```typescript
// Entry point
const effect = handleRequest(request).pipe(withCloudflareBindings(env, ctx))
return runtime.runPromise(effect)

// Middleware reads FiberRef → provides service
const env = yield* FiberRef.get(currentEnv)
return { env, ctx }
```

**Contract/Implementation Split**: `@repo/contracts` defines abstract middleware tags; apps provide concrete implementations via Layers.

**Query Programs**: Database queries live in `@repo/db/src/queries/` as Effect programs requiring `PgDrizzle`. Handlers call these instead of inline queries.

### Import Conventions

- Apps use `@/*` for internal imports (e.g., `@/services`, `@/handlers`)
- Packages use relative imports (`./`, `../`)
- Cross-package imports use `@repo/*`
- Never re-export from `@repo/*` in app barrel files; import directly where needed

### Local Development

For Hyperdrive (database), set in `.env`:
```
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://postgres:postgres@localhost:5432/effect_worker"
```

### Where Code Goes

| Type | Location |
|------|----------|
| Domain types, branded schemas | `@repo/domain/src/schemas/` |
| Domain errors | `@repo/domain/src/errors/` |
| Database tables (Drizzle) | `@repo/db/src/schema.ts` |
| Reusable queries | `@repo/db/src/queries/` |
| HTTP endpoint definitions | `@repo/contracts/src/http/groups/` |
| RPC procedure definitions | `@repo/contracts/src/rpc/procedures/` |
| Middleware tags | `@repo/contracts/src/*/middleware/` |
| Handler implementations | `apps/*/src/handlers/` |
| Middleware implementations | `apps/*/src/services/middleware.ts` |
