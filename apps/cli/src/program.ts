import { Effect, Logger } from "effect"
import { Command } from "effect/cli"
import { FetchHttpClient } from "effect/http"
import { version } from "../package.json"
import { health } from "./commands/health"
import { root } from "./commands/root"
import { users } from "./commands/users"
import { reportFailure } from "./errors"
import { cliPresenter } from "./output"

const command = root.pipe(Command.withSubcommands([health, users]))
const diagnosticLogs = Logger.layer([Logger.withConsoleError(Logger.formatSimple)])

export const runCli = (args?: ReadonlyArray<string>) =>
  (args === undefined ? Command.run(command, { version }) : Command.runWith(command, { version })(args)).pipe(
    Effect.provide([FetchHttpClient.layer, cliPresenter, diagnosticLogs]),
    Effect.catch(reportFailure),
    Effect.catchDefect(reportFailure),
  )
