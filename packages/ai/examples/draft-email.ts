import { Console, Effect } from "effect"
import { EmailFixtureModel } from "../evals/email/fixture-model.js"
import { draftEmail, EmailPromptDefault } from "../src/index.js"

await Effect.runPromise(
  draftEmail({
    recipient: "Sam",
    purpose: "Confirm the welcome meeting",
    facts: ["The meeting is Tuesday at 10 AM."],
  }).pipe(
    Effect.flatMap(({ draft }) => Console.log(draft)),
    Effect.provide([EmailPromptDefault, EmailFixtureModel]),
  ),
)
