# Design: request‑scoped Postgres (Drizzle over Hyperdrive), provided via middleware

**Status:** implemented · **Scope:** `effect-worker-api` (HTTP) and the RPC worker (`apps/react-app/worker`).

> **Thesis.** On Cloudflare, the Postgres connection must be opened **per request**, never globally — a socket opened at isolate startup throws ("I/O outside a request"). We make the database a **service provided by middleware**, built inside the request `Scope`, and let Effect v4's type system make it impossible to ship a DB‑using route without wiring that connection. We are **deleting the custom `pg-drizzle` bridge** and standing the database service back up on the **official `drizzle-orm/effect-postgres`** client, fed by the **`@repo/cloudflare`** binding accessor.

---

## 1. What we're changing and why

Three moving parts, and what each becomes:

| Concern | Today (the "middle ground" — delete it) | New |
|---|---|---|
| Drizzle↔Effect client | custom `packages/db/src/pg-drizzle/` (`index.ts` + `patch.ts` + `tag.ts`, ~180 lines) routing `drizzle-orm/pg-proxy` → Effect `SqlClient.unsafe`, on `drizzle-orm@0.45` | **`drizzle-orm/effect-postgres`** (official, v4‑native; `drizzle-orm@1.0.0-rc.x`) — native `Effect.Effect<…>` queries on `@effect/sql-pg` `PgClient` |
| Cloudflare env / connection string | one‑off `Bindings` `Context.Service` threaded per request | **`@repo/cloudflare`** — `CloudflareEnv` (a `Context.Reference`, default reads `cloudflare:workers` `env`) + `hyperdrive(e => e.HYPERDRIVE)` accessor (already built) |
| Where the connection is built | request‑scoped middleware (correct — keep this) | request‑scoped middleware (unchanged shape, simpler impl) |

Why delete the custom bridge: it only ever existed because `@effect/sql-drizzle` was removed in v4. The official integration is the first‑party replacement, purpose‑built for v4 beta and verified against our exact `effect@4.0.0-beta.70` (see `drizzle-effect-postgres-v4-findings.md`). It also gives us a typed query builder, relations, codecs, and a migrator we don't maintain — and likely **fixes the `POST /api/users` → `UserCreationError`** we currently hit (the failing `.returning()` insert goes through the custom `pg-proxy` `execute` path; the native client builds inserts properly). See §7.

> The custom bridge contains the only `as`-casts left in the DB layer (`as any[]`, `as Promise<…>`, `as Layer.Layer<PgDrizzle>` in `pg-drizzle/index.ts`). Deleting it removes them; the new design adds **zero** casts.

---

## 2. The constraint (and why the obvious thing fails)

The Hyperdrive connection string is only on the request `env` binding, and a socket opened during module evaluation or eager `Layer` build **fails** in the Workers runtime — outbound connections are only allowed within a `fetch` invocation.

```ts
// ❌ ANTI-PATTERN on Cloudflare — connects at startup, throws in the Worker.
const PgLive = PgClient.layer({ url: Redacted.make(CONNECTION_STRING) })
const DbLive = DrizzleLive.pipe(Layer.provide(PgLive))   // built once, at boot 💥
```

The connection string isn't even known at boot. Both facts force the same answer: **defer the connection into the request `Scope`.** The vehicle for "provide a service, scoped to the request, only for routes that need it" is **middleware**.

---

## 3. The mechanism — how Effect v4 makes this type‑safe (verified against beta.70)

This is the part the whole design hangs on. Confirmed in the vendored source `repos/effect/packages/effect/src/unstable/httpapi/HttpApiMiddleware.ts` (RPC is identical in `…/rpc/RpcMiddleware.ts`):

**a) A middleware declares the services it `provides`.** The middleware *function* type is:

```ts
// HttpApiMiddleware.ts:78
export type HttpApiMiddleware<Provides, E, Requires> = (
  httpEffect: Effect.Effect<HttpServerResponse, unhandled, Provides>,   // ← downstream STILL requires `Provides`
  options: { … },
) => Effect.Effect<HttpServerResponse, unhandled | …E…, Requires | HttpRouter.Provided>
```

The wrapper receives the downstream effect *which still requires `Provides`* and must satisfy it (by `Effect.provideService`). Its own result may require `Requires` plus whatever `HttpRouter.Provided` already grants.

**b) Attaching the middleware type‑subtracts `Provides` from the handler's `R`:**

