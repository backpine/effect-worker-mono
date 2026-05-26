/**
 * Effectful KV namespace client.
 *
 * Wraps a native `KVNamespace` so every operation returns an `Effect` with a
 * tagged `KVError` channel — composable with retry/timeout/catchTag like any
 * other Effect.
 *
 * @module
 */
import type {
  KVNamespace,
  KVNamespaceListOptions,
  KVNamespaceListResult,
  KVNamespacePutOptions,
} from "@cloudflare/workers-types"
import { Data, Effect } from "effect"

export class KVError extends Data.TaggedError("KVError")<{
  readonly message: string
  readonly cause: unknown
}> {}

export interface KVClient {
  /** Read a string value (null if absent). */
  get(key: string): Effect.Effect<string | null, KVError>
  /** Read and JSON-parse a value (null if absent). */
  getJson<T>(key: string): Effect.Effect<T | null, KVError>
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView,
    options?: KVNamespacePutOptions,
  ): Effect.Effect<void, KVError>
  delete(key: string): Effect.Effect<void, KVError>
  list(
    options?: KVNamespaceListOptions,
  ): Effect.Effect<KVNamespaceListResult<unknown, string>, KVError>
}

export const wrapKV = (raw: KVNamespace): KVClient => {
  const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, KVError> =>
    Effect.tryPromise({
      try: run,
      catch: (cause) => new KVError({ message: String(cause), cause }),
    })
  return {
    get: (key) => attempt(() => raw.get(key)),
    getJson: <T>(key: string) => attempt(() => raw.get<T>(key, "json")),
    put: (key, value, options) => attempt(() => raw.put(key, value, options)),
    delete: (key) => attempt(() => raw.delete(key)),
    list: (options) => attempt(() => raw.list(options)),
  }
}
