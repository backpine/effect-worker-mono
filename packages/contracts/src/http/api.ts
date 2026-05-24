/**
 * Worker API Definition
 *
 * Main HttpApi class that defines the complete API structure.
 *
 * @module
 */
import { HttpApi } from "effect/unstable/httpapi"
import { HealthGroup, UsersGroup } from "./groups"

/**
 * Worker API definition.
 *
 * All endpoints are prefixed with `/api`. Cloudflare bindings (env/ctx) are
 * provided at the worker entry point as a typed service; the `users` group
 * additionally requires the database via `DatabaseMiddleware`.
 */
export class WorkerApi extends HttpApi.make("WorkerApi")
  .add(HealthGroup)
  .add(UsersGroup)
  .prefix("/api") {}
