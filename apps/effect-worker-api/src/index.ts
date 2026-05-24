/**
 * Cloudflare Worker entry point — Effect HTTP API
 *
 * Same shape as the RPC worker (`apps/react-app/worker`): the API is an
 * `HttpEffect` (built in `runtime.ts` via `HttpRouter.toHttpEffect`), and per
 * request we flatten it, provide the typed Cloudflare `Bindings` and the
 * incoming request as `HttpServerRequest`, run it in a fresh `Scope`, and
 * convert the `HttpServerResponse` to a Web `Response`. No nullable env/ctx
 * bridge, no `HttpRouter.toWebHandler` ceremony, no casting.
 *
 * @module
 */
import { Effect } from "effect"
import {
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http"
import { apiApp } from "@/runtime"
import { Bindings } from "@/services"

export default {
  fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return Effect.runPromise(
      apiApp.pipe(
        Effect.flatten,
        Effect.provideService(Bindings, { env, ctx }),
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
} satisfies ExportedHandler<Env>
