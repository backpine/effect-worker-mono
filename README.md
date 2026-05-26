# Effect Worker Monorepo

A production-ready monorepo for building Cloudflare Workers with Effect-TS, featuring shared domain models, type-safe API contracts, and database integration.

## Quick Start

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm check            # Type check
pnpm test             # Run tests

# Local development
cd apps/effect-worker-api
pnpm dev              # Start dev server
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Applications                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐│
│  │effect-worker-api │ │     react-app    │ │  tanstack-start  ││
│  │   (HTTP REST)    │ │(SPA + RPC Worker)│ │  (Full-Stack UI) ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                     Shared Packages                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────┐    │
│  │  domain   │ │ contracts │ │cloudflare │ │      db      │    │
│  │ (types)   │ │   (API)   │ │  (infra)  │ │   (schema)   │    │
│  └───────────┘ └───────────┘ └───────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

All packages use the `@repo/*` namespace for internal monorepo imports.

### `@repo/domain`
Core domain schemas and errors (Effect Schema).

```typescript
import { CreateUserSchema, UserNotFoundError } from "@repo/domain"

// Schemas provide both compile-time types and runtime validation.
type CreateUser = typeof CreateUserSchema.Type
```

### `@repo/contracts`
API definitions for HTTP and RPC endpoints. Defines the contract between client and server.

```typescript
import { WorkerApi, UsersGroup, UsersRpc } from "@repo/contracts"
```

**HTTP Groups:**
- `HealthGroup` - Health check endpoints
- `UsersGroup` - User CRUD operations

**RPC Procedures:**
- `UsersRpc` - User operations via RPC

### `@repo/cloudflare`
Effectful, type-safe Cloudflare bindings. Keeps the `wrangler types` workflow
(the typed `env` from `cloudflare:workers`) and adds an Effect SDK on top:
bindings become yieldable, error-typed, and composable.

```typescript
import { makeCloudflare } from "@repo/cloudflare"

// Build cast-free accessors over your typed Env.
const { hyperdrive, r2, kv, queue } = makeCloudflare<Env>(() => env)

// In a handler:
const { connectionString } = yield* hyperdrive((e) => e.HYPERDRIVE)
```

### `@repo/db`
Drizzle ORM schema, the `Database` service tag, the request-scoped `connect`
factory, and reusable Effect query programs.

```typescript
import { users, Database, connect } from "@repo/db"

// `Database` is provided per request via middleware; handlers just yield it.
const db = yield* Database
const rows = yield* db.select().from(users)
```

## Applications

### `effect-worker-api`
REST HTTP API built with `@effect/platform`.

```bash
cd apps/effect-worker-api
pnpm dev        # Local dev server
pnpm deploy     # Deploy to Cloudflare
```

**Endpoints:**
- `GET /health` - Health check
- `GET /users` - List users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create user

### `react-app`
React SPA (Vite + TanStack Router) with an Effect RPC server co-located in
`worker/`. The Cloudflare Vite plugin runs the worker alongside the SPA, so the
client calls the relative path `/rpc` — one app, one origin, no separate RPC
service. The worker uses Effect `RpcServer` over the shared `UsersRpc` contract
and the SPA queries it through `@effect/atom-react` (see `src/atoms/`).

```bash
cd apps/react-app
pnpm dev        # SPA + RPC worker on one dev server (port 3001)
pnpm deploy     # Build + deploy to Cloudflare
```

**Endpoints:**
- `POST /rpc` - Effect RPC endpoint (UsersRpc: listUsers / getUser / createUser)

### `tanstack-start`
Full-stack React application with TanStack Start, featuring Effect-TS integration via middleware.

```bash
cd apps/tanstack-start
pnpm dev        # Local dev server (port 3000)
pnpm deploy     # Deploy to Cloudflare
```

**Features:**
- TanStack Router (file-based routing)
- TanStack Query (server state management)
- Effect runtime middleware for server functions
- Tailwind CSS v4 + Shadcn/UI components

