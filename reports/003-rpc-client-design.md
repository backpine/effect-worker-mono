# RPC Client Design Report

## Overview

This report explores design options for creating RPC client helpers in `@backpine/rpc` to reduce boilerplate when apps consume RPC services.

## Current Effect RPC Client Architecture

### How `@effect/rpc` Clients Work

The Effect RPC client system has these key components:

1. **Protocol Layer** - Handles transport (HTTP, WebSocket, Worker)
2. **Serialization Layer** - Handles encoding/decoding (NDJSON, MsgPack, JSON)
3. **RpcClient.make()** - Creates a scoped Effect that returns a typed client object
4. **Middleware** - Client-side middleware for headers, auth, etc.

### Standard Pattern (from Effect source)

```typescript
// 1. Define a client Tag
export class UsersClient extends Context.Tag("UsersClient")<
  UsersClient,
  RpcClient.RpcClient<RpcGroup.Rpcs<typeof UserRpcs>, RpcClientError>
>() {
  // 2. Define a layer that creates the client
  static layer = Layer.scoped(UsersClient, RpcClient.make(UserRpcs)).pipe(
    Layer.provide(AuthClient) // optional middleware
  )
}

// 3. Usage in tests or apps
const ClientLive = UsersClient.layer.pipe(
  Layer.provide(RpcClient.layerProtocolHttp({ url: "/rpc" })),
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(HttpClient.layer)
)
```

## Design Options

### Option A: Tag + Layer Factory (Recommended)

Create a client Tag in the package with a factory function for the layer.

**In `@backpine/rpc/src/clients/users.ts`:**

```typescript
import { Context, Effect, Layer } from "effect"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import { HttpClient, HttpClientRequest } from "@effect/platform"
import type { RpcClientError } from "@effect/rpc/RpcClientError"
import { UsersRpc } from "../procedures/users.js"

/**
 * Users RPC Client Tag.
 *
 * Provides typed access to the UsersRpc procedures.
 */
export class UsersRpcClient extends Context.Tag("@backpine/rpc/UsersRpcClient")<
  UsersRpcClient,
  RpcClient.RpcClient<typeof UsersRpc.Type, RpcClientError>
>() {
  /**
   * Create a client layer for the given base URL.
   *
   * @example
   * ```typescript
   * const ClientLive = UsersRpcClient.layerHttp("http://localhost:8787/rpc").pipe(
   *   Layer.provide(HttpClient.layer)
   * )
   *
   * Effect.gen(function* () {
   *   const client = yield* UsersRpcClient
   *   const user = yield* client.getUser({ id: "usr_1" })
   * }).pipe(Effect.provide(ClientLive))
   * ```
   */
  static layerHttp = (url: string) =>
    Layer.scoped(UsersRpcClient, RpcClient.make(UsersRpc)).pipe(
      Layer.provide(RpcClient.layerProtocolHttp({ url })),
      Layer.provide(RpcSerialization.layerNdjson)
    )

  /**
   * Create a raw layer without Protocol - for custom transport.
   */
  static layer = Layer.scoped(UsersRpcClient, RpcClient.make(UsersRpc))
}
```

**Usage in an app:**

```typescript
import { UsersRpcClient } from "@backpine/rpc"
import { HttpClient } from "@effect/platform"
import { Effect, Layer } from "effect"

// Simple: just provide URL
const ClientLive = UsersRpcClient.layerHttp("http://localhost:8787/rpc").pipe(
  Layer.provide(HttpClient.layer)
)

// Use the client
const program = Effect.gen(function* () {
  const client = yield* UsersRpcClient
  const user = yield* client.getUser({ id: "usr_1" })
  console.log(user)
})

Effect.runPromise(program.pipe(Effect.provide(ClientLive)))
```

**Pros:**
- Familiar Effect pattern
- Type-safe client access
- Flexible - can swap protocols
- Clean separation of concerns

**Cons:**
- Still requires HttpClient dependency
- Multiple layers to compose

---

### Option B: All-in-One Factory Function

Provide a function that returns everything needed.

**In `@backpine/rpc/src/clients/users.ts`:**

