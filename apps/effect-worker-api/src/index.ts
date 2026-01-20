/**
 * Cloudflare Worker Entry Point
 *
 * Main entry point for the Cloudflare Worker HTTP API.
 *
 * @module
 */
import { runtime, handleRequest } from "@/runtime"
import { withCloudflareBindings } from "@/services"

/**
 * Cloudflare Worker fetch handler.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Handle request with Cloudflare bindings available via FiberRef
    const effect = handleRequest(request).pipe(withCloudflareBindings(env, ctx))

    return runtime.runPromise(effect)
  }
} satisfies ExportedHandler<Env>