**Effect Integration Pattern:**
```typescript
// Middleware creates scoped Effect runtime per-request
export const effectRuntimeMiddleware = createMiddleware().server(
  async ({ next }) => {
    const servicesLayer = Layer.mergeAll(/* your services */)
    return Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* Layer.toRuntime(servicesLayer)
          const runEffect = <A, E>(effect: Effect.Effect<A, E, Services>) =>
            Runtime.runPromise(runtime)(effect)
          return yield* Effect.tryPromise({
            try: () => next({ context: { env, runEffect } }),
            catch: (e) => { throw e }
          })
        })
      )
    )
  }
)

// Server functions use runEffect to execute Effect programs
export const myFunction = createServerFn()
  .middleware([effectRuntimeMiddleware])
  .handler(async ({ context }) => {
    return context.runEffect(
      Effect.gen(function* () {
        const db = yield* Database
        return yield* db.select().from(users)
      })
    )
  })
```

## Core Patterns

### Effectful bindings
Cloudflare bindings are accessed through `@repo/cloudflare`. `makeCloudflare`
returns cast-free accessors backed by `CloudflareEnv`, a `Context.Reference`
that defaults to the `cloudflare:workers` env — so reading a binding adds
nothing to a handler's requirement channel:

```typescript
const { hyperdrive, r2, kv } = makeCloudflare<Env>(() => env)

Effect.gen(function* () {
  const { connectionString } = yield* hyperdrive((e) => e.HYPERDRIVE)
  // ...
})
```

### Request-scoped database via middleware
On Cloudflare the Postgres socket must be opened **per request**. Contracts
define an abstract middleware tag that *provides* `Database`; apps implement it
by opening a connection inside the request `Scope` and providing it downstream.
The type system makes it impossible to ship a DB-using route without wiring it.

```typescript
// In contracts (abstract): the tag declares what it provides.
export class DatabaseMiddleware extends HttpApiMiddleware.Service<
  DatabaseMiddleware,
  { provides: Database }
>()("@repo/api/DatabaseMiddleware", { error: DatabaseConnectionError }) {}

// In app (implementation): a function that wraps the downstream effect,
// opens the request-scoped connection, and provides Database.
export const DatabaseMiddlewareLive = Layer.succeed(
  DatabaseMiddleware,
  (httpEffect) =>
    Effect.gen(function* () {
      const { connectionString } = yield* hyperdrive((e) => e.HYPERDRIVE)
      const db = yield* connect(connectionString).pipe(
        Effect.catch(() =>
          Effect.fail(new DatabaseConnectionError({ message: "Database connection failed" }))
        )
      )
      return yield* httpEffect.pipe(Effect.provideService(Database, db))
    })
)
```

### Handler Implementation
Handlers yield `Database` directly (provided by the middleware above):

```typescript
.handle("list", () => Effect.gen(function* () {
  const db = yield* Database
  return yield* db.select().from(users)
}))
.handle("get", ({ path: { id } }) => Effect.gen(function* () {
  const db = yield* Database
  const [user] = yield* db.select().from(users).where(eq(users.id, id))
  if (!user) return yield* Effect.fail(new UserNotFoundError({ id, message: "Not found" }))
  return user
}))
```

### Error Handling
Typed errors with automatic HTTP status mapping via `httpApiStatus`:

```typescript
export class UserNotFoundError extends S.TaggedErrorClass<UserNotFoundError>()(
  "UserNotFoundError",
  { id: S.Number, message: S.String },
  { httpApiStatus: 404 }
) {}
```

## Project Structure

```
effect-worker-mono/
├── apps/
│   ├── effect-worker-api/     # HTTP REST API
│   │   ├── src/
│   │   │   ├── index.ts       # Worker entry point
│   │   │   ├── runtime.ts     # Effect runtime
│   │   │   ├── handlers/      # Handler implementations
│   │   │   └── services/      # Middleware implementations
│   │   └── wrangler.jsonc     # Cloudflare config
│   ├── react-app/             # React SPA + co-located Effect RPC worker
│   │   ├── src/               # SPA (atoms call /rpc via @effect/atom-react)
│   │   └── worker/            # Effect RpcServer (UsersRpc) served at /rpc
│   └── tanstack-start/        # Full-stack React app
│       ├── src/
│       │   ├── routes/        # File-based routes
│       │   ├── components/    # React components
│       │   └── server/        # Server-side code
│       │       ├── middleware/  # Effect runtime middleware
│       │       ├── functions/   # Server functions
│       │       └── types.ts     # Effect service types
│       └── wrangler.jsonc     # Cloudflare config
├── packages/
│   ├── domain/                # Domain types & schemas
│   │   └── src/
│   │       ├── schemas/       # Branded types
│   │       └── errors/        # Domain errors
│   ├── contracts/             # API definitions
│   │   └── src/
│   │       ├── http/          # HTTP endpoints
│   │       └── rpc/           # RPC procedures
│   ├── cloudflare/            # Effectful Cloudflare bindings
│   │   └── src/
│   │       ├── make.ts        # makeCloudflare accessors
│   │       └── {r2,kv,queue}.ts  # Per-binding effect wrappers
│   └── db/                    # Database
│       └── src/
│           ├── schema.ts      # Drizzle tables
│           ├── database.ts    # Database service tag
│           ├── connect.ts     # Request-scoped connection factory
│           └── queries/       # Reusable Effect query programs
└── designs/                   # Design docs & architecture decisions
```

