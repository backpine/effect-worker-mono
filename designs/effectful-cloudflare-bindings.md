# Effectful, type-safe Cloudflare bindings (an Alchemy-inspired pattern, without Alchemy)

**Status:** design / proposal
**Goal:** yield Cloudflare bindings (R2, KV, D1, Queues, …) inside Effect — `const bucket = yield* r2(e => e.BUCKET)` then `yield* bucket.put("hello.txt", "world")` — fully type-safe, error-typed, and composable, **without adopting Alchemy** and **without giving up `wrangler.jsonc` + `wrangler types`**.

---

## 1. The problem

Our Workers already get **type-safe** bindings for free: `wrangler.jsonc` declares them, `wrangler types --env-interface Env` generates the `Env` interface, and `cloudflare:workers` exposes a typed `env`:

```typescript
import { env } from "cloudflare:workers"

// fully typed thanks to `wrangler types`
const obj = await env.BUCKET.get("hello.txt")  // env.BUCKET : R2Bucket
```

That's type-safe but **not effectful**. Every call is a bare `Promise` that throws, so inside Effect code you end up hand-wrapping each call in `Effect.tryPromise`, losing tagged errors, retries/timeouts, and composability. We want the binding to *be* an Effect SDK — yieldable, with typed errors — while keeping the existing wrangler/typegen workflow.

Alchemy v2 solves exactly the "yieldable, type-safe binding" half elegantly. This doc explains **how Alchemy does it** and distills a **lightweight pattern** we can roll out across every Effect-on-Cloudflare project.

---

## 2. How Alchemy v2 does it

Source studied: `github.com/alchemy-run/alchemy-effect` (the v2 Effect repo; published as `alchemy@2.0.0-beta.44`). Key files: `packages/alchemy/src/Binding.ts`, `.../Cloudflare/R2/R2BucketBinding.ts`, `.../Cloudflare/KV/KVNamespaceBinding.ts`, `.../Cloudflare/Workers/Worker.ts`.

Alchemy splits every binding into **two independent halves**:

### a) The runtime binding — a `Context.Service` whose shape is a function

`Binding.Service<Self, Shape>()(id)` is just a `Context.Service` tag whose `Shape` is a function, plus a `.bind()` helper:

```typescript
// Binding.ts (simplified)
export const Service = <Self, Shape extends (...a: any[]) => Effect.Effect<any, any, any>>() =>
  <Id extends string>(id: Id) => {
    const self = Context.Service<Self, Shape>(id)
    return Object.assign(self, {
      bind: (...args) => self.use((f) => f(...args)),   // read impl from context, call it
    })
  }
```

So `R2BucketBinding` is a service whose implementation is `(bucket) => Effect<R2BucketClient>`, and `.bind(Bucket)` = "pull the impl out of context and call it with `Bucket`".

### b) The `Live` layer — reads `env` and wraps the native binding in Effect

The implementation reads the worker `env` from a `WorkerEnvironment` service, looks up the native binding by name, and wraps **every method** in `Effect.tryPromise` with a **tagged error**:

```typescript
// R2BucketBinding.ts (essence)
export const R2BucketBindingLive = Layer.effect(R2BucketBinding, Effect.gen(function* () {
  const env = yield* WorkerEnvironment                       // env in the Effect context
  return (bucket: R2Bucket) => Effect.sync(() => {
    const raw = env[bucket.LogicalId]                        // the native R2Bucket
    const use = (fn) => Effect.tryPromise({ try: () => fn(raw), catch: (e) => new R2Error({ ... }) })
    return {
      get:    (key, opts) => use((r) => r.get(key, opts)).pipe(Effect.map(wrapObject)),
      put:    (key, val, opts) => use((r) => r.put(key, val, opts)).pipe(Effect.map(wrapObject)),
      delete: (keys) => use((r) => r.delete(keys)),
      list:   (opts) => use((r) => r.list(opts)),
      // streams via Stream.fromReadableStream, etc.
    } satisfies R2BucketClient
  })
}))
```

`R2BucketClient` is a **hand-written interface** where every native method is re-typed to return `Effect<…, R2Error, …>`. That interface is where the type-safety and the tagged errors live. `WorkerEnvironment` is just `Context.Service<…, Record<string, any>>` provided once at the worker entry.

### c) The deploy-time policy — the part we do **not** want

Separately, `R2BucketBindingPolicy` records infra at *plan/deploy* time (adds the `r2_bucket` binding to the worker, generates least-privilege perms). At runtime its layer is absent and it's a no-op. **This is the coupling we're skipping** — `wrangler.jsonc` + `wrangler types` already do this job for us.

