# Alchemy v2 & a cleaner entry point for `effect-worker-api`

**Status:** research / findings — _no code changed_
**Date:** 2026-05-23
**Author:** investigation requested by Matt

## TL;DR

- Alchemy v2 ("Infrastructure as Effect") models a Cloudflare Worker as a single
  `Effect` program: an **init phase** that binds resources (`yield* R2Bucket.bind(...)`)
  and a **runtime phase** that returns a `fetch` which is just an
  `Effect<HttpServerResponse, E, R>`.
- That `fetch` Effect is **the exact same shape that an Effect `HttpApi` already
  compiles to** (an `HttpApp`). So conceptually our `WorkerApi` can _be_ the worker's
  `fetch` with no manual `env`/`ctx` plumbing.
- **But** Alchemy v2's Cloudflare _runtime_ adapter is not implemented yet (the
  published docs are ahead of the code — see [Status of Alchemy v2](#status-of-alchemy-v2)).
  We cannot adopt it for the actual fetch entry point today.
- **The win is available now without Alchemy.** The thing that makes our entry point
  feel hacky — bridging `env`/`ctx` through nullable `Context.Reference`s and a separate
  `toWebHandler(request, services)` call — can be collapsed using plain Effect. Alchemy
  just shows the destination. See [Recommendation](#recommendation).

---

## 1. The current entry point and what's hacky about it

Three files cooperate to get a request into the Effect world:

**`apps/effect-worker-api/src/index.ts`** — manually builds an Effect `Context` of
per-request "reference" services and threads it into the web handler:

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const services = pipe(
      Context.make(currentEnv, env),
      Context.add(currentCtx, ctx)
    )
    return handler(request, services)
  }
} satisfies ExportedHandler<Env>
```

**`apps/effect-worker-api/src/services/cloudflare.ts`** — declares the two bindings as
**nullable** `Context.Reference`s with a `null` default:

```typescript
export const currentEnv = Context.Reference<Env | null>(
  "@app/api/currentEnv", { defaultValue: () => null })
export const currentCtx = Context.Reference<ExecutionContext | null>(
  "@app/api/currentCtx", { defaultValue: () => null })