```ts
// HttpApiMiddleware.ts:197, 205, 213
export type Provides<A>        = A extends { [TypeId]: { provides: infer P } } ? P : never
export type Requires<A>        = A extends { [TypeId]: { requires: infer R } } ? R : never
export type ApplyServices<A,R> = Exclude<R, Provides<A>> | Requires<A>
```

`.middleware(Mw)` rewrites the group/endpoint requirement to `ApplyServices<Mw, R>` (`HttpApiEndpoint.ts:145/918`). So:

- A handler that does `yield* Database` contributes `Database` to `R`.
- **With** `.middleware(DatabaseMiddleware)` (which `provides: Database`), `Database` is `Exclude`d → the group builds with `R = never`.
- **Without** it, `Database` stays in `R`, and `HttpApiBuilder.layer` / `RpcServer.toHttpEffect` reports a **leftover requirement — a compile error.**

> This is the "type issue until you provide it" the goal calls for: it's a type‑level phantom (`Exclude<R, Provides>`); the *value* is supplied at runtime by the middleware impl. Two halves of one tag.

**c) The middleware gets the request `Scope` for free.** `HttpRouter.Provided` (`HttpRouter.ts:794`) is:

```ts
export type Provided = HttpServerRequest.HttpServerRequest | Scope.Scope | HttpServerRequest.ParsedSearchParams | RouteContext
```

It includes **`Scope.Scope`** — the per‑request scope created by `Effect.scoped` at the entry. That is precisely where the connection must live, so the middleware can build a scoped `PgClient` and it is torn down when the request ends. No `requires` declaration or extra threading needed.

---

## 4. The new stack, layer by layer

### 4a. The DB service tag — `@repo/db` (type‑only safe to import anywhere)

Replace `pg-drizzle/tag.ts`. The tag's shape is the official client's database type:

```ts
// packages/db/src/database.ts
import { Context } from "effect"
import type * as DrizzlePg from "drizzle-orm/effect-postgres"

// EffectPgDatabase is what `DrizzlePg.make()` yields (sans the $client field we don't expose)
export class Database extends Context.Service<
  Database,
  DrizzlePg.EffectPgDatabase
>()("@repo/db/Database") {}
```

Keeping it in a lightweight module (no driver imports beyond a `type`) lets `@repo/contracts` reference the tag without pulling Node/pg into other bundles — same discipline we have today.

### 4b. The request‑scoped connection factory — `@repo/db`

```ts
// packages/db/src/connect.ts
import { Effect, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
import * as DrizzlePg from "drizzle-orm/effect-postgres"

/**
 * Builds the Drizzle database for one request. Requires `Scope` — the socket
 * opens against the caller's scope (the request scope) and closes with it.
 * NOTHING here runs at module load.
 */
export const connect = (connectionString: string) =>
  DrizzlePg.makeWithDefaults().pipe(
    Effect.provide(PgClient.layer({ url: Redacted.make(connectionString) })),
  )
// : Effect<EffectPgDatabase, SqlError, Scope>
```

`makeWithDefaults()` needs only `PgClient`; `PgClient.layer` is a **scoped** layer (opens/closes the pool against the ambient `Scope`). Providing it leaves `Scope` as the only requirement — satisfied by the request scope from §3c.

### 4c. Queries require the tag — they never connect (`@repo/db`)

Unchanged in spirit; only the tag import changes (`Database` instead of `PgDrizzle`). With the native client, `db.select().from(users)` already returns an `Effect`:

```ts
// packages/db/src/queries/users.ts
export const findAllUsers: Effect.Effect<User[], never, Database> =
  Effect.gen(function* () {
    const db = yield* Database                      // ← contributes Database to R
    const rows = yield* db.select().from(users)
    return rows.map(toDomainUser)
  })
```

### 4d. Middleware **contract** — `provides: Database` (`@repo/contracts`)

```ts
// packages/contracts/src/http/middleware/database.ts
export class DatabaseMiddleware extends HttpApiMiddleware.Service<
  DatabaseMiddleware,
  { provides: Database }
>()("@repo/api/DatabaseMiddleware", {
  error: DatabaseConnectionError,    // connection failures are a typed error class
}) {}
```

### 4e. Middleware **implementation** — request‑scoped, via `@repo/cloudflare` (`apps/*`)

Because `CloudflareEnv` is a `Context.Reference` (reading it adds nothing to `R`) and `Scope` comes from `HttpRouter.Provided`, the impl is a plain `Layer.succeed` — no `Layer.effect`‑read‑at‑build trick, no `Bindings` service:

