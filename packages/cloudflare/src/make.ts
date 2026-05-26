/**
 * `makeCloudflare` — per-project effectful binding accessors.
 *
 * Each project calls this once with its typegen'd `Env` and a reader for the
 * `cloudflare:workers` `env`:
 *
 * ```ts
 * import { env } from "cloudflare:workers"
 * import { makeCloudflare } from "@repo/cloudflare"
 * export const { CloudflareEnv, r2, kv, queue, hyperdrive } = makeCloudflare<Env>(() => env)
 * ```
 *
 * `CloudflareEnv` is a `Context.Reference` whose default reads the worker `env`,
 * so accessors are yieldable anywhere with no wiring, and tests can override it
 * via `Effect.provideService(CloudflareEnv, fakeEnv)`.
 *
 * Accessors take a **selector** (`(env) => binding`) which is checked against the
 * typed `Env` — fully type-safe and cast-free.
 *
 * @module
 */
import type { KVNamespace, Queue, R2Bucket } from "@cloudflare/workers-types"
import { Context, Effect } from "effect"
import { wrapKV } from "./kv"
import { wrapQueue } from "./queue"
import { wrapR2 } from "./r2"

export const makeCloudflare = <Env>(read: () => Env) => {
  const CloudflareEnv = Context.Reference<Env>("@repo/cloudflare/Env", {
    defaultValue: read,
  })

  /** Yield a binding as-is (escape hatch / config bindings). */
  const binding = <B>(select: (env: Env) => B): Effect.Effect<B> =>
    Effect.map(CloudflareEnv, select)

  /** Yield an effectful R2 client. */
  const r2 = (select: (env: Env) => R2Bucket) =>
    Effect.map(CloudflareEnv, (env) => wrapR2(select(env)))

  /** Yield an effectful KV client. */
  const kv = (select: (env: Env) => KVNamespace) =>
    Effect.map(CloudflareEnv, (env) => wrapKV(select(env)))

  /** Yield an effectful Queue producer client. */
  const queue = <T>(select: (env: Env) => Queue<T>) =>
    Effect.map(CloudflareEnv, (env) => wrapQueue(select(env)))

  /**
   * Yield a connection binding (e.g. Hyperdrive). These expose connection
   * config rather than async methods; the effectful part is what you do with
   * the connection string (open a pool, run queries).
   */
  const hyperdrive = <H extends { readonly connectionString: string }>(
    select: (env: Env) => H,
  ): Effect.Effect<H> => Effect.map(CloudflareEnv, select)

  return { CloudflareEnv, binding, r2, kv, queue, hyperdrive }
}
