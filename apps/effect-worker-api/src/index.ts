/**
 * Cloudflare Worker Entry Point
 *
 * Main entry point for the Cloudflare Worker HTTP API.
 *
 * @module
 */
import { runtime, handleRequest, openApiSpec } from "./runtime.js"
import { withCloudflareBindings } from "@/services"

/**
 * Cloudflare Worker fetch handler.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // Serve OpenAPI spec at /api/openapi.json
    if (url.pathname === "/api/openapi.json") {
      return Response.json(openApiSpec)
    }

    // HTTP REST API
    // Handle request with Cloudflare bindings available via FiberRef
    const effect = handleRequest(request).pipe(withCloudflareBindings(env, ctx))

    return runtime.runPromise(effect)
  }
} satisfies ExportedHandler<Env>
