/**
 * Cloudflare Worker entry point — Effect RPC server
 *
 * Hosts the Effect `RpcServer` for the shared `UsersRpc` contract, served
 * alongside the React SPA by the Cloudflare Vite plugin. `wrangler.jsonc` routes
 * `/rpc` (and `/rpc/`) here via `assets.run_worker_first`; the SPA calls that
 * relative path (see `src/atoms/rpc.ts`).
 *
 * This follows the pattern Alchemy v2 uses for Effect-RPC-on-Cloudflare, minus the
 * framework. `RpcServer.toHttpEffect` turns the `RpcGroup` straight into the
 * request handler — an `Effect` that produces a per-request `HttpEffect`. There's
 * no `HttpRouter`, no path matching, no `HttpServer.layerServices`.
 *
 * Per request we mirror exactly what Alchemy's worker bridge does: flatten the
 * effect (fork the protocol server, then run the per-request app), provide the
 * incoming request as `HttpServerRequest`, run it in a fresh `Scope`, and convert
 * the `HttpServerResponse` back to a Web `Response`.
 *
 * @module
 */
import { Effect } from "effect"
import {
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http"
import { RpcServer, RpcSerialization } from "effect/unstable/rpc"
import { UsersRpc } from "@repo/contracts/rpc"
import { UsersHandlers } from "./users"
import { DatabaseRpcMiddlewareLive } from "./middleware"

/**
 * The RPC fetch handler, exactly as the Alchemy guide composes it: the RPC group
 * as an `HttpEffect`, with the handlers and JSON serialization (which must match
 * the client) provided. `Effect.flatten` runs the outer effect — forking the
 * protocol server — and then the per-request app it returns.
 */
const rpcApp = RpcServer.toHttpEffect(UsersRpc).pipe(
  Effect.flatten,
  Effect.provide(UsersHandlers),
  Effect.provide(DatabaseRpcMiddlewareLive),
  Effect.provide(RpcSerialization.layerJson),
)

export default {
  fetch(request: Request): Promise<Response> {
    return Effect.runPromise(
      rpcApp.pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(request),
        ),
        Effect.catchCause(() =>
          Effect.succeed(
            HttpServerResponse.text("Internal Server Error", { status: 500 }),
          ),
        ),
        Effect.scoped,
        Effect.map(HttpServerResponse.toWeb),
      ),
    )
  },
} satisfies ExportedHandler