### Takeaway

> A binding becomes "yieldable + type-safe + effectful" by **(1)** putting `env` in the Effect context and **(2)** wrapping the native binding's methods in `Effect.tryPromise` behind a hand-written, Effect-returning interface.

Everything else in Alchemy's binding stack (resources, `.bind` registration, policies, `Self`/`Namespace`) exists to *provision* the binding. We don't need it: we provision with wrangler and we already have the precise `Env` types from typegen — arguably **more** type-safe than Alchemy's `Record<string, any>` env.

---

## 3. The proposed pattern for our projects

Three pieces, shipped once in a shared package, then ~3 lines per project.

### 3.1 `CloudflareEnv` — `env` as a yieldable, test-overridable service

Use a `Context.Reference` whose default reads `cloudflare:workers`. Because it has a default, it's yieldable **anywhere with no entry wiring**; because it's a service, tests can override it with a fake env.

```typescript
// per project: src/cloudflare.ts
import { env } from "cloudflare:workers"
import { makeCloudflare } from "@repo/cloudflare"

// `Env` is the typegen'd global interface (wrangler types --env-interface Env)
export const { CloudflareEnv, r2, kv, d1, queue } = makeCloudflare<Env>(() => env)
```

### 3.2 Type-safe, cast-free accessors via a selector

The accessor takes a **selector** `(env) => binding`. The selector is checked against the typegen'd `Env`, so it autocompletes and is **cast-free** — `e => e.BUCKET` only type-checks if `BUCKET` is the right binding kind.

```typescript
// @repo/cloudflare (shared, written once)
import type { R2Bucket, KVNamespace, D1Database, Queue } from "@cloudflare/workers-types"
import { Context, Effect } from "effect"

export const makeCloudflare = <Env>(read: () => Env) => {
  const CloudflareEnv = Context.Reference<Env>("@repo/cloudflare/Env", { defaultValue: read })

  const r2 = (select: (env: Env) => R2Bucket) =>
    CloudflareEnv.pipe(Effect.map((env) => wrapR2(select(env))))

  const kv = (select: (env: Env) => KVNamespace) =>
    CloudflareEnv.pipe(Effect.map((env) => wrapKV(select(env))))

  const d1 = (select: (env: Env) => D1Database) =>
    CloudflareEnv.pipe(Effect.map((env) => wrapD1(select(env))))

  const queue = <T>(select: (env: Env) => Queue<T>) =>
    CloudflareEnv.pipe(Effect.map((env) => wrapQueue(select(env))))

  return { CloudflareEnv, r2, kv, d1, queue }
}
```

Usage reads exactly like the Alchemy ergonomics, but the binding comes from our typed `env`:

```typescript
const bucket = yield* r2((e) => e.BUCKET)
yield* bucket.put("hello.txt", "world")

const obj = yield* bucket.get("hello.txt")
const text = obj ? yield* obj.text() : "not found"
```

