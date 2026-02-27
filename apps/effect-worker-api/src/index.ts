/**
 * Cloudflare Worker Entry Point
 *
 * Main entry point for the Cloudflare Worker HTTP API.
 *
 * @module
 */
import { pipe, ServiceMap } from "effect"
import { handler } from "@/runtime"
import { currentEnv, currentCtx } from "@/services/cloudflare"

/**
 * Cloudflare Worker fetch handler.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Pass per-request Cloudflare bindings via ServiceMap context
    const services = pipe(
      ServiceMap.make(currentEnv, env),
      ServiceMap.add(currentCtx, ctx)
    )

    return handler(request, services)
  }
} satisfies ExportedHandler<Env>