```typescript
import { Context, Effect, Layer, ManagedRuntime } from "effect"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import { HttpClient, FetchHttpClient } from "@effect/platform"
import type { RpcClientError } from "@effect/rpc/RpcClientError"
import { UsersRpc } from "../procedures/users.js"

/**
 * Create a UsersRpc client for the given URL.
 *
 * Returns a scoped Effect that yields the typed client.
 *
 * @example
 * ```typescript
 * const client = yield* makeUsersClient("http://localhost:8787/rpc")
 * const user = yield* client.getUser({ id: "usr_1" })
 * ```
 */
export const makeUsersClient = (url: string) =>
  RpcClient.make(UsersRpc).pipe(
    Effect.provide(RpcClient.layerProtocolHttp({ url })),
    Effect.provide(RpcSerialization.layerNdjson),
    Effect.provide(FetchHttpClient.layer)
  )

/**
 * Create a pre-configured runtime for UsersRpc.
 *
 * @example
 * ```typescript
 * const runtime = await makeUsersClientRuntime("http://localhost:8787/rpc")
 *
 * const result = await runtime.runPromise(
 *   Effect.gen(function* () {
 *     const client = yield* UsersRpcClient
 *     return yield* client.listUsers({})
 *   })
 * )
 * ```
 */
export const makeUsersClientRuntime = (url: string) => {
  const layer = UsersRpcClient.layerHttp(url).pipe(
    Layer.provide(FetchHttpClient.layer)
  )
  return ManagedRuntime.make(layer)
}
```

**Pros:**
- Minimal boilerplate for consumers
- Self-contained
- Good for simple use cases

**Cons:**
- Less flexible (bakes in FetchHttpClient)
- Harder to customize

---

### Option C: Native Effect Pattern (Minimal Helper)

Keep it close to raw Effect RPC, just re-export with convenience.

**In `@backpine/rpc/src/clients/index.ts`:**

```typescript
import { RpcClient, RpcSerialization } from "@effect/rpc"
import { UsersRpc } from "../procedures/users.js"

// Just re-export the RpcGroup for client creation
export { UsersRpc }

/**
 * HTTP protocol layer factory for convenience.
 */
export const usersProtocolHttp = (url: string) =>
  RpcClient.layerProtocolHttp({ url }).pipe(
    Layer.provide(RpcSerialization.layerNdjson)
  )
```

**Usage:**

```typescript
import { RpcClient } from "@effect/rpc"
import { UsersRpc, usersProtocolHttp } from "@backpine/rpc"

const client = RpcClient.make(UsersRpc).pipe(
  Effect.provide(usersProtocolHttp("http://localhost:8787/rpc")),
  Effect.provide(HttpClient.layer)
)
```

**Pros:**
- Maximum flexibility
- Native Effect patterns
- Easy to understand for Effect users

**Cons:**
- More boilerplate for consumers
- Less discoverable

---

## Recommendation: Option A + Option C Combined

The best approach combines both patterns:

### Package Structure

```
packages/rpc/src/
├── clients/
│   ├── UsersRpcClient.ts   # Tag + layerHttp factory (Option A)
│   └── index.ts            # Exports
├── middleware/
│   └── ...
├── procedures/
│   ├── users.ts
│   └── index.ts
└── index.ts
```

### Implementation

**`clients/UsersRpcClient.ts`:**

```typescript
import { Context, Effect, Layer } from "effect"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import type { RpcClientError } from "@effect/rpc/RpcClientError"
import type * as RpcGroup from "@effect/rpc/RpcGroup"
import { UsersRpc } from "../procedures/users.js"

/**
 * Users RPC Client.
 *
 * Provides typed access to user-related RPC procedures.
 */
export class UsersRpcClient extends Context.Tag("@backpine/rpc/UsersRpcClient")<
  UsersRpcClient,
  RpcClient.RpcClient<RpcGroup.Rpcs<typeof UsersRpc>, RpcClientError>
>() {
  /**
   * Create a client layer for HTTP transport.
   *
   * Requires `HttpClient` in the context.
   *
   * @param url - The RPC endpoint URL (e.g., "http://localhost:8787/rpc")
   *
   * @example
   * ```typescript
   * import { UsersRpcClient } from "@backpine/rpc"
   * import { FetchHttpClient } from "@effect/platform"
   *
   * const ClientLive = UsersRpcClient.layerHttp("http://localhost:8787/rpc").pipe(
   *   Layer.provide(FetchHttpClient.layer)
   * )
   *
   * const program = Effect.gen(function* () {
   *   const client = yield* UsersRpcClient
   *   const users = yield* client.listUsers({})
   *   return users
   * }).pipe(Effect.provide(ClientLive))
   * ```
   */
  static layerHttp = (url: string) =>
    Layer.scoped(UsersRpcClient, RpcClient.make(UsersRpc)).pipe(
      Layer.provide(RpcClient.layerProtocolHttp({ url })),
      Layer.provide(RpcSerialization.layerNdjson)
    )

  /**
   * Base layer without transport - for custom Protocol providers.
   *
   * Use this when you need WebSocket, Worker, or custom transport.
   */
  static layer = Layer.scoped(UsersRpcClient, RpcClient.make(UsersRpc))
}
```

