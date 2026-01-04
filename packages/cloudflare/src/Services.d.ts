/**
 * Service Tags
 *
 * Context tags for Cloudflare Worker services.
 * These are shared between HTTP and RPC middleware.
 *
 * @module
 */
import { Context } from "effect";
import type { WorkerExecutionContext } from "./FiberRef.js";
declare const CloudflareBindings_base: Context.TagClass<CloudflareBindings, "@backpine/cloudflare/CloudflareBindings", {
    readonly env: unknown;
    readonly ctx: WorkerExecutionContext;
}>;
/**
 * CloudflareBindings service provides access to Cloudflare's env and ctx.
 *
 * Apps should cast the `env` to their specific Env type when accessing:
 *
 * ```typescript
 * const { env, ctx } = yield* CloudflareBindings
 * const myEnv = env as MyEnvType
 * ```
 */
export declare class CloudflareBindings extends CloudflareBindings_base {
}
declare const DatabaseService_base: Context.TagClass<DatabaseService, "@backpine/cloudflare/DatabaseService", {
    readonly db: unknown;
}>;
/**
 * DatabaseService provides access to a request-scoped database instance.
 *
 * Apps should cast the `db` to their specific database type when accessing:
 *
 * ```typescript
 * const { db } = yield* DatabaseService
 * const drizzle = db as DrizzleInstance
 * ```
 */
export declare class DatabaseService extends DatabaseService_base {
}
export {};
//# sourceMappingURL=Services.d.ts.map