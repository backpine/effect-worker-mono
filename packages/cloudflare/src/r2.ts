/**
 * Effectful R2 bucket client.
 *
 * Wraps a native `R2Bucket` so every operation returns an `Effect` with a tagged
 * `R2Error`. Object bodies returned by `get` expose `text`/`json`/`arrayBuffer`
 * as Effects too, so the whole flow stays in Effect.
 *
 * @module
 */
import type {
  R2GetOptions,
  R2ListOptions,
  R2Object,
  R2ObjectBody,
  R2Objects,
  R2PutOptions,
  R2Bucket as Native,
} from "@cloudflare/workers-types"
import { Data, Effect } from "effect"

export class R2Error extends Data.TaggedError("R2Error")<{
  readonly message: string
  readonly cause: unknown
}> {}

/** An R2 object whose body readers are Effects. */
export interface R2Body {
  /** The underlying native object (metadata: key, size, etag, …). */
  readonly object: R2ObjectBody
  text(): Effect.Effect<string, R2Error>
  json<T>(): Effect.Effect<T, R2Error>
  arrayBuffer(): Effect.Effect<ArrayBuffer, R2Error>
}

export interface R2Client {
  head(key: string): Effect.Effect<R2Object | null, R2Error>
  get(
    key: string,
    options?: R2GetOptions,
  ): Effect.Effect<R2Body | null, R2Error>
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView,
    options?: R2PutOptions,
  ): Effect.Effect<R2Object | null, R2Error>
  delete(keys: string | string[]): Effect.Effect<void, R2Error>
  list(options?: R2ListOptions): Effect.Effect<R2Objects, R2Error>
}

export const wrapR2 = (raw: Native): R2Client => {
  const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, R2Error> =>
    Effect.tryPromise({
      try: run,
      catch: (cause) => new R2Error({ message: String(cause), cause }),
    })

  const wrapBody = (object: R2ObjectBody): R2Body => ({
    object,
    text: () => attempt(() => object.text()),
    json: <T>() => attempt(() => object.json<T>()),
    arrayBuffer: () => attempt(() => object.arrayBuffer()),
  })

  return {
    head: (key) => attempt(() => raw.head(key)),
    get: (key, options) =>
      attempt(() => raw.get(key, options)).pipe(
        Effect.map((object) => (object ? wrapBody(object) : null)),
      ),
    put: (key, value, options) => attempt(() => raw.put(key, value, options)),
    delete: (keys) => attempt(() => raw.delete(keys)),
    list: (options) => attempt(() => raw.list(options)),
  }
}
