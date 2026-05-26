# CLAUDE.md — Effect Worker API

Guidance for working in this app. See the root `CLAUDE.md` for monorepo-wide patterns.

## What this is

A Cloudflare Worker HTTP REST API built on Effect v4's `HttpApi`. It serves the
`WorkerApi` contract from `@repo/contracts` and talks to Postgres (via Hyperdrive)
through `@repo/db`.

## How it's wired

- **Entry (`src/index.ts`)** — the API is built into an `HttpEffect` via
  `HttpRouter.toHttpEffect` (`src/runtime.ts`). Per request the worker provides the
  incoming request as `HttpServerRequest`, runs it in a fresh `Effect.scoped`, and
  converts the `HttpServerResponse` to a Web `Response`. No `HttpRouter.toWebHandler`,
  no manual env/ctx threading.
- **Bindings (`src/services/cloudflare.ts`)** — `@repo/cloudflare`'s
  `makeCloudflare<Env>(() => env)` gives a type-safe `hyperdrive(...)` accessor over the
  `cloudflare:workers` `env`.
- **Request-scoped DB (`src/services/middleware.ts`)** — `DatabaseMiddlewareLive`
  implements the `DatabaseMiddleware` tag from `@repo/contracts`: it reads the Hyperdrive
  connection string and opens a request-scoped `Database` via `@repo/db`'s `connect`, then
  provides it downstream. The connection's lifetime is the request `Scope`. Only groups
  that declare `.middleware(DatabaseMiddleware)` connect (e.g. `users`, not `health`).
- **Handlers (`src/handlers/`)** — implement the contract groups and call `@repo/db`
  query programs (`UserQueries`). They `yield* Database` (via the queries); the middleware
  type-subtracts it, so a DB-using group without the middleware is a compile error.

## Structure

```
src/
  index.ts               # Worker fetch entry (toHttpEffect + per-request scope)
  runtime.ts             # apiApp = HttpRouter.toHttpEffect(HttpApiBuilder.layer(WorkerApi))
  handlers/              # group handler implementations (call @repo/db queries)
  services/
    cloudflare.ts        # @repo/cloudflare bindings (hyperdrive accessor)
    middleware.ts        # DatabaseMiddlewareLive (request-scoped Database)
wrangler.jsonc           # Cloudflare config (HYPERDRIVE binding, nodejs_compat)
.env                     # CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE (local dev)
```

## Commands

```bash
pnpm dev        # wrangler dev (local)
pnpm deploy     # deploy to Cloudflare
pnpm check      # tsc --noEmit
pnpm cf-typegen # regenerate Env types after editing wrangler.jsonc
```

Local Postgres for dev lives in `@repo/db` (`docker compose -f ../../packages/db/docker-compose.yml up -d`),
with migrations applied via `drizzle-kit` (see `@repo/db`).

## Conventions

- Domain types/errors → `@repo/domain`; API surface → `@repo/contracts`; DB → `@repo/db`.
- No type casting. Avoid explicit `Effect` return-type annotations — let them infer.
