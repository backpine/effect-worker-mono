/**
 * @repo/cloudflare — effectful, type-safe Cloudflare bindings.
 *
 * Keeps the wrangler.jsonc + `wrangler types` workflow (the typed `env` from
 * `cloudflare:workers`) and adds an Effect SDK on top: bindings become yieldable,
 * error-typed, and composable. No infra/provisioning coupling.
 *
 * @module
 */
export { makeCloudflare } from "./make"

export { wrapR2, R2Error } from "./r2"
export type { R2Client, R2Body } from "./r2"

export { wrapKV, KVError } from "./kv"
export type { KVClient } from "./kv"

export { wrapQueue, QueueError } from "./queue"
export type { QueueClient } from "./queue"
