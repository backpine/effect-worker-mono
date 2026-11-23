import { Effect, Layer, Schema, Stream } from "effect"
import { AiError, LanguageModel } from "effect/ai"
import { EmailInputSchema, type EmailDraft } from "../../src/index.js"
import { greetingInstruction } from "./prompts.js"

export const makeFixtureModel = (
  reply: (options: LanguageModel.ProviderOptions) => Effect.Effect<string, AiError.AiError>,
) => Layer.effect(LanguageModel.LanguageModel, LanguageModel.make({
  generateText: (options) => reply(options).pipe(Effect.map((text) => [{ type: "text", text }])),
  streamText: () => Stream.empty,
}))

const decodeInput = Schema.decodeUnknownEffect(Schema.fromJsonString(EmailInputSchema))

// Fixed behavior for local tests and examples. Live evals use the selected provider.
export const EmailFixtureModel = makeFixtureModel(({ prompt }) => Effect.gen(function* () {
  const user = prompt.content.find((message) => message.role === "user")
  const text = user?.content.find((part) => part.type === "text")?.text
  const input = yield* decodeInput(text).pipe(Effect.orDie)
  const personalized = prompt.content.some((message) =>
    message.role === "system" && message.content.includes(greetingInstruction))
  const draft: EmailDraft = {
    subject: input.purpose,
    body: [personalized ? `Hi ${input.recipient},` : "Hello,", "", input.facts.join(" ")].join("\n"),
  }
  return JSON.stringify(draft)
}))
