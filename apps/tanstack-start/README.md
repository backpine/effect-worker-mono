# TanStack Start on Cloudflare

A modern, full-stack React application built with TanStack Start and deployed on Cloudflare Workers. This template showcases server functions, middleware, type-safe data fetching, Effect-TS integration, and seamless integration with Cloudflare's edge computing platform.

[![TanStack Start on Cloudflare](https://img.youtube.com/vi/TWWS_lo4kOA/0.jpg)](https://www.youtube.com/watch?v=TWWS_lo4kOA)

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Deploy to Cloudflare
pnpm deploy
```

## 📦 Development Workflow

This project provides a comprehensive development workflow with the following scripts:

- **`pnpm dev`** - Start development server on port 3000
- **`pnpm build`** - Build the application for production
- **`pnpm deploy`** - Build and deploy to Cloudflare Workers
- **`pnpm serve`** - Preview production build locally
- **`pnpm cf-typegen`** - Generate TypeScript types for Cloudflare environment

## 🌩️ Cloudflare Integration

### Environment Variables & Type Generation

This project includes full TypeScript support for Cloudflare Workers environment variables:

```bash
# Generate types for Cloudflare environment
pnpm cf-typegen
```

This creates type definitions allowing you to safely import and use Cloudflare environment variables:

```typescript
import { env } from "cloudflare:workers";

// Now env is fully typed with your Wrangler configuration
console.log(env.MY_VAR); // TypeScript knows this exists
```

### Wrangler Configuration

The `wrangler.jsonc` file configures your Cloudflare deployment:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "tanstack-start-app",
  "compatibility_date": "2025-09-02",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./src/server.ts",  // Custom server entry point
  "vars": {
    "MY_VAR": "Hello from Cloudflare"
  }
}
```

### Custom Server Entry (`src/server.ts`)

The `src/server.ts` file is your custom Cloudflare Workers entry point where you can add additional Cloudflare features:

```typescript
import handler from "@tanstack/react-start/server-entry";

export default {
  fetch(request: Request) {
    return handler.fetch(request, {
      context: {
        fromFetch: true,
      },
    });
  },

  // Add other Cloudflare Workers features:
  // - Queue consumers: queue(batch, env) { ... }
  // - Scheduled events: scheduled(event, env) { ... }
  // - Durable Object handlers
  // - etc.
};
```

## 🎨 Styling & Components

### Tailwind CSS v4
This project uses the latest Tailwind CSS v4 with CSS variables for theming:

```bash
# Tailwind is pre-configured with the @tailwindcss/vite plugin
# CSS variables are enabled for theme customization
```

### Shadcn/UI Components
Add beautiful, accessible components using Shadcn/UI:

```bash
# Add individual components
pnpx shadcn@latest add button
pnpx shadcn@latest add card
pnpx shadcn@latest add form

# Components use semantic color tokens and CSS variables
# Perfect for light/dark theme support
```



## 🗂️ File-Based Routing

This project uses [TanStack Router](https://tanstack.com/router/latest) with file-based routing. Routes are automatically generated from files in the `src/routes` directory:

### Adding A Route

To add a new route to your application just add another a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you use the `<Outlet />` component.

Here is an example layout that includes a header:

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { Link } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
```

The `<TanStackRouterDevtools />` component is not required so you can remove it if you don't want it in your layout.

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).


## 🔄 Effect-TS Integration

This template includes Effect-TS integration via a middleware pattern that creates a scoped runtime for each request.

### Effect Runtime Middleware

The `effectRuntimeMiddleware` creates a per-request Effect runtime that provides services to all handlers. The runtime is scoped to the request lifecycle, ensuring proper resource cleanup.

```typescript
// src/server/middleware/effect-runtime.ts
export const effectRuntimeMiddleware = createMiddleware().server(
  async ({ next }) => {
    // Define service layers (add PgDrizzle, custom services, etc.)
    const servicesLayer = Layer.empty

    return Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* Layer.toRuntime(servicesLayer)

          const runEffect = <A, E>(effect: Effect.Effect<A, E, EffectServices>) => {
            return Runtime.runPromise(runtime)(effect)
          }

          return yield* Effect.tryPromise({
            try: async () => await next({ context: { env, runEffect } }),
            catch: (error) => { throw error }
          })
        })
      )
    )
  }
)
```

### Server Functions with Effect

Server functions use the middleware to access `runEffect` for executing Effect programs:

```typescript
// src/server/functions/example-effect-function.ts
const effectFunction = createServerFn().middleware([effectRuntimeMiddleware])