## Configuration

### TypeScript
Strict mode enabled with path aliases for all packages:

```json
{
  "compilerOptions": {
    "paths": {
      "@repo/domain": ["./packages/domain/src"],
      "@repo/contracts": ["./packages/contracts/src"],
      "@repo/cloudflare": ["./packages/cloudflare/src"],
      "@repo/db": ["./packages/db/src"]
    }
  }
}
```

### Cloudflare Bindings
Configure in `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [{ "binding": "MY_KV", "id": "xxx" }],
  "r2_buckets": [{ "binding": "MY_R2", "bucket_name": "xxx" }],
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "xxx" }]
}
```

### Hyperdrive (Database Connection Pooling)

Cloudflare Hyperdrive provides connection pooling for PostgreSQL. In production, configure via `wrangler.jsonc`:

```jsonc
{
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "your-hyperdrive-id" }]
}
```

For **local development**, Wrangler simulates Hyperdrive using an environment variable. Create a `.env` file or export:

```bash
# .dev.vars (or export in shell)
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://postgres:postgres@localhost:5432/effect_worker"
```

The `HYPERDRIVE` suffix must match your binding name. Wrangler will automatically provide `env.HYPERDRIVE.connectionString` in your worker.

**Usage in middleware:**
```typescript
const db = yield* connect(env.HYPERDRIVE.connectionString)
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages |
| `pnpm check` | Type check all packages |
| `pnpm test` | Run all tests |
| `pnpm coverage` | Generate coverage report |
| `pnpm clean` | Remove dist folders |

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Cloudflare Workers |
| Framework | Effect-TS v4 (`effect@4.0.0-beta.70`) |
| HTTP | `effect/unstable/httpapi` |
| RPC | `effect/unstable/rpc` |
| Full-Stack UI | TanStack Start + TanStack Router + TanStack Query |
| Database | Drizzle ORM (`drizzle-orm/effect-postgres`) + PostgreSQL |
| Build | pnpm workspaces + TypeScript |
| Testing | Vitest + @effect/vitest |
| Deployment | Wrangler |

## Key Dependencies

- **effect** (`4.0.0-beta.70`) - Core runtime; HTTP/RPC live under `effect/unstable/*`
- **@effect/sql-pg** - PostgreSQL client (underlies the Drizzle connection)
- **@effect/atom-react** - Reactive state for the React SPA
- **drizzle-orm** (`1.0.0-rc.3`) - Type-safe ORM; `drizzle-orm/effect-postgres` client
- **@tanstack/react-start** - Full-stack React framework
- **@tanstack/react-router** - Type-safe file-based routing
- **@tanstack/react-query** - Server state management
- **wrangler** - Cloudflare Workers CLI

## Development Workflow

1. **Make changes** to packages or apps
2. **Build packages** if contract/domain/infra changed: `pnpm build`
3. **Type check**: `pnpm check`
4. **Run tests**: `pnpm test`
5. **Dev server**: `cd apps/effect-worker-api && pnpm dev`
6. **Deploy**: `pnpm deploy`

## Database Operations

```bash
cd packages/db

# Push schema changes
DATABASE_URL=postgres://postgres:postgres@localhost:5432/effect_worker pnpm db:push

# Open Drizzle Studio
DATABASE_URL=postgres://postgres:postgres@localhost:5432/effect_worker pnpm db:studio

# Generate migrations
DATABASE_URL=postgres://postgres:postgres@localhost:5432/effect_worker pnpm db:generate

# Run migrations
DATABASE_URL=postgres://postgres:postgres@localhost:5432/effect_worker pnpm db:migrate
```

## License

See [LICENSE](./LICENSE) for details.
