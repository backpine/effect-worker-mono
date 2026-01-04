/**
 * Worker API Definition
 *
 * Main HttpApi class that defines the complete API structure.
 *
 * @module
 */
import { HttpApi } from "@effect/platform"
import { HealthGroup, UsersGroup } from "./groups/index.js"
import { CloudflareBindingsMiddleware } from "./middleware/index.js"

/**
 * Worker API definition.
 *
 * All endpoints are prefixed with `/api`.
 * CloudflareBindings is available to all handlers via middleware.
 */
export class WorkerApi extends HttpApi.make("WorkerApi")
  .add(HealthGroup)
  .add(UsersGroup)
  .middleware(CloudflareBindingsMiddleware)
  .prefix("/api") {}
