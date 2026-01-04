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
│  ┌──────────────────────┐    ┌──────────────────────┐          │
│  │  effect-worker-api   │    │   effect-worker-rpc  │          │
│  │    (HTTP REST)       │    │     (RPC JSON)       │          │
│  └──────────────────────┘    └──────────────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│                     Shared Packages                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────┐    │
│  │  domain   │ │ contracts │ │cloudflare │ │      db      │    │
│  │ (types)   │ │   (API)   │ │  (infra)  │ │   (schema)   │    │
│  └───────────┘ └───────────┘ └───────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

### `@backpine/domain`
Core domain types, branded schemas, and errors.

```typescript
import { UserId, UserSchema, UserNotFoundError } from "@backpine/domain"

// Branded types for type-safe IDs
const id: UserId = "usr_abc123" as UserId
```

### `@backpine/contracts`
API definitions for HTTP and RPC endpoints. Defines the contract between client and server.

```typescript
import { WorkerApi, UsersGroup, UsersRpc } from "@backpine/contracts"
```

**HTTP Groups:**
- `HealthGroup` - Health check endpoints
- `UsersGroup` - User CRUD operations

**RPC Procedures:**
- `UsersRpc` - User operations via RPC

### `@backpine/cloudflare`
Infrastructure layer for Cloudflare Workers integration with Effect.

```typescript
import {
  withCloudflareBindings,  // Wrap effects with env/ctx
  CloudflareBindings,       // Service tag
  PgDrizzle,               // Database connection
  currentEnv,              // FiberRef for env access
} from "@backpine/cloudflare"
```

### `@backpine/db`
Drizzle ORM schema definitions.

```typescript
import { users } from "@backpine/db"
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

### `effect-worker-rpc`
RPC API using `@effect/rpc` for procedure-based communication.

```bash
cd apps/effect-worker-rpc
pnpm dev        # Local dev server
pnpm deploy     # Deploy to Cloudflare
```

**Endpoints:**
- `GET /health` - Health check
- `POST /rpc` - RPC endpoint

## Core Patterns

### FiberRef Bridge
Request-scoped Cloudflare bindings via Effect's FiberRef:

```typescript
// Entry point wraps effect with bindings
const effect = handleRequest(request).pipe(withCloudflareBindings(env, ctx))
return runtime.runPromise(effect)

// Handlers access via service
Effect.gen(function* () {
  const { env } = yield* CloudflareBindings
  // Use env.MY_KV, env.MY_R2, etc.
})
```

### Middleware Pattern
Contracts define abstract middleware tags, apps provide implementations:

```typescript
// In contracts (abstract)
export class DatabaseMiddleware extends HttpApiMiddleware.Tag<DatabaseMiddleware>()(
  "DatabaseMiddleware",
  { failure: DatabaseConnectionError, provides: PgDrizzle }
) {}

// In app (implementation)
export const DatabaseMiddlewareLive = Layer.effect(
  DatabaseMiddleware,
  Effect.gen(function* () {
    const drizzle = yield* makeDrizzle()
    return drizzle
  })
)
```

### Handler Implementation
Type-safe handlers using Effect generators:

```typescript
export const UsersGroupLive = HttpApiBuilder.group(
  WorkerApi,
  "users",
  (handlers) => handlers
    .handle("list", () => Effect.gen(function* () {
      const drizzle = yield* PgDrizzle
      return yield* drizzle.select().from(users)
    }))
    .handle("get", ({ path: { id } }) => Effect.gen(function* () {
      const drizzle = yield* PgDrizzle
      const user = yield* drizzle.select().from(users).where(eq(users.id, id))
      if (!user) return yield* Effect.fail(new UserNotFoundError({ id }))
      return user
    }))
)
```

### Error Handling
Typed errors with automatic HTTP status mapping:

```typescript
export class UserNotFoundError extends S.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  { id: UserIdSchema, message: S.String },
  HttpApiSchema.annotations({ status: 404 })
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
│   └── effect-worker-rpc/     # RPC API
├── packages/
│   ├── domain/                # Domain types & schemas
│   │   └── src/
│   │       ├── schemas/       # Branded types
│   │       └── errors/        # Domain errors
│   ├── contracts/             # API definitions
│   │   └── src/
│   │       ├── http/          # HTTP endpoints
│   │       └── rpc/           # RPC procedures
│   ├── cloudflare/            # Worker infrastructure
│   │   └── src/
│   │       ├── fiber-ref.ts   # FiberRef bridge
│   │       ├── services.ts    # Service tags
│   │       └── database.ts    # Connection factory
│   └── db/                    # Database schema
│       └── src/schema.ts      # Drizzle tables
└── reports/                   # Architecture decisions
```

## Configuration

### TypeScript
Strict mode enabled with path aliases for all packages:

```json
{
  "compilerOptions": {
    "paths": {
      "@backpine/domain": ["./packages/domain/src"],
      "@backpine/contracts": ["./packages/contracts/src"],
      "@backpine/cloudflare": ["./packages/cloudflare/src"],
      "@backpine/db": ["./packages/db/src"]
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
return yield* makeDrizzle(env.HYPERDRIVE.connectionString)
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
| Framework | Effect-TS |
| HTTP | @effect/platform |
| RPC | @effect/rpc |
| Database | Drizzle ORM + PostgreSQL |
| Build | pnpm workspaces + TypeScript |
| Testing | Vitest + @effect/vitest |
| Deployment | Wrangler |

## Key Dependencies

- **effect** - Core functional effects runtime
- **@effect/platform** - HTTP server & middleware
- **@effect/rpc** - RPC protocol
- **@effect/sql-drizzle** - Database integration
- **drizzle-orm** - Type-safe ORM
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
