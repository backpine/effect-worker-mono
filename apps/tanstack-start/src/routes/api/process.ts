/**
 * Process API Route
 *
 * Demonstrates Effect-TS in a standard API route pattern.
 * POST JSON data, process with Effect, return Response.
 */
import { createFileRoute } from "@tanstack/react-router"
import { Effect, Schema as S } from "effect"
import { effectRuntimeMiddleware } from "@/server/middleware"

// ============================================================================
// Request/Response Schemas
// ============================================================================

const ProcessRequestSchema = S.Struct({
  items: S.Array(
    S.Struct({
      id: S.String,
      value: S.Number,
    })
  ),
  operation: S.Literal("sum", "average", "max", "min"),
})

type ProcessRequest = S.Schema.Type<typeof ProcessRequestSchema>

// ============================================================================
// Typed Errors
// ============================================================================

class ValidationError {
  readonly _tag = "ValidationError"
  constructor(readonly message: string) {}
}

class ProcessingError {
  readonly _tag = "ProcessingError"
  constructor(readonly message: string) {}
}

// ============================================================================
// Effect Programs
// ============================================================================

const parseRequestBody = (request: Request) =>
  Effect.tryPromise({
    try: () => request.json(),
    catch: () => new ValidationError("Invalid JSON body"),
  })

const validateRequest = (body: unknown) =>
  Effect.try({
    try: () => S.decodeUnknownSync(ProcessRequestSchema)(body),
    catch: (error) =>
      new ValidationError(
        `Invalid request: ${error instanceof Error ? error.message : "Unknown error"}`
      ),
  })

const processItems = (
  items: ProcessRequest["items"],
  operation: ProcessRequest["operation"]
) =>
  Effect.gen(function* () {
    if (items.length === 0) {
      return yield* Effect.fail(
        new ProcessingError("Cannot process empty array")
      )
    }

    const values = items.map((item) => item.value)

    yield* Effect.log(`Processing ${operation} on ${values.length} items`)

    switch (operation) {
      case "sum":
        return values.reduce((a, b) => a + b, 0)
      case "average":
        return values.reduce((a, b) => a + b, 0) / values.length
      case "max":
        return Math.max(...values)
      case "min":
        return Math.min(...values)
    }
  })

// ============================================================================
// Response Helpers
// ============================================================================

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const errorResponse = (error: string, status = 400) =>
  jsonResponse({ success: false, error }, status)

// ============================================================================
// Route Definition
// ============================================================================

export const Route = createFileRoute("/api/process")({
  server: {
    middleware: [effectRuntimeMiddleware],
    handlers: {
      /**
       * GET /api/process
       * Returns API info and usage example
       */
      GET: async () => {
        return jsonResponse({
          name: "Effect Process API",
          description: "Process data using Effect pipelines",
          usage: {
            method: "POST",
            contentType: "application/json",
            body: {
              items: [
                { id: "a", value: 10 },
                { id: "b", value: 20 },
              ],
              operation: "sum | average | max | min",
            },
          },
          example: {
            request: {
              items: [
                { id: "a", value: 10 },
                { id: "b", value: 20 },
                { id: "c", value: 30 },
              ],
              operation: "sum",
            },
            response: {
              success: true,
              result: 60,
              operation: "sum",
              itemCount: 3,
            },
          },
        })
      },

      /**
       * POST /api/process
       * Process items with the specified operation
       */
      POST: async ({ request, context }) => {
        return await context.runEffect(
          Effect.gen(function* () {
            // Parse JSON body
            const body = yield* parseRequestBody(request)

            // Validate against schema
            const data = yield* validateRequest(body)

            // Process the data
            const result = yield* processItems(data.items, data.operation)

            yield* Effect.log(`Completed: ${data.operation} = ${result}`)

            return jsonResponse({
              success: true,
              result,
              operation: data.operation,
              itemCount: data.items.length,
              processedAt: new Date().toISOString(),
            })
          }).pipe(
            // Handle validation errors (400)
            Effect.catchTag("ValidationError", (error) =>
              Effect.succeed(errorResponse(error.message, 400))
            ),
            // Handle processing errors (422)
            Effect.catchTag("ProcessingError", (error) =>
              Effect.succeed(errorResponse(error.message, 422))
            ),
            // Handle unexpected errors (500)
            Effect.catchAllDefect((defect) =>
              Effect.succeed(
                errorResponse(
                  defect instanceof Error ? defect.message : "Internal server error",
                  500
                )
              )
            )
          )
        )
      },
    },
  },
})
