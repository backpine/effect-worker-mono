/**
 * Cloudflare Bindings Service
 *
 * A typed, non-nullable service holding the current request's Cloudflare `env`
 * and `ExecutionContext`. It is provided once per request at the worker entry
 * point (`index.ts`), so handlers and middleware read `env`/`ctx` directly —
 * no nullable `Context.Reference` bridge, no null checks, and no casting (the
 * `env` is the worker's generated `Env` type).
 *
 * @module
 */
import { Context } from "effect"

export class Bindings extends Context.Service<
  Bindings,
  {
    readonly env: Env
    readonly ctx: ExecutionContext
  }
>()("@app/api/Bindings") {}
