import { createServer } from "node:net"
import { Effect } from "effect"
import { expect, it } from "bun:test"
import { connect } from "../src/connect"

it("reports a dropped connection during acquisition", async () => {
  const listener = createServer((socket) => socket.destroy())
  try {
    await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve))
    const address = listener.address()
    if (address === null || typeof address === "string") throw new Error("Expected a TCP port")

    const connection = connect(`postgres://test:test@127.0.0.1:${address.port}/test`)
    const result = await Effect.runPromise(Effect.scoped(Effect.result(connection)))
    expect(result).toMatchObject({ _tag: "Failure", failure: { _tag: "SqlError" } })
  } finally {
    await new Promise<void>((resolve) => listener.close(() => resolve()))
  }
})
