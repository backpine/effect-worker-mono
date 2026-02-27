/**
 * Cloudflare Worker Entry Point
 *
 * Main entry point for the Cloudflare Worker RPC API.
 *
 * @module
 */
import { pipe, ServiceMap } from "effect"
import { rpcHandler } from "@/runtime"
import { currentEnv, currentCtx } from "@/services/cloudflare"

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

    // Pass per-request Cloudflare bindings via ServiceMap context
    const services = pipe(
      ServiceMap.make(currentEnv, env),
      ServiceMap.add(currentCtx, ctx)
    )

    return rpcHandler(request, services)
  }
} satisfies ExportedHandler<Env>
