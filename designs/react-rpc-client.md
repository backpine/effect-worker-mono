# React App RPC Client Design

## Goal

Wire up `apps/react-app` to call `apps/effect-worker-rpc` via Effect v4's RPC client, with TanStack Query managing all data fetching state (caching, refetching, loading/error states).

## Current State

**Server** (`apps/effect-worker-rpc`):
- HTTP RPC at path `/rpc` with ndjson serialization
- `UsersRpc` group: `getUser`, `listUsers`, `createUser`
- Both middlewares (`RpcDatabaseMiddleware`, `RpcCloudflareMiddleware`) have `requiredForClient: false`

**Shared contracts** (`@repo/contracts`):
- `UsersRpc` group definition with schemas for payloads, success types, and errors
- Schemas: `UserRpcSchema`, `UsersListRpcSchema`, error schemas
- All importable from `@repo/contracts`

**React app** (`apps/react-app`):
- TanStack Router + TanStack Query already configured
- `QueryClient` passed into router context (available in route loaders)

---

## Approach: Effect RPC Client + TanStack Query Bridge

Use Effect's typed RPC client for the transport layer and schema validation, then bridge into TanStack Query via a thin `runPromise` wrapper. This gives us:

- Full type safety from shared contracts (payloads, responses, errors)
- Proper ndjson protocol handling (matching the server)
- Schema validation on responses
- TanStack Query handles caching, refetching, loading/error UI state

### Why not raw fetch?

The RPC server uses Effect's ndjson-framed protocol, not plain JSON REST. A raw fetch client would need to manually handle:
- ndjson framing and parsing
- Request ID generation and correlation
- Schema encoding/decoding (e.g., `DateTimeUtc`)
- Error type discrimination

Effect's `RpcClient` handles all of this out of the box and gives us full type inference from the shared `UsersRpc` group.

---

## Architecture

```
React Component
    ↓ useQuery / useMutation
TanStack Query
    ↓ queryFn / mutationFn
RPC Hook (runs Effect → Promise)
    ↓
Effect RpcClient (typed, schema-validated)
    ↓ HTTP POST + ndjson
effect-worker-rpc (Cloudflare Worker)
```

---

## Implementation Plan

### 1. Add dependencies to `apps/react-app`

```json
{
  "dependencies": {
    "effect": "catalog:",
    "@repo/contracts": "workspace:*"
  }
}
```

The `effect` package includes the RPC client, HTTP client, and serialization at `effect/unstable/rpc` and `effect/unstable/http`. No additional Effect packages needed.

### 2. Create the RPC client module

**`src/rpc/client.ts`** — Bootstraps the Effect RPC client as a singleton.

```typescript
import { Effect, Layer, ManagedRuntime } from "effect"
import { RpcClient, RpcSerialization } from "effect/unstable/rpc"
import { HttpClient } from "effect/unstable/http"
import { UsersRpc } from "@repo/contracts"

// Layer composition: RPC client with HTTP transport + ndjson
const UsersClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    return RpcClient.make(UsersRpc)
  })
).pipe(
  Layer.provide(
    RpcClient.layerProtocolHttp({
      url: import.meta.env.VITE_RPC_URL ?? "/rpc"
    })
  ),
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(HttpClient.layer)
)

// ManagedRuntime for running Effects as Promises in the browser
const runtime = ManagedRuntime.make(UsersClientLive)

// Export a function that gets the typed client and runs an RPC call
export const rpcClient = () =>
  runtime.runPromise(
    RpcClient.make(UsersRpc)
  )
```

However, creating the client per-call is wasteful. Better pattern — expose individual call functions:

```typescript
import { Effect, Layer, ManagedRuntime } from "effect"
import { RpcClient, RpcSerialization } from "effect/unstable/rpc"
import { HttpClient } from "effect/unstable/http"
import { UsersRpc } from "@repo/contracts"

const RpcLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    // Client is created once and cached by the runtime
  })
).pipe(
  Layer.provideMerge(
    RpcClient.layerProtocolHttp({
      url: import.meta.env.VITE_RPC_URL ?? "/rpc"
    })
  ),
  Layer.provideMerge(RpcSerialization.layerNdjson),
  Layer.provideMerge(HttpClient.layer)
)

const runtime = ManagedRuntime.make(RpcLive)

// Run any Effect that needs the RPC client
export function runRpc<A, E>(
  effect: Effect.Effect<A, E, RpcClient.Protocol>
): Promise<A> {
  return runtime.runPromise(effect) as Promise<A>
}
```

**Simpler recommended pattern** — just create the client once and expose call functions:

```typescript
import { Effect, Layer, ManagedRuntime } from "effect"
import { RpcClient, RpcSerialization } from "effect/unstable/rpc"
import { HttpClient } from "effect/unstable/http"
import { UsersRpc } from "@repo/contracts"

// Build the full layer
const RpcClientLive = RpcClient.layerProtocolHttp({
  url: import.meta.env.VITE_RPC_URL ?? "/rpc"
}).pipe(
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(HttpClient.layer)
)

// ManagedRuntime that provides the Protocol layer
const runtime = ManagedRuntime.make(RpcClientLive)

// Create a reusable client Effect
const makeClient = RpcClient.make(UsersRpc)

// Helper: run an RPC call as a Promise
export function rpc<A, E>(
  fn: (client: RpcClient.RpcClient<typeof UsersRpc.Rpcs>) => Effect.Effect<A, E>
): Promise<A> {
  return runtime.runPromise(
    Effect.gen(function* () {
      const client = yield* makeClient
      return yield* fn(client)
    })
  )
}
```

