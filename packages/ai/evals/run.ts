import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Console, Effect, Option, Record, Schema } from "effect"
import { CliError, Command, Flag } from "effect/cli"
import { version } from "../package.json"
import cases from "./email/cases.json"
import { compareEmailPrompts } from "./email/compare.js"
import { EmailFixtureModel } from "./email/fixture-model.js"
import { emailPrompts } from "./email/prompts.js"
import { EmailDatasetSchema } from "./email/score.js"
import { makeOpenAiModel } from "./openai.js"

const promptFlag = (name: string) => Flag.Literals(name, Record.keys(emailPrompts))

const command = Command.make("email-eval", {
  baseline: promptFlag("baseline").pipe(Flag.withDefault("v1")),
  candidate: promptFlag("candidate").pipe(Flag.withDefault("v2")),
  model: Flag.String("model").pipe(
    Flag.withSchema(Schema.NonEmptyString.check(Schema.isTrimmed())),
    Flag.withDescription("Use this OpenAI model for a live eval. The default uses fixtures."),
    Flag.optional,
  ),
}, Effect.fn(function* ({ baseline, candidate, model }) {
  const dataset = yield* Schema.decodeUnknownEffect(EmailDatasetSchema)(cases)
  const compare = compareEmailPrompts(dataset, baseline, candidate)
  const report = Option.isSome(model)
    ? yield* compare.pipe(Effect.provide(makeOpenAiModel(model.value)))
    : yield* compare.pipe(Effect.provide(EmailFixtureModel))
  yield* Console.log(JSON.stringify({
    model: Option.getOrElse(model, () => "fixture"),
    ...report,
  }, null, 2))
  if (!report.passed) return yield* Effect.fail(new Error("The comparison found errors or regressions."))
}))

BunRuntime.runMain(Command.run(command, { version }).pipe(
  Effect.tapError((error) => CliError.isCliError(error) ? Effect.void : Console.error(error.message)),
  Effect.provide(BunServices.layer),
), { disableErrorReporting: true })
