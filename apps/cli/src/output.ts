import { Console, Effect, Schema } from "effect"
import { CliOutput } from "effect/cli"

export const printResult = <S extends Schema.Constraint>(
  json: boolean,
  schema: S,
  value: NoInfer<S["Type"]>,
  human: (value: S["Type"]) => string,
) =>
  json
    ? Schema.encodeEffect(Schema.fromJsonString(Schema.toCodecJson(schema)))(value).pipe(
      Effect.flatMap((output) => Console.log(output)),
    )
    : Console.log(human(value))

export const cliPresenter = CliOutput.layerPresenter({
  present: Effect.fn(function* (event) {
    if (event._tag === "InvalidInvocation" || (event._tag === "Help" && event.reason === "Implicit")) {
      const formatter = yield* CliOutput.Formatter
      yield* Console.error(formatter.formatHelpDoc(event.helpDoc))
      if (event._tag === "InvalidInvocation") yield* Console.error(formatter.formatErrors(event.errors))
      return
    }
    yield* CliOutput.defaultPresenter.present(event)
  }),
})
