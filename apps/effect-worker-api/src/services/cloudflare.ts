/**
 * Effectful Cloudflare bindings for this worker.
 *
 * Instantiates `@repo/cloudflare` with this project's typegen'd `Env` and the
 * `cloudflare:workers` `env`. Bindings become yieldable and type-safe (selectors
 * are checked against `Env`) — e.g. `yield* hyperdrive(e => e.HYPERDRIVE)`.
 *
 * @module
 */
import { env } from "cloudflare:workers"
import { makeCloudflare } from "@repo/cloudflare"

export const { hyperdrive } = makeCloudflare<Env>(() => env)
