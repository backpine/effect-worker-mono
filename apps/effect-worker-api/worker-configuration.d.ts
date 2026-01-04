/**
 * Cloudflare Worker Environment Type
 *
 * Generated from wrangler.jsonc bindings.
 * Run `pnpm cf-typegen` to regenerate.
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
