import { Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { AtomRpc } from "effect/reactivity"
import { RpcClient, RpcSerialization } from "effect/rpc"
import { UsersRpc } from "@repo/contracts/rpc"

export class UsersClient extends AtomRpc.Service<UsersClient>()("@repo/react-app/UsersClient", {
  group: UsersRpc,
  protocol: RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
    Layer.provide([RpcSerialization.layerJson, FetchHttpClient.layer]),
  ),
}) {}
