import { Context, Effect, Exit, Scheduler, Scope } from "effect"
import { HttpEffect, type HttpServerRequest, type HttpServerResponse } from "effect/http"

export interface ExecutionContextShape {
  readonly waitUntil: (promise: Promise<unknown>) => void
  readonly passThroughOnException: () => void
}

/** The Cloudflare context for the current request. */
export class ExecutionContext extends Context.Service<ExecutionContext, ExecutionContextShape>()(
  "@repo/cloudflare/ExecutionContext",
) {}

type RequestServices = HttpServerRequest.HttpServerRequest | Scope.Scope | ExecutionContext
type Fetch = Effect.Effect<HttpServerResponse.HttpServerResponse, unknown, RequestServices>
type WebHandler = (request: Request, context: Context.Context<ExecutionContext>) => Promise<Response>

/** Build the app once per isolate and give each request its own scope. */
export const make = (init: Effect.Effect<{ readonly fetch: Fetch }, unknown, Scope.Scope>) => {
  let initialized: Promise<WebHandler> | undefined

  const initialize = () => {
    const scope = Scope.makeUnsafe()
    const build = Scope.provide(init, scope).pipe(
      Effect.onError((cause) => Scope.close(scope, Exit.failCause(cause))),
    )

    // Init fibers can outlive the first request. Workerd drops that request's timers.
    return Effect.runPromise(build, { scheduler: new Scheduler.MixedScheduler("sync") })
      .then(({ fetch }) => HttpEffect.toWebHandlerWith<never, RequestServices>(Context.empty())(fetch))
      .catch((error: unknown) => {
        initialized = undefined
        throw error
      })
  }

  return {
    fetch(request: Request, _env: unknown, ctx: ExecutionContextShape): Promise<Response> {
      const handler = initialized ??= initialize()
      // Each cold-start request pins the shared work in its own invocation.
      ctx.waitUntil(handler.then(() => undefined, () => undefined))
      return handler.then((serve) => serve(request, Context.make(ExecutionContext, ctx)))
    },
  }
}
