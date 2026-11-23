import { Data, Effect, Schema } from "effect"
import { LanguageModel } from "effect/ai"
import { EmailPrompt } from "./prompt.js"
import { EmailDraftSchema, EmailInputSchema, type EmailInput } from "./schema.js"

export class MissingEmailFacts extends Data.TaggedError("MissingEmailFacts")<{
  readonly facts: ReadonlyArray<string>
}> {}

export const draftEmail = Effect.fn("draftEmail")(function* (input: EmailInput) {
  const email = yield* Schema.decodeUnknownEffect(EmailInputSchema)(input)
  const prompt = yield* EmailPrompt
  const response = yield* LanguageModel.generateObject({
    objectName: "email_draft",
    schema: EmailDraftSchema,
    prompt: prompt.render(email),
  }).pipe(Effect.timeout("20 seconds"))

  // The schema checks the shape. This rule needs the original input as well.
  const missing = email.facts.filter((fact) => !response.value.body.includes(fact))
  if (missing.length > 0) return yield* new MissingEmailFacts({ facts: missing })

  return {
    draft: response.value,
    promptVersion: prompt.version,
    usage: response.usage,
    finishReason: response.finishReason,
  }
})
