import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <nav className="flex gap-4 border-b border-border p-4">
        <Link
          to="/"
          activeProps={{ className: "font-bold" }}
          className="text-foreground hover:text-primary"
        >
          Home
        </Link>
      </nav>
      <main className="p-4">
        <Outlet />
      </main>
      <TanStackRouterDevtools position="bottom-right" />
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </>
  );
}
