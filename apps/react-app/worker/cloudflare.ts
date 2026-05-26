/**
 * Effectful Cloudflare bindings for the RPC worker.
 *
 * Instantiates `@repo/cloudflare` with this worker's typegen'd `Env` and the
 * `cloudflare:workers` `env`, so bindings (e.g. Hyperdrive) are yieldable and
 * type-safe. `CloudflareEnv` defaults to the worker `env`.
 *
 * @module
 */
import { env } from "cloudflare:workers"
import { makeCloudflare } from "@repo/cloudflare"

export const { CloudflareEnv, hyperdrive } = makeCloudflare<Env>(() => env)
