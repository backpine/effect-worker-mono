import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { HealthResponseSchema, UserSchema } from "@repo/contracts/api"
import { DateTime, Effect, Schema } from "effect"
import { McpClient, McpProtocol } from "effect/ai"
import { FetchHttpClient } from "effect/http"

const app = fileURLToPath(new URL("..", import.meta.url))

const waitForEndpoint = async (stdout: ReadableStream<Uint8Array>) => {
  const reader = stdout.getReader()
  const decoder = new TextDecoder()
  let log = ""
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) throw new Error(`Wrangler exited before startup\n${log}`)
      log += decoder.decode(value, { stream: true })
      const url = /Ready on (http:\/\/127\.0\.0\.1:\d+)/.exec(log)?.[1]
      if (url) return new URL("/mcp", url)
    }
  } finally {
    reader.releaseLock()
  }
}

test("serves tool discovery and concurrent calls through Wrangler", async () => {
  const createdAt = "2026-01-02T03:04:05.000Z"
  const user = { id: 42, name: "Ada", email: "ada@example.test", createdAt }
  const paths: string[] = []
  const state = await mkdtemp(join(tmpdir(), "effect-mcp-test-"))
  const api = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const pathname = new URL(request.url).pathname.replace(/\/$/, "")
      paths.push(pathname)
      if (pathname === "/api/health") return Response.json({ status: "ok", timestamp: createdAt })
      if (pathname === "/api/users/42") return Response.json(user)
      return new Response(null, { status: 404 })
    },
  })

  try {
    const worker = Bun.spawn([
      "node", "node_modules/wrangler/bin/wrangler.js", "dev",
      "--ip", "127.0.0.1", "--port", "0", "--inspector-port", "0",
      "--persist-to", state,
      "--var", `API_URL:${api.url.origin}`, "--var", "LOCAL_USER_TOOLS:true",
    ], {
      cwd: app,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      stdout: "pipe",
      stderr: "inherit",
      timeout: 15_000,
    })

    try {
      const url = await waitForEndpoint(worker.stdout)
      const [status, first, second] = await Effect.runPromise(Effect.gen(function* () {
        const client = yield* McpClient.McpClient
        const tools = yield* client.listTools()
        const health = tools.find(({ name }) => name === "health")
        const getUser = tools.find(({ name }) => name === "get_user")
        if (!health || !getUser) return yield* Effect.die("Expected health and get_user in tool discovery")
        const callUser = () => client.callTool({ tool: getUser, arguments: { id: 42 }, schema: UserSchema })
        return yield* Effect.all([
          client.callTool({ tool: health, schema: Schema.toCodecJson(HealthResponseSchema) }),
          callUser(),
          callUser(),
        ], { concurrency: 3 })
      }).pipe(
        Effect.provide(McpClient.layerHttp({
          url, name: "mcp-test", version: "0.1.0", protocol: McpProtocol.v2026_07_28,
        })),
        Effect.provide(FetchHttpClient.layer),
        Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
        Effect.timeout("5 seconds"),
      ))
      expect(status.status).toBe("ok")
      expect(DateTime.formatIso(status.timestamp)).toBe(createdAt)
      expect([first, second]).toEqual([
        { ...user, createdAt: new Date(createdAt) },
        { ...user, createdAt: new Date(createdAt) },
      ])
      expect(paths.sort()).toEqual(["/api/health", "/api/users/42", "/api/users/42"])
    } finally {
      worker.kill()
      await worker.exited
    }
  } finally {
    await api.stop(true)
    await rm(state, { force: true, recursive: true })
  }
}, 20_000)
