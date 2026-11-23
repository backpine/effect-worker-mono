import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { HttpApiBuilder, HttpApiMiddleware } from "effect/http-api"
import { Worker } from "@repo/cloudflare"
import { WorkerApi } from "@repo/contracts/http"
import type { Database } from "@repo/db"
import type { DatabaseConnectionError } from "@repo/domain"
import { HealthGroupLive } from "@/handlers/health"
import { makeUsersGroup } from "@/handlers/users"

/** Initialize the router and its groups once. User handlers build the database layer per request. */
export const makeWorker = (database: Layer.Layer<Database, DatabaseConnectionError>) =>
  Worker.make(
    HttpRouter.toHttpEffect(
      HttpApiBuilder.layer(WorkerApi, { openapiPath: "/api/openapi.json" }).pipe(
        Layer.provide([HealthGroupLive, makeUsersGroup(database)]),
        Layer.provide(HttpApiMiddleware.layerProblemDetails()),
        Layer.provide(HttpServer.layerServices),
      ),
    ).pipe(Effect.map((fetch) => ({ fetch }))),
  )
