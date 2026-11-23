import { expect, it } from "bun:test"
import { Deferred, Effect, Layer, Stream } from "effect"
import { Reactivity } from "effect/reactivity"
import { SqlClient, type SqlConnection, Statement } from "effect/sql"
import { Database } from "@repo/db/database"
import { DatabaseConnectionError } from "@repo/domain"
import { makeWorker } from "../worker/runtime"

const ctx = {
  waitUntil: (_promise: Promise<unknown>) => undefined,
  passThroughOnException: () => undefined,
}

const rpc = (id: string, tag: string, payload: unknown) =>
  ({ _tag: "Request", id, tag, payload, headers: [] })

const request = (path: string, calls: ReadonlyArray<ReturnType<typeof rpc>>, signal?: AbortSignal) =>
  new Request(new URL(path, "https://rpc.test"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(calls),
    signal,
  })

const clientWithQuery = (query: Effect.Effect<ReadonlyArray<object>>) => {
  const unexpected = () => Effect.die(new Error("Expected a row query"))
  const connection: SqlConnection.Connection = {
    execute: () => query,
    executeRaw: unexpected,
    executeStream: () => Stream.die(new Error("Expected a row query")),
    executeUnprepared: unexpected,
    executeValues: unexpected,
    executeValuesUnprepared: unexpected,
  }

  return SqlClient.make({
    acquirer: Effect.succeed(connection),
    compiler: Statement.makeCompilerSqlite(),
    driver: "test",
    spanAttributes: [],
  }).pipe(Effect.provide(Reactivity.layer))
}

it("routes RPC POSTs and rejects invalid payloads before opening Postgres", async () => {
  let opened = 0
  const database = Layer.effect(Database, Effect.sync(() => {
    opened++
    throw new Error("Unexpected database acquisition")
  }))
  const worker = makeWorker(database)

  const wrongMethod = await worker.fetch(new Request("https://rpc.test/rpc"), {}, ctx)
  const wrongPath = await worker.fetch(request("/other", [rpc("1", "listUsers", null)]), {}, ctx)
  expect(wrongMethod.status).toBe(404)
  expect(wrongPath.status).toBe(404)

  const invalid = await worker.fetch(request("/rpc", [
    rpc("2", "createUser", { email: "invalid", name: "Grace" }),
    rpc("3", "createUser", { email: "grace@example.com", name: "" }),
    rpc("4", "getUser", { id: "1" }),
    rpc("5", "unknown", null),
  ]), {}, ctx)

  expect(invalid.status).toBe(200)
  expect(await invalid.json()).toEqual(["2", "3", "4", "5"].map((requestId) =>
    expect.objectContaining({
      _tag: "Exit",
      requestId,
      exit: { _tag: "Failure", cause: [{ _tag: "Die", defect: expect.any(String) }] },
    })
  ))
  expect(opened).toBe(0)
})

it("opens and releases a distinct connection for each overlapping call and batched call", async () => {
  const allOpened = Deferred.makeUnsafe<void>()
  const finish = Deferred.makeUnsafe<void>()
  const closed: number[] = []
  let opened = 0
  const user = { id: 1, name: "Grace", email: "grace@example.com", createdAt: new Date(0) }
  const database = Layer.effect(Database, Effect.gen(function* () {
    const id = yield* Effect.acquireRelease(
      Effect.sync(() => ++opened),
      (id) => Effect.sync(() => { closed.push(id) }),
    )
    if (id === 3) yield* Deferred.succeed(allOpened, undefined)
    yield* Deferred.await(finish)
    return yield* clientWithQuery(Effect.succeed([user]))
  }))
  const worker = makeWorker(database)
  expect(opened).toBe(0)

  const batch = worker.fetch(request("/rpc", [rpc("1", "listUsers", null), rpc("2", "listUsers", null)]), {}, ctx)
  const single = worker.fetch(request("/rpc/", [rpc("3", "getUser", { id: 1 })]), {}, ctx)
  await Effect.runPromise(Deferred.await(allOpened))
  expect(closed).toEqual([])

  await Effect.runPromise(Deferred.succeed(finish, undefined))
  const [batchResponse, singleResponse] = await Promise.all([batch, single])
  const wireUser = { ...user, createdAt: user.createdAt.toISOString() }
  const listResult = { _tag: "Success", value: { users: [wireUser], total: 1 } }
  expect(batchResponse.status).toBe(200)
  expect(await batchResponse.json()).toEqual(expect.arrayContaining([
    { _tag: "Exit", requestId: "1", exit: listResult },
    { _tag: "Exit", requestId: "2", exit: listResult },
  ]))
  expect(singleResponse.status).toBe(200)
  expect(await singleResponse.json()).toEqual([
    { _tag: "Exit", requestId: "3", exit: { _tag: "Success", value: wireUser } },
  ])
  expect(opened).toBe(3)
  expect(closed.sort()).toEqual([1, 2, 3])
})

it("encodes acquisition failures on all database-backed procedures and releases resources", async () => {
  const error = new DatabaseConnectionError({ message: "Database connection failed" })
  let closed = 0
  const database = Layer.effect(Database, Effect.gen(function* () {
    yield* Effect.acquireRelease(Effect.void, () => Effect.sync(() => { closed++ }))
    return yield* error
  }))
  const worker = makeWorker(database)

  const response = await worker.fetch(request("/rpc", [
    rpc("1", "listUsers", null),
    rpc("2", "getUser", { id: 1 }),
    rpc("3", "createUser", { email: "grace@example.com", name: "Grace" }),
  ]), {}, ctx)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(expect.arrayContaining(["1", "2", "3"].map((requestId) => ({
    _tag: "Exit",
    requestId,
    exit: {
      _tag: "Failure",
      cause: [{ _tag: "Fail", error: { _tag: "DatabaseConnectionError", message: error.message } }],
    },
  }))))
  expect(closed).toBe(3)
})

it("releases the connection when an in-flight RPC request is aborted", async () => {
  const querying = Deferred.makeUnsafe<void>()
  const released = Deferred.makeUnsafe<void>()
  const database = Layer.effect(Database, Effect.gen(function* () {
    yield* Effect.acquireRelease(Effect.void, () => Deferred.succeed(released, undefined))
    return yield* clientWithQuery(Effect.andThen(Deferred.succeed(querying, undefined), Effect.never))
  }))
  const worker = makeWorker(database)
  const abort = new AbortController()
  const response = worker.fetch(request("/rpc", [rpc("1", "listUsers", null)], abort.signal), {}, ctx)

  await Effect.runPromise(Deferred.await(querying))
  expect(await Effect.runPromise(Deferred.isDone(released))).toBe(false)
  abort.abort()

  expect((await response).status).toBe(499)
  await Effect.runPromise(Deferred.await(released))
})
