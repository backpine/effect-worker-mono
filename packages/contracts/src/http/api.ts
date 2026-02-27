/**
 * Worker API Definition
 *
 * Main HttpApi class that defines the complete API structure.
 *
 * @module
 */
import { HttpApi } from "effect/unstable/httpapi"
import { HealthGroup, UsersGroup } from "./groups"
import { CloudflareBindingsMiddleware } from "./middleware"

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
