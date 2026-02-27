/**
 * Middleware Implementations
 *
 * App-specific implementations of middleware defined in @repo/contracts.
 *
 * In Effect v4, middleware with `provides` is a function that wraps the
 * httpEffect and provides the required service to it.
 *
 * @module
 */
import { Effect, Layer } from "effect";
import {
  CloudflareBindingsMiddleware,
  CloudflareBindingsError,
  CloudflareBindings,
  DatabaseMiddleware,
  DatabaseConnectionError,
} from "@repo/contracts";
import { PgDrizzle, makeDrizzle } from "@repo/db";
import { currentEnv, currentCtx } from "@/services/cloudflare";

/**
 * Live implementation of CloudflareBindingsMiddleware.
 *
 * Reads env/ctx from ServiceMap.Reference and provides CloudflareBindings
 * to the downstream handler effect.
 */
export const CloudflareBindingsMiddlewareLive = Layer.succeed(
  CloudflareBindingsMiddleware,
  (httpEffect) =>
    Effect.gen(function* () {
      const env = yield* currentEnv;
      const ctx = yield* currentCtx;

      if (env === null || ctx === null) {
        return yield* Effect.fail(
          new CloudflareBindingsError({
            message:
              "Cloudflare bindings not available. Ensure withCloudflareBindings() wraps the handler.",
          }),
        );
      }

      return yield* httpEffect.pipe(
        Effect.provideService(CloudflareBindings, { env, ctx }),
      );
    }),
);

/**
 * Live implementation of DatabaseMiddleware.
 *
 * Creates a scoped PgDrizzle instance per-request and provides it
 * to the downstream handler effect.
 */
export const DatabaseMiddlewareLive = Layer.succeed(
  DatabaseMiddleware,
  (httpEffect) =>
    Effect.gen(function* () {
      const env = yield* currentEnv;
      if (env === null) {
        return yield* Effect.fail(
          new DatabaseConnectionError({
            message:
              "Cloudflare env not available. Ensure withCloudflareBindings() wraps the handler.",
          }),
        );
      }

      const db = yield* makeDrizzle(env.HYPERDRIVE.connectionString);

      return yield* httpEffect.pipe(
        Effect.provideService(PgDrizzle, db),
      );
    }).pipe(
      Effect.catch(() =>
        Effect.fail(
          new DatabaseConnectionError({
            message: "Database connection failed",
          }),
        ),
      ),
    ),
);

/**
 * Combined middleware layer.
 */
export const MiddlewareLive = Layer.mergeAll(
  CloudflareBindingsMiddlewareLive,
  DatabaseMiddlewareLive,
);
