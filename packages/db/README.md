# @repo/db

Database layer for the monorepo: the **Drizzle schema**, **reusable Effect query
programs**, and the **request-scoped database connection** — shared across every app.

Built on the first-class **`drizzle-orm/effect-postgres`** client over `@effect/sql-pg`.

## Layout

| Path | What |
|------|------|
| `src/schema.ts` | Drizzle table definitions (the `users` table). |
| `src/database.ts` | The `Database` service tag (the Drizzle handle, `EffectPgDatabase`). Type-only — safe to import anywhere (no driver pulled in). |
| `src/connect.ts` | `connect(connectionString)` — opens a **request-scoped** Drizzle database. Requires `Scope`; the pool is built into the ambient (request) scope via `Layer.build` and closes with it. |
| `src/queries/*.ts` | Reusable Effect programs — `Effect<…, …, Database>`. They **require** the `Database` tag; they never connect. |

## Connecting (Cloudflare constraint)

On Cloudflare the connection must open **per request**, never at module load (Hyperdrive
only permits sockets inside a `fetch`). So `connect` requires `Scope` and is called from a
**request-scoped middleware** (see `@repo/contracts` `DatabaseMiddleware` / `DatabaseRpcMiddleware`
and the app implementations). Apps never build the DB layer at the root.

```ts
// inside request-scoped middleware
const db = yield* connect(env.HYPERDRIVE.connectionString) // Effect<EffectPgDatabase, _, Scope>
yield* httpEffect.pipe(Effect.provideService(Database, db))
```

## Queries

Query programs require the `Database` tag and return raw rows — no domain mapping:

```ts
// findAllUsers : Effect<Row[], never, Database>
export const findAllUsers = Effect.gen(function* () {
  const db = yield* Database
  return yield* db.select().from(users)
})
```

## Local development

A Dockerized Postgres lives here for local dev:

```bash
docker compose up -d                 # start postgres (db: effect_worker, port 5432)

# apply migrations (drizzle-kit reads DATABASE_URL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/effect_worker pnpm exec drizzle-kit migrate
```

Apps point their `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` (`.env`) at this
database for `wrangler dev`.

| Command | What |
|---------|------|
| `pnpm db:generate` | generate a migration from `schema.ts` |
| `pnpm db:migrate` | apply migrations |
| `pnpm db:push` | push schema directly (no migration files) |
| `pnpm db:studio` | open Drizzle Studio |
