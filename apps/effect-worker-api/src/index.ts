/**
 * Cloudflare Worker Entry Point
 *
 * Main entry point for the Cloudflare Worker HTTP API.
 *
 * @module
 */
import { pipe, Context } from "effect"
import { handler } from "@/runtime"
import { currentEnv, currentCtx } from "@/services/cloudflare"

/**
 * Cloudflare Worker fetch handler.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Pass per-request Cloudflare bindings via Context context
    const services = pipe(
      Context.make(currentEnv, env),
      Context.add(currentCtx, ctx)
    )

    return handler(request, services)
  }
} satisfies ExportedHandler<Env>
