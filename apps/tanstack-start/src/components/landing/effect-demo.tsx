import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  Zap,
  CheckCircle,
  AlertCircle,
  Code2,
  Server,
} from "lucide-react"
import { greetingFunction } from "@/server/functions/example-effect-function"

type GreetingResult = {
  message: string
  timestamp: string
}

export function EffectDemo() {
  const [name, setName] = React.useState("World")

  const mutation = useMutation({
    mutationFn: (input: { name: string }) =>
      greetingFunction({ data: input }),
  })

  const handleSubmit = () => {
    mutation.mutate({ name })
  }

  const result = mutation.data as GreetingResult | undefined

  return (
    <section
      id="effect-demo"
      className="py-24 bg-gradient-to-b from-background to-muted/20"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <Zap className="w-4 h-4 mr-2" />
            Live Demo
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Effect Server Functions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Type-safe server functions powered by Effect-TS with schema validation
            and composable pipelines.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Demo Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Server className="w-5 h-5 mr-2 text-primary" />
                  Server Function
                </CardTitle>
                <CardDescription>
                  Call an Effect server function via TanStack Query
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label
                    htmlFor="name-input"
                    className="block text-sm font-medium mb-2"
                  >
                    Your Name
                  </label>
                  <input
                    id="name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                    placeholder="Enter your name..."
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={mutation.isPending || !name.trim()}
                  className="w-full"
                >
                  {mutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Run Server Function
                </Button>

                {mutation.isPending && (
                  <Alert>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <AlertDescription>Running Effect program...</AlertDescription>
                  </Alert>
                )}

                {mutation.isSuccess && result && (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      <strong>{result.message}</strong>
                      <br />
                      <span className="text-xs opacity-75">{result.timestamp}</span>
                    </AlertDescription>
                  </Alert>
                )}

                {mutation.isError && (
                  <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      <strong>Error:</strong>{" "}
                      {mutation.error?.message || "Something went wrong"}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Code Example */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Code2 className="w-5 h-5 mr-2 text-primary" />
                  Server Code
                </CardTitle>
                <CardDescription>
                  Effect server function with schema validation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground">
{`export const greetingFunction = effectFunction
  .inputValidator(validateWith(Schema))
  .handler(async ({ data, context }) => {
    return context.runEffect(
      Effect.gen(function* () {
        yield* Effect.log(\`Hello \${data.name}\`)

        // Access services via yield*
        // const db = yield* PgDrizzle

        return {
          message: \`Hello, \${data.name}!\`,
          timestamp: new Date().toISOString()
        }
      })
    )
  })`}
                  </pre>
                </div>

                <div className="mt-4 text-sm text-muted-foreground">
                  <p className="mb-2">
                    <strong>API Route:</strong> See{" "}
                    <code className="bg-muted px-1 rounded">/api/process</code> for
                    a REST API example using the same Effect pattern.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
