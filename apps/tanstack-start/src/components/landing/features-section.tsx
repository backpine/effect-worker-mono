import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Route,
  Database,
  Zap,
  Shield,
  Layers,
  Server,
  GitBranch,
  Box
} from "lucide-react"

const features = [
  {
    icon: Zap,
    title: "Effect-TS",
    description: "Composable, type-safe server functions with built-in error handling, dependency injection, and resource management.",
    badge: "Core"
  },
  {
    icon: Server,
    title: "Cloudflare Workers",
    description: "Deploy globally on the edge with instant cold starts, automatic scaling, and seamless Hyperdrive database connections.",
    badge: "Edge"
  },
  {
    icon: Route,
    title: "TanStack Start",
    description: "Full-stack React framework with type-safe routing, server functions, and seamless SSR integration.",
    badge: "Framework"
  },
  {
    icon: Database,
    title: "TanStack Query",
    description: "Powerful data synchronization with server state management, caching, and optimistic updates.",
    badge: "Data"
  },
  {
    icon: Shield,
    title: "Type-Safe Errors",
    description: "Typed error channels with Effect's error handling. No more try-catch—errors are part of your type signature.",
    badge: "Safety"
  },
  {
    icon: Layers,
    title: "Dependency Injection",
    description: "Service layers with automatic scoping. Access databases, configs, and services via yield* in Effect.gen.",
    badge: "DI"
  },
  {
    icon: GitBranch,
    title: "Middleware Pipeline",
    description: "Composable middleware that provides services to handlers. Build auth, logging, and tracing as reusable layers.",
    badge: "Compose"
  },
  {
    icon: Box,
    title: "Monorepo Ready",
    description: "Shared packages for domain types, database queries, and contracts. Build once, use everywhere.",
    badge: "Scale"
  }
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Production-ready Effect-TS architecture
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to build type-safe, scalable applications with Effect
          </p>
        </div>
        
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => {
            const IconComponent = feature.icon
            return (
              <Card key={feature.title} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}