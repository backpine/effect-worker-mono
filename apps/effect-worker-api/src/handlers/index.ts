/**
 * HTTP Handlers
 *
 * @module
 */
import { Layer } from "effect"
import { HealthGroupLive } from "@/handlers/health"
import { UsersGroupLive } from "@/handlers/users"

export { HealthGroupLive } from "@/handlers/health"
export { UsersGroupLive } from "@/handlers/users"

/**
 * Combined layer of all HTTP group handlers.
 */
export const HttpGroupsLive = Layer.mergeAll(HealthGroupLive, UsersGroupLive)
