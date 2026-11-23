import { expect, it } from "bun:test"
import { BunServices } from "@effect/platform-bun"
import { Cause, ConfigProvider, Effect, Exit, Fiber, Runtime, Schema } from "effect"
import { FetchHttpClient } from "effect/http"
import { TestClock, TestConsole } from "effect/testing"
import { runCli } from "../src/program"

const origin = "http://api.test"
const timestamp = "2026-01-02T03:04:05.000Z"
const payload = { email: "ada@example.com", name: "Ada" }
const user = { ...payload, id: 42, createdAt: timestamp }

const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))
const jsonOutput = (lines: ReadonlyArray<unknown>) => {
  expect(lines).toHaveLength(1)
  return decodeJson(lines[0])
}

const commandResult = (
  args: ReadonlyArray<string>,
  options: {
    readonly env?: Record<string, string>
    readonly respond?: (request: Request, attempt: number) => Response | Promise<Response>
  } = {},
) => {
  const requests: Request[] = []
  const fetch = Object.assign(
    async (...[input, init]: Parameters<typeof globalThis.fetch>) => {
      const request = new Request(input, init)
      requests.push(request)
      if (!options.respond) throw new Error("Unexpected request")
      return options.respond(request, requests.length)
    },
    { preconnect: globalThis.fetch.preconnect },
  )

  return Effect.gen(function* () {
    const exit = yield* Effect.exit(runCli(args))
    return {
      code: Exit.isSuccess(exit) ? 0 : Runtime.getErrorExitCode(Cause.squash(exit.cause)),
      stdout: yield* TestConsole.logLines,
      stderr: yield* TestConsole.errorLines,
      requests,
    }
  }).pipe(
    Effect.provide([BunServices.layer, TestConsole.layer]),
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(options.env ?? {}))),
    Effect.provideService(FetchHttpClient.Fetch, fetch),
  )
}

const invoke = (...args: Parameters<typeof commandResult>) => Effect.runPromise(commandResult(...args))

it("validates create flags and user IDs before making a request", async () => {
  const env = { API_URL: origin }
  const invalidEmail = await invoke(["users", "create", "--email", "bad", "--name", "Ada", "--json"], { env })
  expect(invalidEmail.code).toBe(2)
  expect(invalidEmail.stdout).toEqual([])
  expect(invalidEmail.stderr.join("\n")).toContain("Invalid email format")
  expect(invalidEmail.requests).toEqual([])

  const invalidId = await invoke(["users", "get", "2147483648"], { env })
  expect(invalidId.code).toBe(2)
  expect(invalidId.requests).toEqual([])
})

it("requires a valid API origin for requests and gives the flag precedence", async () => {
  const missing = await invoke(["health"])
  expect(missing.code).toBe(2)
  expect(missing.stderr.join("\n")).toContain("API_URL")
  expect(missing.requests).toEqual([])

  const invalid = await invoke(["health", "--api-url", "http://name:example-password@api.test", "--json"])
  expect(invalid.code).toBe(2)
  expect(invalid.stdout).toEqual([])
  expect(invalid.stderr.join("\n")).not.toContain("example-password")
  expect(invalid.requests).toEqual([])

  const result = await invoke(["health", "--api-url", origin, "--json"], {
    env: { API_URL: "http://ignored.test/api" },
    respond: () => Response.json({ status: "ok", timestamp }),
  })
  expect(result.code).toBe(0)
  expect(result.requests.map(({ url }) => new URL(url).origin)).toEqual([origin])
  expect(result.requests.map(({ url }) => new URL(url).pathname.replace(/\/$/, ""))).toEqual(["/api/health"])
  expect(jsonOutput(result.stdout)).toEqual({ status: "ok", timestamp })
  expect(result.stderr).toEqual([])
})