```

**`apps/effect-worker-api/src/services/middleware.ts`** — reads those references back
out, null-checks them, and only then provides the "real" `CloudflareBindings` service:

```typescript
const env = yield* currentEnv
const ctx = yield* currentCtx
if (env === null || ctx === null) {
  return yield* Effect.fail(new CloudflareBindingsError({ /* ... */ }))
}
return yield* httpEffect.pipe(Effect.provideService(CloudflareBindings, { env, ctx }))
```

**Why this is awkward (not wrong, just more machinery than needed):**

1. **Nullable bridge.** `env`/`ctx` are modelled as `T | null` with a `null` default,
   so every consumer must defend against "binding not available." They are _never_ null
   in practice — the worker runtime always passes them — but the types force a runtime
   check + a dedicated error type (`CloudflareBindingsError`).
2. **Two hops for one value.** `env`/`ctx` enter as `currentEnv`/`currentCtx`, then a
   middleware copies them into `CloudflareBindings`. Two service identities for one fact.
3. **Bindings are declared in two places.** The binding _shapes_ live in
   `wrangler.jsonc` (+ the ambient `Env` type); the binding _usage_ lives in Effect code.
   They can drift.
4. **The HTTP routes are disconnected from the entry point.** `runtime.ts` builds the
   `HttpApi` into a web handler, and `index.ts` separately constructs a context and calls
   it. The "what are my routes" and "how does a request get in" concerns are stitched
   together by hand.

> Note: the **middleware pattern itself** (`.middleware(CloudflareBindingsMiddleware)` in
> `@repo/contracts/src/http/api.ts`, `DatabaseMiddleware` on the `users` group) is
> idiomatic Effect HttpApi and worth keeping. The hacky part is specifically the
> nullable-reference bridge feeding it.

---

## 2. What Alchemy v2 actually is

Alchemy v2 is a rewrite around the idea of **"Infrastructure as Effect"** (the rewrite
lives on the `sam/iae2` branch; packages are published under `@alchemy.run/*`). A
**Platform** is a resource that "bundles runtime code along with its infrastructure" —
the handler is deployed _as part of_ the resource declaration, so there's no separation
between `alchemy.run.ts` (infra) and `src/worker.ts` (app).

### The Effect-style Worker entry point (from the docs, verbatim)

```typescript
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { Bucket } from "./bucket.ts";

export default Cloudflare.Worker(
  "Api",
  { main: import.meta.path },
  Effect.gen(function* () {
    // ── init phase: bind resources, get typed clients ──
    const bucket = yield* Cloudflare.R2Bucket.bind(Bucket);

    return {
      // ── runtime phase: the request handler ──
      fetch: Effect.gen(function* () {
        const obj = yield* bucket.get("hello.txt");
        return obj
          ? HttpServerResponse.text(yield* obj.text())
          : HttpServerResponse.text("Not found", { status: 404 });
      }),
    };
  }),
);
```

Two phases, both Effects:

- **Init**: `yield* Cloudflare.R2Bucket.bind(Bucket)` does three things at once
  ("Records bindings on deployment plans", "auto-generates permissions/bindings",
  "returns a typed client"). One call replaces the `wrangler.jsonc` entry, the ambient
  `Env` typing, _and_ the `env.BUCKET` lookup.
- **Runtime**: returns `{ fetch }`, where `fetch` is an
  `Effect<HttpServerResponse, E, R>`. Note the response type is Effect's own
  `effect/unstable/http/HttpServerResponse` — i.e. `fetch` is a standard Effect
  **`HttpApp`**. The request, `env`, and `ExecutionContext` are provided into the Effect
  context by Alchemy's runtime, so user code never touches `(request, env, ctx)` directly.

The same shape generalises across providers — the AWS Lambda example is identical except
for the binding names:

```typescript
export default AWS.Lambda.Function(
  "Api",
  { main: import.meta.path },
  Effect.gen(function* () {
    const getJob = yield* DynamoDB.GetItem.bind(JobsTable);
    const enqueue = yield* SQS.SendMessage.bind(JobQueue);
    return { fetch: Effect.gen(function* () { /* ... */ }) };
  }),
);
```

### What the source confirms (and what's still a stub)

On `sam/iae2`:

- The **runtime handler contract** is visible in the Lambda adapter
  `@alchemy.run/effect-aws/src/lambda/serve.ts`: the handler is
  `(event, context) => Effect.Effect<Result, never, Req>` — the **requirements channel
  `Req` is the set of bindings**, which the framework provides; the **error channel is
  `never`** (you must handle errors before returning). This is the concrete version of
  the docs' `fetch` Effect.
- `bind` (`@alchemy.run/effect/src/bind.ts`) and `Service`
  (`@alchemy.run/effect/src/service.ts`) implement the "erase the capabilities/bindings
  from the requirements, the framework supplies them" trick — the same idea as providing
  a Layer, but driven from the binding call.
- The Cloudflare **deploy** provider exists
  (`@alchemy.run/effect-cloudflare/src/worker.provider.ts` calls the CF API to create the
  worker + attach bindings), but the Cloudflare **runtime** glue does **not**:
  `@alchemy.run/effect-cloudflare/src/index.ts` is empty, there's no
  `ExecutionContext` / `ExportedHandler` / `toWebHandler` adapter in the package, and
  `worker.ts` even still reads `WorkerType = "AWS.Lambda.Worker"` (a copy-paste
  placeholder). In other words, on Cloudflare the polished docs example is **aspirational**.

---

## 3. The key realization: their `fetch` Effect == our `HttpApi`

In Effect's platform, an `HttpApi` is built into an **`HttpApp`**, which is exactly:

```
Effect<HttpServerResponse, E, HttpServerRequest | R>
```

That is _precisely_ the type Alchemy hands you as `fetch`. So Alchemy's model and our
existing routes are the same object viewed from two ends:

| Alchemy v2 concept            | Effect primitive we already have                                   |
| ----------------------------- | ------------------------------------------------------------------ |
| `fetch: Effect<Response,…>`   | `HttpApp` produced from `WorkerApi` (`@repo/contracts`)            |
| `yield* X.bind(Resource)`     | a service provided into context (today: `CloudflareBindings`, `PgDrizzle`) |
| framework provides bindings   | our per-request `services` `Context` passed to `toWebHandler`     |
| framework provides request    | the `HttpServerRequest` service `toWebHandler` injects per request |

So "can we use the HTTP routes we have to provide a cleaner entry point?" — **yes**, and
we don't need Alchemy to do it. Alchemy is essentially a thin, declarative wrapper over
this same wiring (plus deploy-time binding generation).

---

## 4. Two paths

### Path A — Adopt the pattern now, with plain Effect (recommended)

We can delete the nullable-reference bridge and let the routes _be_ the entry point.
`HttpRouter.toWebHandler` already accepts a per-request `Context`; provide the **real**
`CloudflareBindings` service directly instead of two nullable references:

```typescript
// services/cloudflare.ts — bindings as ONE non-nullable service, no Reference, no null
export class CloudflareBindings extends Context.Service<CloudflareBindings, {
  readonly env: Env
  readonly ctx: ExecutionContext
}>()("@app/api/CloudflareBindings") {}

