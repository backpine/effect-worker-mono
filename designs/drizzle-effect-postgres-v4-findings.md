# Does `drizzle-orm/effect-postgres` work with Effect v4 beta?

**Short answer: Yes — and it's actually *built for* Effect v4 beta, not v3.**

The `drizzle-orm/effect-postgres` integration ships in the **`drizzle-orm@1.0.0`** line
(currently `1.0.0-rc.x`). From `1.0.0-rc.1` onward it declares Effect v4 beta as a peer
dependency and is implemented entirely against v4 module paths and APIs. I validated this
empirically against this repo's exact Effect version (`4.0.0-beta.70`): both a strict
typecheck and an end-to-end runtime execution pass.

> ⚠️ The published docs page (https://orm.drizzle.team/docs/connect-effect-postgres) is
> version-agnostic and doesn't say which Effect major it targets. Don't trust the docs for
> this — the `package.json` peer deps and the compiled source are the source of truth, and
> they say v4.

---

## TL;DR for this repo

This repo already hand-rolls a custom Drizzle↔Effect bridge at
`packages/db/src/pg-drizzle/` (182 lines: `index.ts` + `patch.ts` + `tag.ts`), built
because **`@effect/sql-drizzle` was removed in Effect v4**. It works by routing through
`drizzle-orm/pg-proxy` and a `RemoteCallback` that calls into Effect's `SqlClient`.

`drizzle-orm/effect-postgres` is the **official, first-party replacement** for exactly that
workaround — purpose-built for v4, returning native `Effect.Effect<…>` values with
`PgClient`/`EffectLogger`/`EffectCache` as v4 service requirements. Adopting it could let
us delete the custom `pg-drizzle` package. See [Migration considerations](#migration-considerations).

---

## Version compatibility matrix

| `drizzle-orm` version | `effect-postgres` export? | Effect peer dependency |
|---|---|---|
| `0.45.x` (current `latest`, what this repo uses) | ❌ no | n/a (v3-era, no Effect integration) |
| `1.0.0-beta.22` and earlier | partial / churning | Effect **v3** (`^0.49.x`-era) |
| **`1.0.0-rc.1` → `rc.3`** | ✅ yes | **`effect: ">=4.0.0-beta.58 \|\| >=4.0.0"`** and **`@effect/sql-pg: ">=4.0.0-beta.58 \|\| >=4.0.0"`** |

Our catalog is pinned to `4.0.0-beta.70`, which satisfies `>=4.0.0-beta.58`. ✅

> Note: `drizzle-orm@latest` is still `0.45.2` and has **no** Effect integration at all.
> The Effect support lives only in the `1.0.0` pre-release line (`@rc` / `@beta` dist-tags).
> GitHub issue [#5414 "Effect 4 Support"](https://github.com/drizzle-team/drizzle-orm/issues/5414)
> requested this; the request was satisfied by the `1.0.0-rc.1` release (the issue text
> still reads as open, but the peer deps + shipped code confirm v4 is the actual target).

---

## What I actually did to verify

Set up a throwaway project at `/tmp/drizzle-effect-validate` and installed the real
packages at this repo's versions:

```
drizzle-orm@1.0.0-rc.3
effect@4.0.0-beta.70
@effect/sql-pg@4.0.0-beta.70
pg
```

Install resolved with **zero peer-dependency conflicts**.

### 1. Typecheck (TS 5.7, `strict: true`, `NodeNext`) — ✅ PASS

A program exercising all three documented entry points typechecks cleanly, and the
**query builder is fully typed** against v4 (`db.select().from(users)` infers
`{ id: number; name: string }[]`):

```ts
import { Effect, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
import { sql } from "drizzle-orm"
import * as PgDrizzle from "drizzle-orm/effect-postgres"

// makeWithDefaults — requires only PgClient
const quickStart: Effect.Effect<void, unknown, PgClient.PgClient> = Effect.gen(function* () {
  const db = yield* PgDrizzle.makeWithDefaults()
  const result = yield* db.execute<{ id: number }>(sql`SELECT 1 as id`)
})

// make() + DefaultServices, then typed query builder
const program = Effect.gen(function* () {
  const db = yield* PgDrizzle.make()
  return yield* db.select().from(schema.users)   // typed rows
}).pipe(Effect.provide(PgDrizzle.DefaultServices))

// real @effect/sql-pg v4 driver layer
const PgLive = PgClient.layer({
  url: Redacted.make("postgres://postgres:postgres@localhost:5432/app"),
})
const runnable = program.pipe(Effect.provide(PgLive))   // R = never
```

> **Caveat — use `skipLibCheck: true`.** With `skipLibCheck: false` you get a wall of
> errors, but **none are from the effect-postgres integration**. They're pre-existing
> library-internal `.d.ts` issues in unrelated Drizzle dialects (cockroach/mssql/mysql/
> sqlite column builders, a `getSQL` abstract-member mismatch, a `ColumnBuilder` variance
> quirk) plus one in `effect`'s own `internal/schema/schema.d.ts`. Every real Effect/
> Drizzle project runs with `skipLibCheck: true` — this repo should too — and under that
> setting the integration code is clean.

### 2. Runtime execution — ✅ PASS

Built the program and ran it through the **Effect v4 runtime** against a non-existent
Postgres. The full layer graph + runtime executed end-to-end and failed *only* at the TCP
socket, which is the expected, correct outcome:

```
[1] modules imported OK against effect 4.0.0-beta.70
[2] PgDrizzle exports: DefaultServices, EffectLogger, EffectPgDatabase,
    EffectPgSession, EffectPgTransaction, effectPgCodecs, make, makeWithDefaults
[3] Effect runtime executed; failed at DB connect as expected:
    {"_id":"Cause","failures":[{"_tag":"Fail","error":{"reason":{"cause":
    {"code":"ECONNREFUSED",...,"port":5432},"message":"PgClient: Failed to connect",
    "operation":"connect","_tag":"UnknownError"}}}]}
[4] runtime smoke test complete — no module-resolution / API errors
```

This proves there are no v4-removed/renamed exports tripping it up at the JS level (types
alone wouldn't catch that). Bonus: the error shape `{ reason: { cause, _tag: "UnknownError" } }`
matches the v4 `SqlError` structured-reason wrapping already noted in this repo's CLAUDE.md.

---

## How the integration is implemented (confirmed v4-native)

Read from the compiled package (`node_modules/drizzle-orm/effect-postgres/*.js`). It imports
exclusively from v4 paths and uses idiomatic v4 constructs:

```js
import * as Effect from "effect/Effect";
import * as Layer  from "effect/Layer";
import { PgClient } from "@effect/sql-pg/PgClient";

const DefaultServices = Layer.merge(EffectCache.Default, EffectLogger.Default);

const make = Effect.fn("PgDrizzle.make")(function* (config = {}) {
  const client = yield* PgClient;        // v4 Context tag, yielded directly
  const cache  = yield* EffectCache;
  const logger = yield* EffectLogger;
  const dialect = new PgDialect({ codecs: config.codecs ?? effectPgCodecs, ... });
  // ...builds EffectPgDatabase over EffectPgSession(client, ...)
});

const makeWithDefaults = (config = {}) =>
  make(config).pipe(Effect.provide(DefaultServices));
```

`Effect.fn(...)`, `yield* <Tag>`, `Layer.merge`, `.Default` layers — all v4 idioms.

**Public API surface** (`drizzle-orm/effect-postgres`):
- `make(config?)` → `Effect.Effect<EffectPgDatabase & { $client: PgClient }, never, EffectCache | EffectLogger | PgClient>`
- `makeWithDefaults(config?)` → same, but `R = PgClient` only (no-op logger/cache pre-provided)
- `DefaultServices: Layer<EffectCache | EffectLogger>` — no-op cache + logger
- `EffectLogger` — `.layer`, `.layerFromDrizzle(drizzleLogger)`, `.Default`
- `EffectPgDatabase`, `EffectPgSession`, `EffectPgTransaction`, `effectPgCodecs`
- Sibling entries: `effect-postgres/migrator`, `effect-postgres/codecs`, `effect-postgres/session`, `effect-postgres/driver`
- Plus a broader family: `effect-core` (errors, logger, query wrapper), `pg-core/effect/*` (select/insert/update/delete/etc.), `effect-schema`, `cache/core/cache-effect`

**Postgres type parsing.** `effect-postgres` ships its own `effectPgCodecs` so Drizzle owns
parsing of `date`/`timestamp`/`timestamptz`/`interval`/`point`/`geometry`/arrays/`bigint`
etc. (returning JS `Date`, bigints, tuples). The docs note you should configure
`@effect/sql-pg`'s `PgClient.layer({ types: ... })` to defer those types to Drizzle rather
than letting node-postgres parse them.

---

## Migration considerations

If we adopt the official integration to replace `packages/db/src/pg-drizzle/`:

1. **Bump `drizzle-orm` `0.45.0` → `1.0.0-rc.x`.** This is a **major version jump** with its
   own breaking changes (the entire `1.0.0` RC line: relations v2 / RQB rewrite, codecs,
   casing, etc.) — independent of Effect. Budget for that, don't treat it as a drop-in.
2. **`drizzle-kit`** would need a matching `1.0.0`-line version (we're on `0.31.8`).
3. **Pre-release risk.** Both sides are betas/RCs: `effect@4.0.0-beta.70` and
   `drizzle-orm@1.0.0-rc.x`. The peer range `>=4.0.0-beta.58` is broad, so future effect
   beta bumps *should* stay compatible, but it's unversioned-frontier territory.
4. **Cloudflare Workers fit.** Our custom bridge goes through `pg-proxy` + Effect `SqlClient`
   (which is what makes it work over Hyperdrive). The official one is built directly on
   `@effect/sql-pg`'s `PgClient` — verify the `@effect/sql-pg` driver behaves over Hyperdrive
   in the Workers runtime before committing. **This is the one thing my test did NOT cover**
   (I only validated Node, typecheck + runtime construction; not a Workers/Hyperdrive deploy).
5. **Upside if it works:** delete ~180 lines of custom bridge + `patch.ts`, get a typed query
   builder + relations + migrator that's officially maintained against v4.

**Recommendation:** It's confirmed compatible with `effect@4.0.0-beta.70` and is the
right long-term target. Treat adoption as a deliberate `drizzle-orm` v1 migration spike
(behind the Hyperdrive verification), not a quick swap.

---

## Repro artifacts

- Validation project: `/tmp/drizzle-effect-validate/` (`src/index.ts` typecheck target,
  `runtime.mjs` runtime smoke test) — temporary, safe to delete.
- Drizzle source clone: `/tmp/drizzle-orm-src/` — note the `effect-postgres` source is **not**
  on `main` (which is still the `0.45`/Netlify line); the Effect work lives on the `1.0.0`
  release branches. The compiled package in node_modules is the authoritative released code.

## Sources

- [Drizzle ORM — Effect Postgres docs](https://orm.drizzle.team/docs/connect-effect-postgres)
- [drizzle-team/drizzle-orm](https://github.com/drizzle-team/drizzle-orm)
- [Issue #5414 — Effect 4 Support](https://github.com/drizzle-team/drizzle-orm/issues/5414)
- `npm view drizzle-orm@1.0.0-rc.3 peerDependencies` (`effect` / `@effect/sql-pg`: `>=4.0.0-beta.58`)
