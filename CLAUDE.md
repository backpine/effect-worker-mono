# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Effect v4

The root `package.json` pins Bun 1.4.5 and Effect 4.1.5. Wrangler and
the Cloudflare dev servers use Node.js.
Check the installed declarations and source in `node_modules/effect` for the
exact version in use. The older snapshot in `repos/effect` is historical.

The Effect package patch maps the React app's existing import paths to the
stable exports. Remove those aliases when the React app migrates its imports.

## Commands

```bash
# Root commands
bun install          # Install dependencies
bun run build            # Build packages and apps in dependency order
bun run check            # Type check all packages/apps (runs per-package)
bun test             # Run the workspace tests

# App development (run from app directory)
cd apps/effect-worker-api
bun run dev              # Start local dev server with wrangler
bun run deploy           # Deploy to Cloudflare

# Database operations (run from packages/db)
cd packages/db
DATABASE_URL=postgres://... bun run db:push      # Push schema to database
DATABASE_URL=postgres://... bun run db:studio    # Open Drizzle Studio
DATABASE_URL=postgres://... bun run db:generate  # Generate migrations
DATABASE_URL=postgres://... bun run db:migrate   # Run migrations
```

## Architecture

This is a Cloudflare Workers monorepo using Effect-TS. Apps import from shared packages via TypeScript path aliases (`@repo/*`).

### Package Dependency Flow

```
@repo/domain     (types, schemas, errors)
@repo/db         (Drizzle schema, query programs, Database tag)   ── depends on domain
@repo/cloudflare (Effect Worker adapter and typed bindings)      ── standalone
@repo/contracts  (HTTP/RPC API definitions + middleware tags)     ── depends on domain, db
apps/            (composition roots, handlers and live layers)   ── depend on the above
```

### Key Patterns

**Effectful bindings** (`@repo/cloudflare`): `makeCloudflare<Env>(() => env)` exposes `CloudflareEnv` (a `Context.Reference` defaulting to the `cloudflare:workers` `env`) plus cast-free selector accessors. Bindings become yieldable and error-typed:

```typescript
const bucket = yield* r2((e) => e.BUCKET)        // effectful R2 client
const { connectionString } = yield* hyperdrive((e) => e.HYPERDRIVE)
```

**REST Worker** (`apps/effect-worker-api`): `Worker.make` builds the router and
group layers once per isolate and supplies a fresh request scope. The composition
root passes the database layer to the users group. The users handlers build
it per request after decoding, and the request owns the connection. RPC in
`react-app` uses its existing database middleware.

**Query Programs**: Database queries live in `@repo/db/src/queries/` as Effect programs requiring the `Database` tag. Handlers call these instead of inline queries.

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
| REST database layer | `apps/effect-worker-api/src/services/database.ts` |
