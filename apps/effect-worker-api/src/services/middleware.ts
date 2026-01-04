/**
 * Middleware Implementations
 *
 * App-specific implementations of middleware defined in @repo/api.
 *
 * @module
 */
import { Effect, FiberRef, Layer } from "effect";
import {
  CloudflareBindingsMiddleware,
  CloudflareBindingsError,
  DatabaseMiddleware,
  DatabaseConnectionError,
} from "@repo/contracts";
import { currentEnv, currentCtx } from "@/services/cloudflare";
import { makeDrizzle } from "@repo/cloudflare";

/**
 * Live implementation of CloudflareBindingsMiddleware.
 *
 * Reads env/ctx from FiberRef and provides them as the CloudflareBindings service.
 */
export const CloudflareBindingsMiddlewareLive = Layer.effect(
  CloudflareBindingsMiddleware,
  Effect.gen(function* () {
    // Return the middleware effect (runs per-request)
    return Effect.gen(function* () {
      const env = yield* FiberRef.get(currentEnv);
      const ctx = yield* FiberRef.get(currentCtx);

      if (env === null || ctx === null) {
        return yield* Effect.fail(
          new CloudflareBindingsError({
            message:
              "Cloudflare bindings not available. Ensure withCloudflareBindings() wraps the handler.",
          }),
        );
      }

      return { env, ctx };
    });
  }),
);

/**
 * Live implementation of DatabaseMiddleware.
 *
 * Creates a scoped PgDrizzle instance per-request.
 * The connection is automatically closed when the request scope ends.
 */
export const DatabaseMiddlewareLive = Layer.effect(
  DatabaseMiddleware,
  Effect.gen(function* () {
    // Return the middleware effect (runs per-request)
    return Effect.gen(function* () {
      // Get connection string from Cloudflare env via FiberRef
      const env = yield* FiberRef.get(currentEnv);
      if (env === null) {
        return yield* Effect.fail(
          new DatabaseConnectionError({
            message:
              "Cloudflare env not available. Ensure withCloudflareBindings() wraps the handler.",
          }),
        );
      }

      return yield* makeDrizzle(env.HYPERDRIVE.connectionString);
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new DatabaseConnectionError({
            message: `Database connection failed: ${String(error)}`,
          }),
        ),
      ),
    );
  }),
);

/**
 * Combined middleware layer.
 */
export const MiddlewareLive = Layer.mergeAll(
  CloudflareBindingsMiddlewareLive,
  DatabaseMiddlewareLive,
);