it("encodes create and get requests and prints replies through their contract schemas", async () => {
  const env = { API_URL: origin }
  const created = await invoke(["users", "create", "--name", payload.name, "--email", payload.email, "--json"], {
    env,
    respond: () => Response.json(user),
  })
  const [createRequest] = created.requests
  expect(created.code).toBe(0)
  expect(createRequest?.method).toBe("POST")
  expect(createRequest?.url).toBe(`${origin}/api/users`)
  expect(await createRequest?.json()).toEqual(payload)
  expect(jsonOutput(created.stdout)).toEqual(user)
  expect(created.stderr).toEqual([])

  const found = await invoke(["users", "get", "42", "--json"], { env, respond: () => Response.json(user) })
  expect(found.code).toBe(0)
  expect(found.requests.map(({ url }) => url)).toEqual([`${origin}/api/users/42`])
  expect(jsonOutput(found.stdout)).toEqual(user)
})

it("retries transient reads and sends a create once even when the API is unavailable", async () => {
  const env = { API_URL: origin }
  const unavailable = () => Response.json({
    _tag: "DatabaseConnectionError",
    message: "Database connection failed",
  }, { status: 503 })
  const listed = await invoke(["users", "list", "--json"], {
    env,
    respond: (_, attempt) => attempt === 1 ? unavailable() : Response.json({ users: [user], total: 1 }),
  })
  expect(listed.code).toBe(0)
  expect(listed.requests.map(({ method }) => method)).toEqual(["GET", "GET"])
  expect(jsonOutput(listed.stdout)).toEqual({ users: [user], total: 1 })

  const created = await invoke(["users", "create", "--name", payload.name, "--email", payload.email, "--json"], {
    env,
    respond: unavailable,
  })
  expect(created.code).toBe(5)
  expect(created.requests.map(({ method }) => method)).toEqual(["POST"])
  expect(created.stdout).toEqual([])
  expect(created.stderr).toEqual(["The API could not connect to the database."])
})

it("aborts a request at the command deadline", async () => {
  const result = await Effect.runPromise(Effect.gen(function* () {
    const command = yield* commandResult(["health", "--json"], {
      env: { API_URL: origin },
      respond: (request) => new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true })
      }),
    }).pipe(Effect.forkChild({ startImmediately: true }))
    yield* TestClock.adjust("10 seconds")
    return yield* Fiber.join(command)
  }).pipe(Effect.provide(TestClock.layer())))

  expect(result.code).toBe(5)
  expect(result.requests.map(({ signal }) => signal.aborted)).toEqual([true])
  expect(result.stdout).toEqual([])
  expect(result.stderr).toEqual(["The API request timed out."])
})

it("reports declared failures on stderr with stable exit codes", async () => {
  const env = { API_URL: origin }
  const missing = await invoke(["users", "get", "42", "--json"], {
    env,
    respond: () => Response.json({ _tag: "UserNotFoundError", id: 42, message: "User not found: 42" }, {
      status: 404,
    }),
  })
  expect(missing.code).toBe(3)
  expect(missing.requests).toHaveLength(1)
  expect(missing.stdout).toEqual([])
  expect(missing.stderr).toEqual(["User not found."])

  const rejected = await invoke(["users", "create", "--name", payload.name, "--email", payload.email], {
    env,
    respond: () => Response.json({ _tag: "UserCreationError", ...payload }, { status: 400 }),
  })
  expect(rejected.code).toBe(4)
  expect(rejected.stdout).toEqual([])
  expect(rejected.stderr).toEqual(["The API rejected the request."])
})

it("reports a problem response from API middleware through the same error path", async () => {
  const result = await invoke(["users", "list", "--json"], {
    env: { API_URL: origin },
    respond: () => Response.json({ type: "about:blank", status: 500, title: "Internal Server Error" }, {
      status: 500,
      headers: { "content-type": "application/problem+json" },
    }),
  })
  expect(result.code).toBe(5)
  expect(result.requests).toHaveLength(2)
  expect(result.stdout).toEqual([])
  expect(result.stderr).toEqual(["The API is unavailable. Try again later."])
})

it("rejects an incompatible response before writing JSON", async () => {
  const result = await invoke(["users", "get", "42", "--json"], {
    env: { API_URL: origin },
    respond: () => Response.json({ ...user, createdAt: "invalid" }),
  })
  expect(result.code).toBe(1)
  expect(result.stdout).toEqual([])
  expect(result.stderr).toEqual(["The API response did not match the contract."])
})
