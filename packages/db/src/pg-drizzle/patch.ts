/**
 * Drizzle ORM Effect Patch
 *
 * Makes Drizzle query objects yieldable in Effect.gen() generators.
 * This replaces the removed @effect/sql-drizzle package for Effect v4.
 *
 * @module
 */
import { Effect } from "effect"
import { pipeArguments } from "effect/Pipeable"
import { SingleShotGen } from "effect/Utils"
import { SqlError } from "effect/unstable/sql"
import { QueryPromise } from "drizzle-orm"
import { PgSelectBase } from "drizzle-orm/pg-core"

declare module "drizzle-orm" {
  export interface QueryPromise<T>
    extends Effect.Effect<T, SqlError.SqlError> {}
}

const proto = QueryPromise.prototype as any

proto[Symbol.iterator] = function () {
  return new SingleShotGen(this.asEffect())
}

proto.asEffect = function () {
  return Effect.tryPromise({
    try: () => this.execute(),
    catch: (cause) => new SqlError.SqlError({ cause })
  })
}

proto.pipe = function () {
  return pipeArguments(this.asEffect(), arguments)
}

const selectProto = PgSelectBase.prototype as any

selectProto[Symbol.iterator] = function () {
  return new SingleShotGen(this.asEffect())
}

selectProto.asEffect = function () {
  return Effect.tryPromise({
    try: () => this.execute(),
    catch: (cause) => new SqlError.SqlError({ cause })
  })
}

selectProto.pipe = function () {
  return pipeArguments(this.asEffect(), arguments)
}