export const greetingFunction = effectFunction
  .inputValidator(validateWith(GreetingRequestSchema))
  .handler(async ({ data, context }) => {
    return context.runEffect(
      Effect.gen(function* () {
        yield* Effect.log(`Processing: ${data.name}`)

        // Access services via yield*
        // const db = yield* PgDrizzle

        return {
          message: `Hello, ${data.name}!`,
          timestamp: new Date().toISOString()
        }
      })
    )
  })
```

### Adding Services (e.g., Database)

To add services like `PgDrizzle` from `@repo/cloudflare`:

1. **Update the middleware** (`src/server/middleware/effect-runtime.ts`):
```typescript
import { PgDrizzle, makeDrizzle } from "@repo/cloudflare"

const dbLayer = Layer.scoped(
  PgDrizzle,
  makeDrizzle(env.HYPERDRIVE.connectionString)
)
const servicesLayer = Layer.mergeAll(dbLayer)
```

2. **Update the types** (`src/server/types.ts`):
```typescript
import type { PgDrizzle } from "@repo/cloudflare"

export type EffectServices = PgDrizzle // Add more services with |
```

3. **Use in handlers**:
```typescript
return context.runEffect(
  Effect.gen(function* () {
    const db = yield* PgDrizzle
    return yield* db.select().from(users)
  })
)
```

### Client Integration with TanStack Query

Server functions integrate seamlessly with TanStack Query:

```tsx
import { useMutation } from '@tanstack/react-query'
import { greetingFunction } from '@/server/functions/example-effect-function'

function MyComponent() {
  const mutation = useMutation({
    mutationFn: (input: { name: string }) => greetingFunction({ data: input }),
    onSuccess: (data) => console.log('Success:', data),
    onError: (error) => console.error('Error:', error),
  })

  return (
    <button
      onClick={() => mutation.mutate({ name: 'World' })}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Loading...' : 'Run Effect'}
    </button>
  )
}
```

### Key Benefits

- **🎯 Type-Safe**: Full TypeScript support with Effect Schema validation
- **🔄 Scoped Runtime**: Per-request Effect runtime with proper resource cleanup
- **⚡ Edge Computing**: Effect programs run on Cloudflare's global edge
- **🧩 Composable Services**: Easily add database, auth, logging services
- **🔒 Server-First**: Secure server-side logic with client convenience

### Project Structure

```
src/server/
├── middleware/
│   ├── effect-runtime.ts   # Effect runtime middleware
│   └── index.ts            # Middleware exports
├── functions/
│   ├── example-effect-function.ts  # Example Effect server function
│   └── index.ts                    # Function exports
├── types.ts                # EffectServices, EffectContext types
└── index.ts                # Server exports
```

### Interactive Demo

This template includes a live demo showcasing the Effect server function patterns. Check your server logs when running the demo to see Effect's structured logging!

## 🧪 Testing

This project uses [Vitest](https://vitest.dev/) for fast unit and integration testing:

```bash
# Run tests
pnpm test

# Test configuration is in vite.config.ts
# Uses jsdom environment for DOM testing
# Includes @testing-library/react for component testing
```

## 📋 Tech Stack

This template includes the latest and greatest from the React ecosystem:

### **Core Framework**
- **TanStack Start** - Full-stack React framework with SSR
- **React 19** - Latest React with concurrent features
- **TypeScript** - Strict type checking enabled
- **Effect-TS** - Type-safe functional programming and service composition

### **Routing & Data**
- **TanStack Router** - Type-safe, file-based routing
- **TanStack Query** - Server state management with SSR integration

### **Styling & UI**
- **Tailwind CSS v4** - Utility-first CSS with CSS variables
- **Shadcn/UI** - Beautiful, accessible component library
- **Lucide React** - Consistent icon set

### **Development Tools**
- **Vite** - Lightning-fast build tool and dev server
- **Vitest** - Unit testing with jsdom
- **TypeScript** - Full type safety across client and server

### **Deployment**
- **Cloudflare Workers** - Edge computing platform
- **Wrangler** - Cloudflare deployment and development CLI

## 🚀 Learn More

- **[TanStack Start](https://tanstack.com/start)** - Full-stack React framework
- **[TanStack Router](https://tanstack.com/router)** - Type-safe routing
- **[TanStack Query](https://tanstack.com/query)** - Server state management
- **[Effect-TS](https://effect.website/)** - Type-safe functional effects
- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Edge computing platform
- **[Shadcn/UI](https://ui.shadcn.com/)** - Component library
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS

## 📄 License

This template is open source and available under the [MIT License](LICENSE).
