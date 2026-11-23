import { expect, test } from "bun:test"
import { Effect } from "effect"
import { makeFixtureModel } from "../evals/email/fixture-model.js"
import { draftEmail, EmailPromptDefault, makeEmailPromptLayer, type EmailInput } from "../src/index.js"

const input: EmailInput = {
  recipient: "Sam",
  purpose: "Confirm the welcome meeting",
  facts: ["The meeting is Tuesday at 10 AM."],
}

const draft = {
  subject: "Welcome meeting",
  body: "Hi Sam,\n\nThe meeting is Tuesday at 10 AM.",
}

const withReply = (reply: unknown) => makeFixtureModel(() => Effect.succeed(JSON.stringify(reply)))

test("validates input before calling the model", async () => {
  let calls = 0
  const model = makeFixtureModel(() => {
    calls += 1
    return Effect.succeed(JSON.stringify(draft))
  })
  const result = await Effect.runPromise(
    draftEmail({ ...input, recipient: "" }).pipe(Effect.provide([EmailPromptDefault, model]), Effect.result),
  )
  expect(result).toMatchObject({ _tag: "Failure", failure: { _tag: "SchemaError" } })
  expect(calls).toBe(0)
})

test("uses the same structured operation with the default and injected prompts", async () => {
  const prompts: string[] = []
  const model = makeFixtureModel(({ prompt, responseFormat }) => {
    expect(responseFormat).toMatchObject({ type: "json", objectName: "email_draft" })
    expect(prompt.content.map(({ role }) => role)).toEqual(["system", "user"])
    for (const message of prompt.content) {
      if (message.role === "system") prompts.push(message.content)
      if (message.role === "user") {
        expect(message.content.map((part) => part.type === "text" ? part.text : part.type)).toEqual([
          JSON.stringify(input),
        ])
      }
    }
    return Effect.succeed(JSON.stringify(draft))
  })
  const run = draftEmail(input).pipe(Effect.provide(model))
  const first = await Effect.runPromise(run.pipe(Effect.provide(EmailPromptDefault)))
  const second = await Effect.runPromise(run.pipe(
    Effect.provide(makeEmailPromptLayer("test", "Use a personal greeting.")),
  ))

  expect(first).toMatchObject({ draft, promptVersion: "v1" })
  expect(second).toMatchObject({ draft, promptVersion: "test" })
  expect(prompts[0]).toContain("Keep the email friendly and direct.")
  expect(prompts[1]).toContain("Use a personal greeting.")
})

test("rejects a malformed draft and a valid draft that omits a required fact", async () => {
  const check = (reply: unknown) => Effect.runPromise(
    draftEmail(input).pipe(Effect.provide([EmailPromptDefault, withReply(reply)]), Effect.result),
  )
  expect(await check({ ...draft, subject: 123 })).toMatchObject({
    _tag: "Failure",
    failure: { _tag: "AiError", reason: { _tag: "StructuredOutputError" } },
  })
  expect(await check({ ...draft, body: "Hi Sam, see you at the meeting." })).toMatchObject({
    _tag: "Failure",
    failure: { _tag: "MissingEmailFacts", facts: input.facts },
  })
})
