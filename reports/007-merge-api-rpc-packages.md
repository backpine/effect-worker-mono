# Merging API and RPC Packages

## Current State

### @backpine/api
```
src/
├── index.ts
├── worker-api.ts           # HttpApi definition
├── middleware/
│   ├── index.ts
│   ├── cloudflare-bindings.ts  # HttpApiMiddleware.Tag
│   └── database.ts             # HttpApiMiddleware.Tag
└── groups/
    ├── index.ts
    ├── health.ts           # HttpApiGroup
    └── users.ts            # HttpApiGroup
```

### @backpine/rpc
```
src/
├── index.ts
├── middleware/
│   ├── index.ts
│   ├── cloudflare-bindings.ts  # RpcMiddleware.Tag
│   └── database.ts             # RpcMiddleware.Tag
└── procedures/
    ├── index.ts
    └── users.ts            # Rpc.make + RpcGroup
```

## Analysis

### Similarities
| Aspect | API | RPC |
|--------|-----|-----|
| CloudflareBindings middleware | `HttpApiMiddleware.Tag` | `RpcMiddleware.Tag` |
| Database middleware | `HttpApiMiddleware.Tag` | `RpcMiddleware.Tag` |
| User operations | list, get, create | listUsers, getUser, createUser |
| Dependencies | cloudflare, domain | cloudflare, domain |
| Purpose | API contract definitions | API contract definitions |

### Differences
| Aspect | API | RPC |
|--------|-----|-----|
| Effect library | `@effect/platform` | `@effect/rpc` |
| Endpoint pattern | `HttpApiEndpoint` | `Rpc.make` |
| Grouping | `HttpApiGroup` | `RpcGroup` |
| Middleware base | `HttpApiMiddleware.Tag` | `RpcMiddleware.Tag` |

### Key Insight

Both packages define **API contracts** - they specify what operations are available, what inputs they take, and what outputs they produce. Neither contains implementations. The only difference is the transport mechanism (HTTP REST vs RPC).

## Proposed Merged Structure

```
packages/contracts/src/
├── index.ts                    # Main entry - exports both
├── http/
│   ├── index.ts                # HTTP-specific exports
│   ├── api.ts                  # WorkerApi (HttpApi)
│   ├── middleware/
│   │   ├── index.ts
│   │   ├── cloudflare.ts       # CloudflareBindingsMiddleware
│   │   └── database.ts         # DatabaseMiddleware
│   └── groups/
│       ├── index.ts
│       ├── health.ts           # HealthGroup
│       └── users.ts            # UsersGroup
└── rpc/
    ├── index.ts                # RPC-specific exports
    ├── middleware/
    │   ├── index.ts
    │   ├── cloudflare.ts       # RpcCloudflareMiddleware
    │   └── database.ts         # RpcDatabaseMiddleware
    └── procedures/
        ├── index.ts
        └── users.ts            # getUser, listUsers, createUser, UsersRpc
```

## Export Strategy

```typescript
// packages/contracts/src/index.ts
export * from "./http"
export * from "./rpc"

// packages/contracts/src/http/index.ts
export { WorkerApi } from "./api"
export * from "./groups"
export * from "./middleware"

// packages/contracts/src/rpc/index.ts
export * from "./middleware"
export * from "./procedures"
```

### Subpath Exports

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./http": "./dist/http/index.js",
    "./rpc": "./dist/rpc/index.js"
  }
}
```

Usage:
```typescript
// Import everything
import { WorkerApi, UsersRpc } from "@backpine/contracts"

// Import specific protocol
import { WorkerApi } from "@backpine/contracts/http"
import { UsersRpc } from "@backpine/contracts/rpc"
```

## Package Name Options

| Name | Pros | Cons |
|------|------|------|
| `@backpine/contracts` | Clear purpose, industry term | Slightly longer |
| `@backpine/api` | Short, familiar | Might imply HTTP-only |
| `@backpine/endpoints` | Descriptive | Less common term |
| `@backpine/protocol` | Technical, covers both | Abstract |
| `@backpine/spec` | Short, OpenAPI vibes | Too generic |

**Recommendation: `@backpine/contracts`**

Rationale:
- Clearly communicates purpose (API contracts, not implementations)
- Neutral between HTTP and RPC
- Common industry terminology
- Pairs well with future packages like `@backpine/client`

## Migration Steps

1. Create `packages/contracts/` with new structure
2. Move files preserving git history:
   - `api/src/worker-api.ts` → `contracts/src/http/api.ts`
   - `api/src/middleware/*` → `contracts/src/http/middleware/*`
   - `api/src/groups/*` → `contracts/src/http/groups/*`
   - `rpc/src/middleware/*` → `contracts/src/rpc/middleware/*`
   - `rpc/src/procedures/*` → `contracts/src/rpc/procedures/*`
3. Create new index files with proper exports
4. Update `package.json` with combined dependencies
5. Update apps to import from `@backpine/contracts`
6. Remove old `api/` and `rpc/` packages
7. Update root `tsconfig.json` paths

## Updated Dependencies

```json
{
  "name": "@backpine/contracts",
  "dependencies": {
    "@effect/platform": "latest",
    "@effect/rpc": "latest",
    "@backpine/cloudflare": "workspace:^",
    "@backpine/domain": "workspace:^",
    "effect": "latest"
  }
}
```

## Impact on Apps

### Before
```typescript
import { WorkerApi, DatabaseMiddleware } from "@backpine/api"
import { UsersRpc, RpcDatabaseMiddleware } from "@backpine/rpc"
```

### After
```typescript
import {
  WorkerApi,
  DatabaseMiddleware,
  UsersRpc,
  RpcDatabaseMiddleware
} from "@backpine/contracts"

// Or with subpaths
import { WorkerApi, DatabaseMiddleware } from "@backpine/contracts/http"
import { UsersRpc, RpcDatabaseMiddleware } from "@backpine/contracts/rpc"
```

## Benefits

1. **Single source of truth** for API definitions
2. **Clearer organization** - HTTP vs RPC is explicit in paths
3. **Easier maintenance** - one package to update
4. **Better discoverability** - all contracts in one place
5. **Simpler dependency graph** - apps depend on one contracts package
