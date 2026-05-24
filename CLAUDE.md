# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Effect v4 — Vendored Source Reference (`repos/effect`)

This project runs **Effect v4 (`4.0.0-beta.70`)**, a fast-moving beta whose public
docs lag the actual APIs. The full Effect v4 source is vendored at **`repos/effect`**
(a `git subtree` of **`Effect-TS/effect-smol`** — the v4 dev repo — pinned to the
`effect@4.0.0-beta.70` tag, so it exactly matches the version we compile against)
specifically so you can read real implementations instead of guessing or relying on
outdated web docs. Note: v4 lives in `effect-smol`, NOT `Effect-TS/effect` (that repo
is still v3).

**Use it as your primary reference for Effect v4 questions:**

- Resolving an API: read the source/types under `repos/effect/packages/effect/src/`.
  Module names map 1:1 to imports — `Context` → `repos/effect/packages/effect/src/Context.ts`,
  `Effect` → `Effect.ts`, etc. Unstable APIs live under `src/unstable/` (e.g.
  `src/unstable/rpc/`, `src/unstable/http/`, `src/unstable/httpapi/`, `src/unstable/sql/`,
  `src/unstable/reactivity/`).
- Verifying a signature, error shape, or option before using it — grep the source
  rather than assuming v3 patterns hold.
- Finding idiomatic usage — search `**/*.test.ts` and `examples/` inside `repos/effect`.

**Rules:**

- `repos/effect` is **read-only reference material**. Never edit it, import from it,
  or include it in app/package code — apps depend on the published `effect` package
  via the `pnpm-workspace.yaml` catalog, not on the vendored tree.
- It is intentionally excluded from search, auto-imports, and file watching (see
  `.vscode/settings.json`) and from the pnpm/tsc/vitest workspaces.
- Keep it current with the `git subtree pull` command in the Commands section.

**v4 gotchas already encountered** (the source is the source of truth if these drift):
the `ServiceMap` module was renamed back to `Context` (`Context.Service`,
`Context.Reference`, `Context.make`); `SqlError` now wraps a structured reason
(`new SqlError({ reason: new UnknownError({ cause }) })`).

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

# Update the vendored Effect v4 source (repos/effect) when bumping the catalog.
# Pin to the tag that matches the installed version (e.g. effect@4.0.0-beta.NN),
# or use `main` for the latest. Source repo is effect-smol (v4), NOT Effect-TS/effect.
git subtree pull --prefix=repos/effect \
  https://github.com/Effect-TS/effect-smol.git effect@4.0.0-beta.70 --squash
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

- All shared packages use the `@repo/*` namespace (e.g., `@repo/domain`, `@repo/db`)
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
