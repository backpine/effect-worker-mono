import { Cause, Console, Data, Effect, Runtime, Schema } from "effect"
import { CliError, CliOutput } from "effect/cli"
import { HttpClient, HttpClientError } from "effect/http"
import { HttpApiError } from "effect/http-api"
import { DatabaseConnectionError, UserCreationError, UserNotFoundError } from "@repo/domain"

export class CliFailure extends Data.TaggedError("CliFailure")<{
  readonly exitCode: number
  readonly message: string
}> {
  get [Runtime.errorExitCode]() {
    return this.exitCode
  }
}

function describeFailure(error: unknown) {
  if (error instanceof CliFailure) return error
  if (CliError.isCliError(error)) {
    // Effect CLI already presented help and any parse errors.
    const message = error._tag === "ShowHelp" ? "" : CliOutput.defaultFormatter().formatCliError(error)
    return new CliFailure({ exitCode: 2, message })
  }
  if (error instanceof UserNotFoundError) {
    return new CliFailure({ exitCode: 3, message: "User not found." })
  }
  if (error instanceof UserCreationError || error instanceof HttpApiError.BadRequestProblem) {
    return new CliFailure({ exitCode: 4, message: "The API rejected the request." })
  }
  if (error instanceof DatabaseConnectionError) {
    return new CliFailure({ exitCode: 5, message: "The API could not connect to the database." })
  }
  if (Cause.isTimeoutError(error)) {
    return new CliFailure({ exitCode: 5, message: "The API request timed out." })
  }
  if (HttpClient.isTransientError(error) || error instanceof HttpApiError.InternalServerErrorProblem) {
    return new CliFailure({ exitCode: 5, message: "The API is unavailable. Try again later." })
  }
  if (HttpClientError.isHttpClientError(error) && error.reason._tag === "StatusCodeError") {
    const status = error.reason.response.status
    return new CliFailure({ exitCode: status >= 500 ? 5 : 4, message: `The API returned HTTP ${status}.` })
  }
  if (Schema.isSchemaError(error) || HttpClientError.isHttpClientError(error)) {
    return new CliFailure({ exitCode: 1, message: "The API response did not match the contract." })
  }
  return new CliFailure({ exitCode: 1, message: "The command failed unexpectedly." })
}

export const reportFailure = (error: unknown) => {
  const failure = describeFailure(error)
  return (failure.message ? Console.error(failure.message) : Effect.void).pipe(
    Effect.andThen(Effect.fail(failure)),
  )
}