// index.ts — the routes ARE the handler; provide bindings per request
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handler(request, Context.make(CloudflareBindings, { env, ctx }))
  }
} satisfies ExportedHandler<Env>
```

This removes, in one move:

- `currentEnv` / `currentCtx` nullable references and `withCloudflareBindings`,
- the `null` checks and the `CloudflareBindingsError` failure path,
- the `CloudflareBindingsMiddleware` indirection (the `DatabaseMiddleware` and handlers
  can depend on `CloudflareBindings` directly; `waitUntil` reads `ctx` from it).

It keeps everything else (HttpApi, groups, `DatabaseMiddleware`, `wrangler.jsonc`).
It is a small, type-safe refactor and is verifiable with `pnpm check`.

> Caveat to verify when implementing: the `CloudflareBindings` service identity is
> currently introduced via `HttpApiMiddleware` in `@repo/contracts`
> (`.middleware(CloudflareBindingsMiddleware)` in `http/api.ts`). To provide it from the
> entry point instead, drop that `.middleware(...)` from the API definition so the
> service becomes a plain context requirement satisfied by the `toWebHandler` `services`
> arg. Confirm the remaining `R` on the built `HttpApp` is exactly `CloudflareBindings`
> (+ whatever `DatabaseMiddleware` needs) and nothing leaks. Use the vendored Effect
> source at `repos/effect/packages/effect/src/unstable/httpapi/` and
> `.../http/HttpApp.ts` / `HttpRouter.ts` to confirm `toWebHandler`'s exact signature for
> beta.70 (see CLAUDE.md → "Effect v4 — Vendored Source Reference").

### Path B — Adopt Alchemy v2 when its Cloudflare runtime ships

When `@alchemy.run/effect-cloudflare` gains the runtime fetch adapter, the entry point
would become roughly:

```typescript
export default Cloudflare.Worker(
  "Api",
  { main: import.meta.path },
  Effect.gen(function* () {
    const db = yield* Cloudflare.Hyperdrive.bind(Hyperdrive) // typed client + binding
    return {
      // hand Alchemy the HttpApp built from our existing WorkerApi
      fetch: WorkerApiHandler.pipe(Effect.provideService(PgDrizzle, makeDrizzle(db)))
    }
  }),
)
```

Upside: bindings declared once, in code, with generated `wrangler` config and typed
clients; `env`/`ctx` plumbing disappears entirely; same `WorkerApi` reused as `fetch`.
Downside: it's pre-release, Cloudflare-runtime-incomplete, and would couple us to a
fast-moving framework. **Not actionable today.**

---

## Status of Alchemy v2

- **Repo / branch:** `github.com/sam-goodwin/alchemy`, branch **`sam/iae2`**
  (`main` is still v1, v0.93.x, async/await style). Packages under `@alchemy.run/*`.
- **Docs:** https://v2.alchemy.run/ (notably `/concepts/platform/`, `/concepts/binding/`).
  The docs describe the intended API and are **ahead of the code** for Cloudflare.
- **Maturity:** early WIP. Core Effect machinery (`bind`, `Service`, `Provider`,
  `App`/`plan`/`apply`) and the AWS Lambda path are the most developed; the Cloudflare
  runtime entry-point adapter is not yet implemented.
- **Implication:** treat Alchemy v2 as a **design reference** for now, not a dependency.

## Recommendation

1. **Do Path A now** as an isolated refactor of `effect-worker-api`: collapse the
   `currentEnv`/`currentCtx` nullable bridge into a single non-nullable `CloudflareBindings`
   service provided at the entry point, and let the `WorkerApi` `HttpApp` be the handler.
   This removes the hacky feeling, is fully type-checked, and keeps us on stock Effect v4.
2. **Track Alchemy v2** (`sam/iae2` + v2 docs). Revisit Path B once
   `@alchemy.run/effect-cloudflare` ships a real Worker runtime adapter; our routes are
   already in the right shape (`HttpApp`) to drop in with minimal change.

## References

- Current code: `apps/effect-worker-api/src/{index,runtime}.ts`,
  `apps/effect-worker-api/src/services/{cloudflare,middleware}.ts`,
  `packages/contracts/src/http/{api.ts,middleware/cloudflare.ts}`.
- Alchemy v2 docs: `v2.alchemy.run/concepts/platform`, `…/concepts/binding`.
- Alchemy v2 source (`sam/iae2`): `@alchemy.run/effect/src/{bind,service,runtime}.ts`,
  `@alchemy.run/effect-aws/src/lambda/serve.ts` (runtime handler contract),
  `@alchemy.run/effect-cloudflare/src/{worker.ts,worker.provider.ts,index.ts}`.
- Effect v4 HTTP primitives: `repos/effect/packages/effect/src/unstable/http/` and
  `…/unstable/httpapi/` (vendored — read these for exact beta.70 signatures).
</content>