```ts
// apps/effect-worker-api/src/services/database.ts
export const DatabaseMiddlewareLive = Layer.succeed(
  DatabaseMiddleware,
  (httpEffect) =>
    Effect.gen(function* () {
      const { connectionString } = yield* hyperdrive((e) => e.HYPERDRIVE)  // @repo/cloudflare
      const db = yield* connect(connectionString).pipe(
        // ONLY the connect step maps to DatabaseConnectionError; handler errors propagate
        Effect.catch(() =>
          Effect.fail(new DatabaseConnectionError({ message: "Database connection failed" })),
        ),
      )
      return yield* httpEffect.pipe(Effect.provideService(Database, db))
    }),
)
```

### 4f. The group **attaches** the middleware (`@repo/contracts`)

```ts
// packages/contracts/src/http/groups/users.ts
export const UsersGroup = HttpApiGroup.make("users")
  .add(/* list / get / create … */)
  .middleware(DatabaseMiddleware)     // ← subtracts Database from every handler's R
  .prefix("/users")
```

### 4g. The entry — unchanged from the current `@repo/cloudflare` wiring

No `Bindings` to thread — `CloudflareEnv` defaults to `cloudflare:workers` `env`. The entry already runs the app in a request `Scope`:

```ts
// apps/effect-worker-api/src/index.ts  (already in this shape)
apiApp.pipe(                                   // apiApp = HttpRouter.toHttpEffect(ApiLayer)
  Effect.flatten,
  Effect.provideService(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(request)),
  Effect.scoped,                               // ← the request Scope that owns the connection
  Effect.map(HttpServerResponse.toWeb),
)
```

`ApiLayer` provides `DatabaseMiddlewareLive`. `toHttpEffect` builds it **when run**, inside the request scope — nothing connects at module load.

---

## 5. Connection lifecycle (why it's correct, not just compiling)

1. **Module load:** layers are *described*. `PgClient.layer(...)` is a value; no socket. ✅
2. **Request arrives:** `Effect.scoped` opens the **request `Scope`**; `CloudflareEnv` resolves the `env`.
3. **App runs:** `toHttpEffect` builds `ApiLayer` now; the DB middleware reads the Hyperdrive string and `connect()` builds `PgClient.layer` against the **request scope** → socket opens. ✅
4. **Handler runs:** `yield* Database` → the request‑scoped Drizzle handle; queries execute.
5. **Request ends:** scope closes → `PgClient` finalizer → socket closes. No cross‑request/isolate leakage. ✅

**The invariant:** *the connection's `Scope` is the request's `Scope`.* That is exactly what a root `Layer.provideMerge` cannot give on Cloudflare.

---

## 6. The migration (this is a real spike, not a swap)

Adopting `drizzle-orm/effect-postgres` means **`drizzle-orm` `0.45` → `1.0.0-rc.x`** — a major version with its own breaking changes independent of Effect (RQB / relations‑v2 rewrite, codecs, casing). Plan for it:

