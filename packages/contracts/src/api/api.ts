/**
 * Worker API Definition
 *
 * Main HttpApi class that defines the complete API structure.
 *
 * @module
 */
import { HttpApi, HttpApiMiddleware } from "effect/http-api"
import { HealthGroup, UsersGroup } from "./groups"

/** All REST endpoints are served under `/api`. */
export class WorkerApi extends HttpApi.make("WorkerApi")
  .add(HealthGroup)
  .add(UsersGroup)
  .middleware(HttpApiMiddleware.ProblemDetails)
  .prefix("/api") {}