> Why a selector instead of `r2("BUCKET")`? A string key forces an internal `as R2Bucket` assertion (TS won't narrow `Env[K]` from a mapped-key constraint). The selector keeps it **100% cast-free** while still autocompleting. A string-key variant is possible if you accept one assertion *inside the shared wrapper* (never in app code).

### 3.3 The effectful wrappers (written once per binding type)

Each wrapper turns a native binding into an Effect SDK with a tagged error. This is the only place `Effect.tryPromise` appears.

```typescript
// @repo/cloudflare/src/r2.ts
import type { R2Bucket as Native, R2Object, R2GetOptions, R2PutOptions } from "@cloudflare/workers-types"
import { Data, Effect, Stream } from "effect"

export class R2Error extends Data.TaggedError("R2Error")<{ message: string; cause: unknown }> {}

export interface R2Client {
  get(key: string, opts?: R2GetOptions): Effect.Effect<R2Object | null, R2Error>
  put(key: string, value: string | ArrayBuffer | ReadableStream, opts?: R2PutOptions): Effect.Effect<R2Object | null, R2Error>
  delete(keys: string | string[]): Effect.Effect<void, R2Error>
  list(opts?: import("@cloudflare/workers-types").R2ListOptions): Effect.Effect<import("@cloudflare/workers-types").R2Objects, R2Error>
}

export const wrapR2 = (raw: Native): R2Client => {
  const use = <A>(fn: (r: Native) => Promise<A>): Effect.Effect<A, R2Error> =>
    Effect.tryPromise({ try: () => fn(raw), catch: (cause) => new R2Error({ message: String(cause), cause }) })
  return {
    get: (key, opts) => use((r) => r.get(key, opts)),
    put: (key, value, opts) => use((r) => r.put(key, value, opts)),
    delete: (keys) => use((r) => r.delete(keys)),
    list: (opts) => use((r) => r.list(opts)),
  }
}
```

KV/D1/Queue follow the identical shape (`wrapKV`, `wrapD1`, `wrapQueue`) — a tagged error + each method behind `use`. Streaming bodies use `Stream.fromReadableStream` (as Alchemy does) when needed.

Because every method returns an `Effect`, you get the full toolkit for free:

```typescript
yield* bucket.put("k", body).pipe(
  Effect.retry({ times: 3, schedule: Schedule.exponential("100 millis") }),
  Effect.timeout("5 seconds"),
  Effect.catchTag("R2Error", () => Effect.void),
)
```

---

## 4. How it fits our worker entry points

Nothing changes at the entry for binding access — `CloudflareEnv`'s default reads `cloudflare:workers`, so `yield* r2(...)` works inside any handler with zero wiring. Our existing `effect-worker-api` `Bindings` service (env+ctx, provided per request) can be **replaced** by this `CloudflareEnv` reference; the DB middleware would build `PgDrizzle` from `yield* CloudflareEnv` instead of a bespoke service.

For tests, override the env:

```typescript
program.pipe(Effect.provideService(CloudflareEnv, fakeEnv))
```

---

## 5. Rollout plan

1. **Create `packages/cloudflare` (`@repo/cloudflare`).** It depends only on `effect` + `@cloudflare/workers-types`. Export `makeCloudflare`, the wrappers, and the tagged error types.
2. **Implement wrappers incrementally** — start with what we actually use (R2, KV, D1/`PgDrizzle`-via-Hyperdrive, Queues), add others (DO stubs, Service bindings, AI, Vectorize, Analytics Engine) on demand. Each is ~30 lines and self-contained.
3. **Per project, add `src/cloudflare.ts`** (the 3-line `makeCloudflare<Env>(() => env)`), re-exporting the accessors.
4. **Adopt in handlers** by replacing `await env.X.method()` / inline `Effect.tryPromise` with `yield* binding(e => e.X)` then `yield* client.method()`.
5. **Migrate `effect-worker-api`** off its one-off `Bindings` service to `CloudflareEnv` (consolidation).

**Adding a new binding type** = write `wrapFoo(raw): FooClient` + a `FooError` + add one accessor line to `makeCloudflare`. No infra, no codegen.

---

## 6. Comparison

| | raw `cloudflare:workers` `env` | Alchemy v2 `.bind()` | This proposal |
|---|---|---|---|
| Type-safe bindings | ✅ (typegen) | ✅ (resource types) | ✅ (typegen) |
| Effectful / yieldable | ❌ bare Promises | ✅ | ✅ |
| Tagged errors, retry/timeout | ❌ | ✅ | ✅ |
| Provisioning | wrangler.jsonc + typegen | Alchemy resources + policies | wrangler.jsonc + typegen |
| Extra deps / framework | none | `alchemy` (+ Vite 8, Alchemy CLI) | `effect` + `@cloudflare/workers-types` |
| Test override of env | awkward | via runtime | `provideService(CloudflareEnv, fake)` |

---

## 7. Trade-offs & notes

- **We re-type each binding's surface by hand.** That's the cost of the effectful interface (Alchemy pays it too). Mitigation: wrap lazily — only the methods/bindings we use — and lean on `@cloudflare/workers-types` for the parameter/return types so we're not inventing shapes.
- **No provisioning intelligence.** Forgetting a `wrangler.jsonc` entry is a runtime `undefined`, not a deploy-time error (Alchemy would catch it at plan time). `wrangler types` keeps the `Env` type honest, so the selector won't compile against a binding that isn't declared — which catches most of this at build time.
- **`cloudflare:workers` `env` access** is only valid within the worker runtime; the `Context.Reference` default is lazy (evaluated on first `yield*`, i.e. during a request), so this is fine.
- **Source of truth for the wrappers:** mirror Alchemy's method coverage where useful (e.g. R2 streaming via `Stream.fromReadableStream`, KV's `get` overloads), but keep our interfaces minimal and grow them as needed.

## References

- Alchemy v2 source: `github.com/alchemy-run/alchemy-effect` — `packages/alchemy/src/Binding.ts`, `Cloudflare/R2/R2BucketBinding.ts`, `Cloudflare/KV/KVNamespaceBinding.ts`, `Cloudflare/Workers/Worker.ts`.
- Docs: `v2.alchemy.run/concepts/binding`.
- Cloudflare: `wrangler types --env-interface Env`, `import { env } from "cloudflare:workers"`.