1. **Bump** `drizzle-orm` → `1.0.0-rc.x` and `drizzle-kit` → matching `1.0` line (we're on `0.31.8`).
2. **Schema** (`packages/db/src/schema.ts`): re‑verify `pgTable`/column builders compile under 1.0; adjust if the builder API changed.
3. **Queries** (`packages/db/src/queries/users.ts`): swap the `PgDrizzle` tag for `Database`; confirm `select/insert/.returning()/where(eq(...))` shapes under 1.0. Drop the `Effect.orElseSucceed(() => [])` band‑aids if the native client's error typing makes them unnecessary.
4. **Delete** `packages/db/src/pg-drizzle/` entirely and its barrel re‑exports in `packages/db/src/index.ts`; export `Database` + `connect` instead.
5. **Postgres type parsing:** `effect-postgres` ships `effectPgCodecs`; configure `PgClient.layer({ types: … })` to defer date/timestamp/numeric/array parsing to Drizzle (per the integration docs) so query results match the schema's inferred types.
6. **`skipLibCheck: true`** stays on (already is) — unrelated Drizzle dialect `.d.ts` issues otherwise leak (documented in the findings doc).

### Risks / open questions

- **Hyperdrive over the official query path.** Our custom bridge already proves `@effect/sql-pg` `PgClient` works over Hyperdrive in the Worker (it builds `PgClient.layer` per request and `GET /api/users` returns rows). The official integration uses the **same** `PgClient` socket, but its query path is the full `PgSession` (prepared statements) rather than our `client.unsafe(sql, params)`. **Validate one real query + one insert over Hyperdrive in `wrangler dev`** before committing — low risk (Hyperdrive proxies the PG wire protocol), but it's the one thing not yet proven.
- **Pre‑release frontier:** both `effect@4.0.0-beta.70` and `drizzle-orm@1.0.0-rc.x` are betas/RCs. Peer range is broad (`effect: >=4.0.0-beta.58`) but pin deliberately.
- **Per‑request connection cost:** one connection per request is the point; Hyperdrive pooling makes it acceptable. Confirm we're reusing the pool and measure cold vs warm.

---

## 7. Likely bonus: fixes the `POST /api/users` bug

`POST /api/users` currently returns `UserCreationError` — the `.returning()` insert fails inside the custom `pg-proxy` `execute` path (which maps `method: "execute"` to `{ rows: [result] }` and runs `Effect.runPromise` inline). The native `drizzle-orm/effect-postgres` builds inserts/`RETURNING` against `PgSession` directly. Re‑test `POST` after migration; this is a good acceptance check that the new client is wired correctly (not just `GET`).

---

## 8. RPC parity (same pattern, RPC types)

The RPC worker (`apps/react-app/worker`) currently has in‑memory handlers and no DB. To give it the same request‑scoped DB:

- `RpcMiddleware.Service<Self, { provides: Database }>()(id, { error: <Schema> })` — note RPC errors are **`Schema`s** (serialized to the client), so add a `DatabaseConnectionError` *schema* in `@repo/domain`.
- `UsersRpc.middleware(DatabaseRpcMiddleware)` subtracts `Database` from every procedure's `R` (`RpcGroup.toLayer` checks each handler's requirements).
- Impl mirrors §4e (`(effect) => …provideService(Database, db)`), reading `hyperdrive(...)` from `@repo/cloudflare`.
- The RPC entry must run in a `Scope` (`Effect.scoped`) just like HTTP.
- Point RPC handlers at the **same** `@repo/db` query programs as HTTP — one source of truth.

`ApplyServices` is identical for `RpcMiddleware`; only the error‑as‑Schema and the wrapper arg shape (`(effect, { rpc, payload, headers })`) differ.

---

## 9. Delete list & adoption checklist

**Delete:**
- [ ] `packages/db/src/pg-drizzle/` (`index.ts`, `patch.ts`, `tag.ts`) + its re‑exports in `packages/db/src/index.ts`.
- [ ] Any remaining `PgDrizzle` imports (queries, contracts middleware, app middleware) → `Database`.

**Build the new path (HTTP first):**
- [ ] `drizzle-orm@1.0.0-rc.x` + matching `drizzle-kit`; reconcile schema + queries.
- [ ] `@repo/db`: `database.ts` (the `Database` tag) + `connect.ts` (request‑scoped factory) + updated barrel.
- [ ] `@repo/contracts`: `DatabaseMiddleware { provides: Database }` (already exists — retarget the tag).
- [ ] `apps/effect-worker-api`: `DatabaseMiddlewareLive` via `Layer.succeed` reading `@repo/cloudflare`'s `hyperdrive(...)`.
- [ ] `UsersGroup.middleware(DatabaseMiddleware)` (already attached).
- [ ] Configure `PgClient.layer({ types })` for Drizzle‑owned codecs.
- [ ] Validate in `wrangler dev`: `GET /api/users` **and** `POST /api/users` over Hyperdrive.

**Then RPC (§8).**

---

## 10. Reference index

- Middleware mechanism (verified): `repos/effect/packages/effect/src/unstable/httpapi/HttpApiMiddleware.ts` (`Provides`/`Requires`/`ApplyServices` @ 197/205/213), `HttpApiEndpoint.ts` (@ 145/918), `HttpRouter.ts` (`Provided` incl. `Scope` @ 794); RPC: `…/unstable/rpc/RpcMiddleware.ts`.
- New client: `drizzle-orm/effect-postgres` — `make` / `makeWithDefaults` / `DefaultServices` / `effectPgCodecs` (see `drizzle-effect-postgres-v4-findings.md`).
- Binding access: `@repo/cloudflare` (`CloudflareEnv`, `hyperdrive`) — `designs/effectful-cloudflare-bindings.md`.
- Implementation: `packages/db/src/{connect,database}.ts`, `apps/effect-worker-api/src/services/middleware.ts`, `apps/react-app/worker/middleware.ts`.
