import { Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { RpcClient, RpcSerialization } from "effect/unstable/rpc"
import * as Atom from "effect/unstable/reactivity/Atom"

const RpcLayer = RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(FetchHttpClient.layer),
)

export const rpcRuntime = Atom.runtime(RpcLayer)