**`clients/index.ts`:**

```typescript
export { UsersRpcClient } from "./UsersRpcClient.js"
```

**Main `index.ts` update:**

```typescript
// ... existing exports ...

// Clients
export { UsersRpcClient } from "./clients/index.js"
```

### Usage Examples

**Simple HTTP usage:**

```typescript
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "@effect/platform"
import { UsersRpcClient } from "@backpine/rpc"

const ClientLive = UsersRpcClient.layerHttp("http://localhost:8787/rpc").pipe(
  Layer.provide(FetchHttpClient.layer)
)

const program = Effect.gen(function* () {
  const client = yield* UsersRpcClient

  // All methods are fully typed
  const users = yield* client.listUsers({})
  const user = yield* client.getUser({ id: "usr_1" })
  const newUser = yield* client.createUser({ email: "test@example.com", name: "Test" })

  return { users, user, newUser }
}).pipe(Effect.scoped)

Effect.runPromise(program.pipe(Effect.provide(ClientLive)))
```

**Custom transport (WebSocket):**

```typescript
import { Effect, Layer } from "effect"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import { NodeSocket } from "@effect/platform-node"
import { UsersRpcClient } from "@backpine/rpc"

const ClientLive = UsersRpcClient.layer.pipe(
  Layer.provide(RpcClient.layerProtocolSocket()),
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(NodeSocket.layerWebSocket("ws://localhost:8787/rpc"))
)
```

**In a Cloudflare Worker (calling another worker):**

```typescript
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "@effect/platform"
import { UsersRpcClient } from "@backpine/rpc"

export default {
  async fetch(request: Request, env: Env) {
    const ClientLive = UsersRpcClient.layerHttp(env.USER_SERVICE_URL).pipe(
      Layer.provide(FetchHttpClient.layer)
    )

    const result = await Effect.gen(function* () {
      const client = yield* UsersRpcClient
      return yield* client.getUser({ id: "usr_1" })
    }).pipe(
      Effect.provide(ClientLive),
      Effect.scoped,
      Effect.runPromise
    )

    return Response.json(result)
  }
}
```

## Additional Considerations

### 1. Error Handling

The client errors are typed as `RpcClientError` which includes:
- Transport errors (network failures)
- Protocol errors (serialization issues)
- Server-defined errors (from the RPC procedures)

```typescript
const result = yield* client.getUser({ id: "usr_1" }).pipe(
  Effect.catchTag("UserNotFound", (e) => Effect.succeed(null)),
  Effect.catchTag("RpcClientError", (e) => {
    console.error("RPC failed:", e.message)
    return Effect.fail(e)
  })
)
```

### 2. Headers and Context

Use `RpcClient.withHeaders` to add request headers:

```typescript
import { RpcClient } from "@effect/rpc"

yield* client.getUser({ id: "usr_1" }).pipe(
  RpcClient.withHeaders({ Authorization: `Bearer ${token}` })
)
```

### 3. Testing

For testing, use `RpcTest.makeClient` which creates an in-memory client:

```typescript
import { RpcTest } from "@effect/rpc"

const TestClientLive = Layer.scoped(
  UsersRpcClient,
  RpcTest.makeClient(UsersRpc)
).pipe(
  Layer.provide(UsersRpcHandlersLive),
  Layer.provide(MockMiddlewareLive)
)
```

## Conclusion

The recommended approach (Option A) provides:

1. **Type Safety** - Full TypeScript inference for all RPC methods
2. **Flexibility** - Easy to swap transports (HTTP, WebSocket, Worker)
3. **Familiarity** - Uses standard Effect patterns
4. **Minimal Boilerplate** - One import, one layer composition
5. **Testability** - Easy to mock with RpcTest

The client package structure keeps procedures, middleware, and clients organized while maintaining a clean public API.
