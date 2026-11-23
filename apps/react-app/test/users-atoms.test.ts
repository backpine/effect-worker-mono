import { expect, it, spyOn } from "bun:test"
import { Effect, Schema } from "effect"
import { AtomRegistry, type AsyncResult, type Atom } from "effect/reactivity"
import { CreateUserSchema } from "@repo/domain"
import { createUserAtom, usersAtom } from "../src/atoms"

const RequestId = Schema.Union([Schema.Number, Schema.String])
const decodeCall = Schema.decodeUnknownSync(Schema.Union([
  Schema.Struct({ id: RequestId, tag: Schema.Literal("listUsers") }),
  Schema.Struct({ id: RequestId, tag: Schema.Literal("createUser"), payload: CreateUserSchema }),
]))

it("refreshes the mounted users query only after a successful create", async () => {
  const registry = AtomRegistry.make()
  const payload = { email: "grace@example.com", name: "Grace" }
  const user = { ...payload, id: 1, createdAt: "2026-01-02T03:04:05.000Z" }
  const calls: string[] = []
  let created = false

  // The app uses a relative RPC URL, so give Bun a browser origin for this test.
  const location = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: new URL("https://atom.test/"),
  })
  const mockFetch = async (...[input, init]: Parameters<typeof globalThis.fetch>) => {
    const request = new Request(input, init)
    expect(request.url).toBe("https://atom.test/rpc/")
    const call = decodeCall(await request.json())
    calls.push(call.tag)

    const reply = (exit: unknown) => Response.json([{ _tag: "Exit", requestId: call.id, exit }])
    if (call.tag === "listUsers") {
      return reply({ _tag: "Success", value: created ? { users: [user], total: 1 } : { users: [], total: 0 } })
    }

    expect(call.payload).toEqual(payload)
    if (created) {
      return reply({
        _tag: "Failure",
        cause: [{ _tag: "Fail", error: { _tag: "UserCreationError", ...payload } }],
      })
    }

    created = true
    return reply({ _tag: "Success", value: user })
  }
  const fetch = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(mockFetch, { preconnect: globalThis.fetch.preconnect }),
  )

  const settled = <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) =>
    AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }).pipe(Effect.timeout("2 seconds"))

  try {
    registry.mount(usersAtom)
    registry.mount(createUserAtom)
    expect(await Effect.runPromise(settled(usersAtom))).toEqual({ users: [], total: 0 })

    registry.set(createUserAtom, payload)
    expect(await Effect.runPromise(settled(createUserAtom))).toEqual({
      ...user,
      createdAt: new Date(user.createdAt),
    })
    const refreshed = await Effect.runPromise(settled(usersAtom))
    expect(refreshed).toEqual({ users: [{ ...user, createdAt: new Date(user.createdAt) }], total: 1 })

    registry.set(createUserAtom, payload)
    expect(await Effect.runPromise(Effect.result(settled(createUserAtom)))).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "UserCreationError", ...payload },
    })
    expect(await Effect.runPromise(settled(usersAtom))).toEqual(refreshed)
    expect(calls).toEqual(["listUsers", "createUser", "listUsers", "createUser"])
  } finally {
    registry.dispose()
    fetch.mockRestore()
    if (location) Object.defineProperty(globalThis, "location", location)
    else Reflect.deleteProperty(globalThis, "location")
  }
})
