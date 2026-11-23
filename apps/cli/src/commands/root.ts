import { Command, Flag } from "effect/cli"

export const root = Command.make("effect-worker").pipe(
  Command.withDescription("Manage users and check API health"),
  Command.withSharedFlags({
    apiUrl: Flag.String("api-url").pipe(
      Flag.withDescription("API origin. Defaults to API_URL."),
      Flag.optional,
    ),
    json: Flag.Boolean("json").pipe(Flag.withDescription("Print a JSON response"), Flag.withDefault(false)),
  }),
)
