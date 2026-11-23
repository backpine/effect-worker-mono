# API

The REST API serves the `WorkerApi` contract from `@repo/contracts/api`.

- `src/index.ts` selects the live database layer and exports the Worker.
- `src/runtime.ts` assembles the API groups, validation, and HTTP platform services. `Worker.make` builds this graph once per isolate and supplies a fresh scope to each request.
- `src/handlers/users.ts` applies the database layer after the request has decoded. Each users request owns its connection and releases it when the handler finishes. Health and OpenAPI use only the initialized router.
- `src/services/database.ts` reads the typed Hyperdrive binding and calls the shared `connect` factory. A failed acquisition returns the contract's typed 503.

## Commands

```bash
bun run dev        # Run locally with Wrangler
bun run check      # Type-check the app and its tests
bun test       # Test the Worker entry and database scope
bun run cf-typegen # Regenerate Env types after binding changes
```

For local Postgres, use the Docker setup in `packages/db` and set
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` for Wrangler.
