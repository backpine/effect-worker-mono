import { Effect, Layer, ManagedRuntime } from "effect"
import { RpcClient, RpcClientError, RpcSerialization } from "effect/unstable/rpc"
import { FetchHttpClient } from "effect/unstable/http"
import { UsersRpc } from "@repo/contracts/rpc"

const RpcLayer = RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(FetchHttpClient.layer)
)

const runtime = ManagedRuntime.make(RpcLayer)

type Client = RpcClient.FromGroup<typeof UsersRpc, RpcClientError.RpcClientError>

export function rpc<A, E>(
  fn: (client: Client) => Effect.Effect<A, E>
): Promise<A> {
  const program = Effect.scoped(
    Effect.flatMap(RpcClient.make(UsersRpc), fn)
  )
  return runtime.runPromise(program)
}
