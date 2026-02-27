import type { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function createRouter(queryClient: QueryClient) {
  return createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    context: { queryClient },
  });
}
