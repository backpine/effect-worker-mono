import { Deferred, Effect, Layer } from "effect"
import { Database } from "@repo/db"
import { DatabaseConnectionError } from "@repo/domain"
import { expect, it, mock } from "bun:test"
import { makeWorker } from "../src/runtime"
import { env } from "./support/cloudflare-workers"

mock.module("cloudflare:workers", () => ({ env }))
const { default: worker } = await import("../src")

const ctx = {
  waitUntil: (_promise: Promise<unknown>) => undefined,
  passThroughOnException: () => undefined,
}

const request = (path: string, init?: RequestInit) => new Request(new URL(path, "https://api.test"), init)

it("serves liveness, OpenAPI, and router errors from the real entry without reading Hyperdrive", async () => {
  const get = (path: string) => worker.fetch(request(path), {}, ctx)
  const health = await get("/api/health")
  expect(health.status).toBe(200)
  expect(await health.json()).toMatchObject({ status: "ok", timestamp: expect.any(String) })

  const spec = await get("/api/openapi.json")
  expect(spec.status).toBe(200)
  expect(await spec.json()).toMatchObject({
    paths: {
      "/api/users": {
        get: { responses: { "503": expect.anything() } },
      },
    },
  })

  expect((await get("/api/missing")).status).toBe(404)
  expect((await get("/api/users/not-a-number")).status).toBe(400)
})

it("acquires and releases a separate database layer for each validated user request", async () => {
  const bothOpened = Deferred.makeUnsafe<void>()
  const finish = Deferred.makeUnsafe<void>()
  const closed: number[] = []
  let opened = 0
  const database = Layer.effect(
    Database,
    Effect.gen(function* () {
      const id = yield* Effect.acquireRelease(
        Effect.sync(() => ++opened),
        (id) => Effect.sync(() => { closed.push(id) }),
      )
      if (id === 2) yield* Deferred.succeed(bothOpened, undefined)
      yield* Deferred.await(finish)
      return yield* new DatabaseConnectionError({ message: "Database connection failed" })
    }),
  )
  const worker = makeWorker(database)

  expect(opened).toBe(0)
  expect((await worker.fetch(request("/api/health"), {}, ctx)).status).toBe(200)
  expect(opened).toBe(0)

  const list = worker.fetch(request("/api/users"), {}, ctx)
  const find = worker.fetch(request("/api/users/1"), {}, ctx)
  await Effect.runPromise(Deferred.await(bothOpened))
  expect(closed).toEqual([])

  await Effect.runPromise(Deferred.succeed(finish, undefined))
  const responses = await Promise.all([list, find])
  for (const response of responses) {
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      _tag: "DatabaseConnectionError",
      message: "Database connection failed",
    })
  }
  expect(opened).toBe(2)
  expect(closed.sort()).toEqual([1, 2])
})