### 3. Create TanStack Query hooks

**`src/rpc/hooks.ts`** — Typed hooks wrapping RPC calls in TanStack Query.

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { rpc } from "./client"

// Query keys
export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
}

// Queries
export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: () => rpc((client) => client.listUsers()),
  })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => rpc((client) => client.getUser({ id })),
    enabled: !!id,
  })
}

// Mutations
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { email: string; name: string }) =>
      rpc((client) => client.createUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}
```

### 4. Use in route components

```typescript
import { createFileRoute } from "@tanstack/react-router"
import { useUsers, useCreateUser } from "@/rpc/hooks"

export const Route = createFileRoute("/users")({
  component: UsersPage,
})

function UsersPage() {
  const { data, isLoading, error } = useUsers()
  const createUser = useCreateUser()

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h1>Users ({data?.total})</h1>
      <ul>
        {data?.users.map((user) => (
          <li key={user.id}>{user.name} ({user.email})</li>
        ))}
      </ul>
      <button onClick={() => createUser.mutate({ email: "new@example.com", name: "New User" })}>
        Add User
      </button>
    </div>
  )
}
```

### 5. Route loader prefetching (optional)

Since `queryClient` is in the router context, routes can prefetch data:

```typescript
export const Route = createFileRoute("/users")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: userKeys.list(),
      queryFn: () => rpc((client) => client.listUsers()),
    }),
  component: UsersPage,
})
```

---

## File Structure

```
apps/react-app/src/
  rpc/
    client.ts          # Effect RPC client setup, ManagedRuntime, rpc() helper
    hooks.ts           # TanStack Query hooks (useUsers, useUser, useCreateUser)
    keys.ts            # Query key factories
    index.ts           # Re-exports
  routes/
    users.tsx          # Users list page
    users.$userId.tsx  # User detail page
  ...
```

---

## Configuration

### Environment variable

The RPC URL defaults to `/rpc` (same-origin, handled by the worker). For local dev pointing at the separate RPC worker:

```env
VITE_RPC_URL=http://localhost:8787/rpc
```

### CORS

If `react-app` and `effect-worker-rpc` are on different origins in production, the RPC worker needs CORS headers. For same-origin deployment (both behind one Cloudflare Worker or using Service Bindings), this isn't needed.

For local dev with separate ports, add CORS to the RPC worker's fetch handler:

```typescript
// In effect-worker-rpc/src/index.ts
if (request.method === "OPTIONS") {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  })
}
// ... existing handler, plus Access-Control-Allow-Origin on responses
```

---

## Error Handling

Effect RPC errors are typed via the contract schemas. When an RPC call fails:

1. **RPC domain errors** (e.g., `UserNotFound`, `DuplicateEmail`) — these are the `E` in `Effect<A, E>`. They'll reject the Promise and appear in TanStack Query's `error` field.

2. **Transport errors** (`RpcClientError`) — HTTP failures, network issues, ndjson parse errors. Also surface via TanStack Query's `error`.

For better UX, the `rpc()` helper can be extended to normalize errors:

```typescript
export function rpc<A, E>(
  fn: (client: RpcClient.RpcClient<...>) => Effect.Effect<A, E>
): Promise<A> {
  return runtime.runPromise(
    Effect.gen(function* () {
      const client = yield* makeClient
      return yield* fn(client)
    })
  )
  // Errors propagate naturally — TanStack Query catches rejected promises
}
```

Components can then pattern-match on error `_tag`:

```typescript
if (error && "_tag" in error) {
  switch (error._tag) {
    case "UserNotFound": return <div>User not found</div>
    case "DuplicateEmail": return <div>Email already taken</div>
  }
}
```

---

## Bundle Size Considerations

Effect v4 is tree-shakeable. The browser bundle will include:
- `effect` core (Schema, Effect, Layer, ManagedRuntime)
- `effect/unstable/rpc` (RpcClient, RpcSerialization)
- `effect/unstable/http` (HttpClient — uses native fetch)

The server-only modules (`PgDrizzle`, `@repo/db`, `@repo/cloudflare`) are NOT imported by the client. The client only imports `@repo/contracts` which contains schema definitions.

Estimated addition: ~40-60KB gzipped for Effect core + RPC client + HTTP client. This is reasonable given the type safety and protocol correctness it provides.

---

## Summary

| Concern | Solution |
|---------|----------|
| Transport | Effect `RpcClient.layerProtocolHttp` (fetch-based) |
| Serialization | ndjson (matches server) |
| Type safety | Shared `UsersRpc` group from `@repo/contracts` |
| Schema validation | Automatic via Effect RPC client |
| Data fetching state | TanStack Query (`useQuery`, `useMutation`) |
| Caching | TanStack Query (hierarchical query keys) |
| Prefetching | Route loaders via `queryClient.ensureQueryData` |
| Runtime | `ManagedRuntime` singleton in browser |
| Error handling | Typed errors flow through to TanStack Query's `error` |
