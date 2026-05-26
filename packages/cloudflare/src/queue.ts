/**
 * Effectful Queue producer client.
 *
 * Wraps a native `Queue<T>` so `send`/`sendBatch` return `Effect`s with a tagged
 * `QueueError` — e.g. `client.send(msg).pipe(Effect.retry(...), Effect.timeout(...))`.
 *
 * @module
 */
import type {
  MessageSendRequest,
  Queue,
  QueueSendBatchOptions,
  QueueSendOptions,
} from "@cloudflare/workers-types"
import { Data, Effect } from "effect"

export class QueueError extends Data.TaggedError("QueueError")<{
  readonly message: string
  readonly cause: unknown
}> {}

export interface QueueClient<T> {
  send(message: T, options?: QueueSendOptions): Effect.Effect<void, QueueError>
  sendBatch(
    messages: Iterable<MessageSendRequest<T>>,
    options?: QueueSendBatchOptions,
  ): Effect.Effect<void, QueueError>
}

export const wrapQueue = <T>(raw: Queue<T>): QueueClient<T> => {
  const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, QueueError> =>
    Effect.tryPromise({
      try: run,
      catch: (cause) => new QueueError({ message: String(cause), cause }),
    })
  return {
    send: (message, options) => attempt(() => raw.send(message, options)),
    sendBatch: (messages, options) =>
      attempt(() => raw.sendBatch(messages, options)),
  }
}
