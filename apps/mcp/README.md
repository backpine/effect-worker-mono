# MCP Worker

Install workspace dependencies with `bun install` and start the
[local Postgres database](../../packages/db/README.md#change-the-schema).
Run these commands from the repo root in separate terminals.

```sh
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://postgres:postgres@localhost:5432/effect_worker bun run --filter api dev
bun run --filter mcp dev
```

Connect a Streamable HTTP MCP client that supports protocol revision
`2026-07-28` to `http://127.0.0.1:8788/mcp`. The Worker calls the API
at `http://127.0.0.1:8787` by default. Set `API_URL` in `apps/mcp/.dev.vars`
if your API runs on a different port. The contract supplies the `/api` prefix.

- `health` returns the API status and timestamp.
- `get_user` accepts a numeric `id` and returns the matching user. Create a
  user through the API or CLI to try it.

The Worker builds the router, tool registrations, and generated API client
once per isolate. Each MCP POST runs in its own scope. Tool arguments are
validated before the API call, and the call has a 10-second deadline. The
API owns database connections.

## Deployment

Set `vars.API_URL` in `wrangler.jsonc` to the deployed API origin, then run
`bun run --filter mcp deploy` from the repo root. The deployed configuration
advertises `health` only. The dev script enables `get_user` for a loopback
API origin. Exposing user tools remotely requires caller authentication and
authorization at the API boundary.

## Tests

```sh
bun test apps/mcp/test
bun run --filter mcp check
bun run --filter mcp build
```

The protocol tests use Effect's in-memory `McpTest` client and a fake API.
The Wrangler smoke test launches the real Worker against a local API
fixture and checks tool discovery and overlapping calls. It requires the
same Node.js installation as the other Workers.
