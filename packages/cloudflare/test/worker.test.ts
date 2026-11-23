import { Deferred, Effect, Stream } from "effect"
import { HttpServerResponse } from "effect/http"
import { expect, it, mock } from "bun:test"
import { Worker } from "../src"

const makeContext = () => ({
  waitUntil: mock((_promise: Promise<unknown>) => undefined),
  passThroughOnException: () => undefined,
})

const request = () => new Request("https://worker.test")

it("shares one cold build and supplies each request's own execution context", async () => {
  const ready = Deferred.makeUnsafe<void>()
  const finish = Deferred.makeUnsafe<void>()
  const firstContext = makeContext()
  const secondContext = makeContext()
  let builds = 0
  const worker = Worker.make(Effect.gen(function* () {
    builds++
    yield* Deferred.succeed(ready, undefined)
    yield* Deferred.await(finish)
    return {
      fetch: Effect.map(Worker.ExecutionContext, (ctx) =>
        HttpServerResponse.text(ctx === firstContext ? "first" : "second")
      ),
    }
  }))

  expect(builds).toBe(0)
  const first = worker.fetch(request(), {}, firstContext)
  await Effect.runPromise(Deferred.await(ready))
  const second = worker.fetch(request(), {}, secondContext)
  expect(builds).toBe(1)
  expect(firstContext.waitUntil).toHaveBeenCalledTimes(1)
  expect(secondContext.waitUntil).toHaveBeenCalledTimes(1)

  await Effect.runPromise(Deferred.succeed(finish, undefined))
  const responses = await Promise.all([first, second])
  expect(await Promise.all(responses.map((response) => response.text()))).toEqual(["first", "second"])
  await worker.fetch(request(), {}, makeContext())
  expect(builds).toBe(1)
})

it("releases resources from a failed build and retries initialization", async () => {
  let attempts = 0
  let releases = 0
  const worker = Worker.make(Effect.gen(function* () {
    const attempt = yield* Effect.acquireRelease(
      Effect.sync(() => ++attempts),
      () => Effect.sync(() => { releases++ }),
    )
    if (attempt === 1) return yield* Effect.fail(new Error("init failed"))
    return { fetch: Effect.succeed(HttpServerResponse.text("ready")) }
  }))

  await expect(worker.fetch(request(), {}, makeContext())).rejects.toThrow("init failed")
  expect(releases).toBe(1)
  expect(await (await worker.fetch(request(), {}, makeContext())).text()).toBe("ready")
  expect(attempts).toBe(2)
  expect(releases).toBe(1)
})

it("keeps the request scope open for the streamed response", async () => {
  const finish = Deferred.makeUnsafe<void>()
  const releases = Deferred.makeUnsafe<void>()
  const data = new TextEncoder().encode("stream")
  const worker = Worker.make(Effect.succeed({
    fetch: Effect.gen(function* () {
      yield* Effect.addFinalizer(() => Deferred.succeed(releases, undefined))
      return HttpServerResponse.stream(Stream.fromEffect(Deferred.await(finish).pipe(Effect.as(data))))
    }),
  }))

  const response = await worker.fetch(request(), {}, makeContext())
  expect(await Effect.runPromise(Deferred.isDone(releases))).toBe(false)
  await Effect.runPromise(Deferred.succeed(finish, undefined))
  expect(await response.text()).toBe("stream")
  await Effect.runPromise(Deferred.await(releases))
})
