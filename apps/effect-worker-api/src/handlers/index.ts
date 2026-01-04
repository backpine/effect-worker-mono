/**
 * HTTP Handlers
 *
 * @module
 */
import { Layer } from "effect"
import { HealthGroupLive } from "./health.js"
import { UsersGroupLive } from "./users.js"

export { HealthGroupLive } from "./health.js"
export { UsersGroupLive } from "./users.js"

/**
 * Combined layer of all HTTP group handlers.
 */
export const HttpGroupsLive = Layer.mergeAll(HealthGroupLive, UsersGroupLive)
