# @repo/db

| Path | Purpose |
| --- | --- |
| `src/schema/` | Drizzle tables and inferred row types. Export tables from `schema/index.ts` for Drizzle Kit. |
| `migrations/` | Generated SQL and the Drizzle Kit journal and snapshots. Review and commit both. |
| `src/queries/` | Parameterized Effect SQL, grouped by table or feature. |
| `src/connect.ts` and `src/database.ts` | Scoped Postgres connection and the `Database` service used by queries. |
| `test/integration/` and `test/support/` | Postgres query tests, database lifecycle, and typed seed helpers. |

Effect and `@effect/sql-pg` are pinned to `4.1.5`. Drizzle ORM `0.45.4` defines
the schema. Drizzle Kit `0.31.11` generates and applies migrations, using its
development-only `pg` driver.

## Add a query

Put the SQL in `src/queries/` and export it from that folder's index. Yield
`Database` to get the Effect SQL client, bind values with the SQL template
tag, and decode returned rows with Effect Schema. The query's result schema
can be checked against the row type inferred from the Drizzle table.

```ts
import { UserQueries } from "@repo/db/queries"

const user = yield* UserQueries.findUserById(id)
```

The API builds its router once. For each validated users request, it reads
Hyperdrive and calls `connect` to provide a PostgreSQL connection. Effect closes
that connection with the request scope.

## Change the schema

From `packages/db`, edit the table, then generate and inspect the migration.

```bash
bun run db:generate --name=describe_the_change
bun run db:check
```

Commit the SQL and metadata together. The initial migration keeps its original
SQL and timestamp so databases with the previous journal can use the same
migrate command.

From the same directory, start and migrate a local development database.

```bash
docker compose up -d --wait
DATABASE_URL=postgres://postgres:postgres@localhost:5432/effect_worker bun run db:migrate
```

From `apps/api`, pass the same URL to Wrangler.

```bash
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://postgres:postgres@localhost:5432/effect_worker bun run dev
```

## Test a query

From the repository root with Docker running, use `bun install` followed by
`bun run test:db`. `bun test` also runs the suite. The tests start one
disposable PostgreSQL 17 container on an available local port, apply the
checked-in migrations, and clone a clean database per test.

Add cases in `test/integration/postgres.test.ts`. Use `postgres.withDatabase`
for an isolated database and `db.run` to provide a scoped connection to an Effect
program. Use `test/support/seeds.ts` for typed fixture inserts.

```ts
it("finds a seeded user", () =>
  postgres.withDatabase(async (db) => {
    await db.run(seedUsers({ email: "ada@example.com", name: "Ada" }))
    const user = await db.run(UserQueries.findUserById(1))
    expect(user.email).toBe("ada@example.com")
  }))
```
