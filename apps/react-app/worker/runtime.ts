import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { RpcSerialization, RpcServer } from "effect/rpc"
import { Worker } from "@repo/cloudflare"
import { UsersRpc } from "@repo/contracts/rpc"
import type { Database } from "@repo/db/database"
import type { DatabaseConnectionError } from "@repo/domain"
import { makeUsersHandlers } from "./handlers/users"

/** Initialize the router and RPC server once per isolate. */
export const makeWorker = (database: Layer.Layer<Database, DatabaseConnectionError>) =>
  Worker.make(
    HttpRouter.toHttpEffect(
      RpcServer.layerHttp({ group: UsersRpc, path: "/rpc", protocol: "http" }).pipe(
        Layer.provide([
          makeUsersHandlers(database),
          RpcSerialization.layerJson,
          HttpServer.layerServices,
        ]),
      ),
    ).pipe(Effect.map((fetch) => ({ fetch }))),
  )
