import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export function createRouter() {
  return createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
  })
}
