/**
 * Health Endpoint Definition
 *
 * Simple health check endpoint for monitoring.
 *
 * @module
 */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { Schema as S } from "effect"

/**
 * Health check response schema.
 */
export const HealthResponseSchema = S.Struct({
  status: S.Literal("ok"),
  timestamp: S.DateTimeUtc
})
export type HealthResponse = typeof HealthResponseSchema.Type

/**
 * Health endpoint group definition.
 */
export const HealthGroup = HttpApiGroup.make("health")
  .add(HttpApiEndpoint.get("check", "/", { success: HealthResponseSchema }))
  .prefix("/health")
