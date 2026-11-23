# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Effect v4

The root `package.json` pins Bun 1.4.5 and Effect 4.1.5. Wrangler and
the Cloudflare dev servers use Node.js.
Check the installed declarations and source in `node_modules/effect` for the
exact version in use. The older snapshot in `repos/effect` is historical.

## Commands

```bash
# Root commands
bun install          # Install dependencies
bun run build            # Build packages and apps in dependency order
bun run check            # Type check all packages/apps (runs per-package)
bun test                 # Run the workspace tests with Docker running
bun run test:db          # Run the isolated PostgreSQL tests

# App development (run from app directory)
cd apps/api
bun run dev              # Start local dev server with wrangler
bun run deploy           # Deploy to Cloudflare

# Database operations (run from packages/db)
cd packages/db
bun run db:generate --name=describe_the_change   # Generate migrations
bun run db:check                                 # Check migration history
DATABASE_URL=postgres://... bun run db:migrate   # Run migrations
```

## Architecture

This is a Cloudflare Workers monorepo using Effect-TS. Apps import from shared packages via TypeScript path aliases (`@repo/*`).

### Package Dependency Flow

```
@repo/domain     (types, schemas, errors)
@repo/db         (Drizzle schema, query programs, Database tag)   ── depends on domain
@repo/cloudflare (Effect Worker adapter and typed bindings)      ── standalone
@repo/contracts  (HTTP/RPC API definitions)                       ── depends on domain
apps/            (composition roots, handlers and live layers)   ── depend on the above
```

### Key Patterns

**Effectful bindings** (`@repo/cloudflare`): `makeCloudflare<Env>(() => env)` exposes `CloudflareEnv` (a `Context.Reference` defaulting to the `cloudflare:workers` `env`) plus cast-free selector accessors. Bindings become yieldable and error-typed:

```typescript
const bucket = yield* r2((e) => e.BUCKET)        // effectful R2 client
const { connectionString } = yield* hyperdrive((e) => e.HYPERDRIVE)
```

**Worker composition**: `apps/api/src/index.ts` and `apps/react-app/worker/index.ts`
select the live layers. `Worker.make` builds the router and handler layers
once per isolate and supplies a fresh request scope. REST handlers and RPC
procedures acquire their own database connection after decoding the input.
Each call in an RPC batch owns its connection.

**Query Programs**: Put parameterized Effect SQL in `packages/db/src/queries/`. Handlers import the programs from `@repo/db/queries` and supply the request's `Database` service. The [DB package guide](packages/db/README.md) covers schema updates and test fixtures.

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
| Database tables (Drizzle) | `packages/db/src/schema/` |
| Database migrations | `packages/db/migrations/` |
| PostgreSQL integration tests and fixtures | `packages/db/test/` |
| Reusable queries | `@repo/db/src/queries/` |
| HTTP endpoint definitions | `@repo/contracts/src/api/groups/` |
| RPC procedure definitions | `@repo/contracts/src/rpc/procedures/` |
| REST handlers and services | `apps/api/src/{handlers,services}/` |
| RPC handlers and services | `apps/react-app/worker/{handlers,services}/` |
