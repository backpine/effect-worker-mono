/**
 * Cloudflare Worker Entry Point
 *
 * Main entry point for the Cloudflare Worker RPC API.
 *
 * @module
 */
import { rpcRuntime, handleRpcRequest } from "./runtime.js"
import { withCloudflareBindings } from "./services/index.js"

/**
 * Cloudflare Worker fetch handler.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // Health check endpoint
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "effect-worker-rpc" })
    }

    // RPC endpoint
    if (url.pathname === "/rpc") {
      const effect = handleRpcRequest(request).pipe(withCloudflareBindings(env, ctx))
      return rpcRuntime.runPromise(effect)
    }

    // Not found
    return new Response("Not Found", { status: 404 })
  }
} satisfies ExportedHandler<Env>
