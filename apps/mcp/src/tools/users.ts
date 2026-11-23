import { UserSchema } from "@repo/contracts/api"
import { UserIdSchema, UserNotFoundError } from "@repo/domain"
import { Effect, Layer, Schema } from "effect"
import { McpServer, Tool, Toolkit } from "effect/ai"
import { ApiClient, ApiUnavailable, apiUnavailable, withApiDeadline } from "../services/api"

const Users = Toolkit.make(Tool.make("get_user", {
  description: "Look up a user by their numeric ID in the local development API.",
  parameters: Schema.Struct({ id: UserIdSchema }),
  success: UserSchema,
  failure: Schema.Union([UserNotFoundError, ApiUnavailable]),
}).annotate(Tool.Readonly, true).annotate(Tool.Strict, true))

const handlers = Users.toLayer(Effect.gen(function* () {
  const api = yield* ApiClient
  return Users.of({
    get_user: ({ id }) => api.users.get({ params: { id } }).pipe(
      withApiDeadline,
      Effect.mapError((error) => error instanceof UserNotFoundError
        ? new UserNotFoundError({ id, message: `User not found: ${id}` })
        : apiUnavailable()),
    ),
  })
}))

export const UserTools = McpServer.toolkit(Users).pipe(Layer.provide(handlers))
