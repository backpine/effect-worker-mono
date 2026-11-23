import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { McpClient, McpProtocol, McpTest } from "effect/ai"
import { FetchHttpClient } from "effect/http"
import { makeRegistrations, makeWorker } from "../src/runtime"
import { makeApiClient } from "../src/services/api"

const origin = new URL("http://api.test")
const timestamp = "2026-01-02T03:04:05.000Z"
const user = { id: 42, name: "Ada", email: "ada@example.test", createdAt: timestamp }

const fetchWith = (respond: (request: Request) => Response | Promise<Response>) => Object.assign(
  async (...[input, init]: Parameters<typeof globalThis.fetch>) => respond(new Request(input, init)),
  { preconnect: globalThis.fetch.preconnect },
)

const withTools = <A, E>(
  run: (client: McpTest.Client) => Effect.Effect<A, E>,
  respond: (request: Request) => Response,
  localUserTools = true,
) => {
  const registrations = makeRegistrations(localUserTools).pipe(Layer.provide(makeApiClient(origin)))

  return Effect.runPromise(McpTest.makeClient(registrations, {
    protocols: [McpProtocol.v2026_07_28],
  }).pipe(
    Effect.flatMap(run),
    Effect.provideService(FetchHttpClient.Fetch, fetchWith(respond)),
    Effect.scoped,
  ))
}

test("advertises read-only tools and validates and encodes their HTTP results", async () => {
  const calls: string[] = []
  const { tools, health, userResult } = await withTools(
    (client) => Effect.gen(function* () {
      const { tools } = yield* client.listTools()
      const health = yield* client.callTool({ name: "health" })
      const userResult = yield* client.callTool({ name: "get_user", arguments: { id: 42 } })
      return { tools, health, userResult }
    }),
    (request) => {
      const { pathname } = new URL(request.url)
      calls.push(pathname)
      expect(request.method).toBe("GET")
      expect(request.redirect).toBe("manual")
      return Response.json(pathname.startsWith("/api/health") ? { status: "ok", timestamp } : user)
    },
  )
  expect(tools.map((tool) => tool.name).sort()).toEqual(["get_user", "health"])
  for (const tool of tools) {
    expect(tool.annotations?.readOnlyHint).toBe(true)
    expect(tool.inputSchema.type).toBe("object")
    expect(tool.outputSchema?.type).toBe("object")
  }
  expect(calls.map((pathname) => pathname.replace(/\/$/, ""))).toEqual(["/api/health", "/api/users/42"])
  expect(health.structuredContent).toEqual({ status: "ok", timestamp })
  expect(userResult.structuredContent).toEqual(user)
})

test("rejects invalid or unknown arguments before reaching the API", async () => {
  const calls: string[] = []
  const results = await withTools(
    (client) => Effect.all([
      client.callTool({ name: "get_user", arguments: { id: "42" } }),
      client.callTool({ name: "get_user", arguments: { id: 2147483648 } }),
      client.callTool({ name: "get_user", arguments: { id: 42, unexpected: true } }),
    ]),
    (request) => {
      calls.push(request.url)
      return Response.json(user)
    },
  )
  expect(results.map((result) => result.isError)).toEqual([true, true, true])
  expect(calls).toEqual([])
})

test("returns useful tool errors without including upstream error messages", async () => {
  const results = await withTools(
    (client) => Effect.all([
      client.callTool({ name: "get_user", arguments: { id: 43 } }),
      client.callTool({ name: "health" }),
    ]),
    (request) => new URL(request.url).pathname === "/api/users/43"
      ? Response.json({ _tag: "UserNotFoundError", id: 43, message: "internal details" }, { status: 404 })
      : new Response("internal details", { status: 503 }),
  )
  expect(results.map((result) => result.isError)).toEqual([true, true])
  expect(results.map((result) => result.content)).toEqual([
    [{ type: "text", text: "User not found: 43" }],
    [{ type: "text", text: "The API is unavailable." }],
  ])
})

test("registers health alone unless the local user tool is enabled", async () => {
  const names = await withTools(
    (client) => Effect.map(client.listTools(), ({ tools }) => tools.map(({ name }) => name)),
    () => { throw new Error("Discovery reached the API") },
    false,
  )
  expect(names).toEqual(["health"])
})

test("discovery hides the user tool when the configured API is remote", async () => {
  const worker = makeWorker({ apiUrl: origin.href, localUserTools: true })
  const fetch = fetchWith((request) => worker.fetch(request, {}, {
    waitUntil: () => {},
    passThroughOnException: () => {},
  }))
  const tools = await Effect.runPromise(McpClient.McpClient.use((client) => client.listTools()).pipe(
    Effect.provide(McpClient.layerHttp({
      url: "https://mcp.test/mcp", name: "mcp-test", version: "0.1.0", protocol: McpProtocol.v2026_07_28,
    })),
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, fetch),
    Effect.timeout("3 seconds"),
  ))
  expect(tools.map(({ name }) => name)).toEqual(["health"])
})
