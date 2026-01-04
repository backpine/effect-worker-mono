/**
 * Cloudflare Worker Environment Interface
 *
 * This file defines the type of bindings available in the Cloudflare Worker.
 * Run `pnpm cf-typegen` to regenerate based on wrangler.jsonc.
 */

interface Env {
  // Environment variables
  ENVIRONMENT: string
  LOG_LEVEL: string
  DATABASE_URL?: string

  // KV Namespace
  MY_KV: KVNamespace

  // R2 Bucket
  MY_BUCKET: R2Bucket

  // Hyperdrive
  HYPERDRIVE: Hyperdrive
}
