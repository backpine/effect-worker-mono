# CLI

From the workspace root, run `bun install` and start the [API](../../README.md#api).
Set `API_URL` to the API origin. `--api-url` overrides it. The shared contract
adds the `/api` prefix.

```sh
export API_URL=http://localhost:8787
bun apps/cli/src/index.ts health
bun apps/cli/src/index.ts users list --json
bun apps/cli/src/index.ts users get 42
bun apps/cli/src/index.ts users create --email ada@example.com --name Ada
```

`--help`, `--version`, and shell completions work offline. `--json` prints one
schema-encoded response to stdout. Errors go to stderr. Requests have a
10-second deadline. Transient read failures can retry once, and creates send
one request.

| Exit code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Unexpected failure or incompatible response |
| 2 | Invalid arguments or API configuration |
| 3 | User not found |
| 4 | API rejected the request |
| 5 | API unavailable or request timed out |

## Add a command

Put the command in `src/commands/`. Reuse domain schemas for arguments and
flags and call the generated `WorkerApi` client through `src/services/api.ts`.
Use the endpoint's response schema for JSON output.

Run `bun test apps/cli/test` to exercise parsing, request and response codecs,
retries, and deadlines with a fake transport. The suite also launches the CLI
as a subprocess to check output streams and exit codes. Run
`bun run --filter @repo/cli check` for types and
`bun run --filter @repo/cli build` to create `dist/cli.js` for Bun.
