import { Schema } from "effect"
import { EmailInputSchema, type EmailDraft } from "../../src/index.js"

const EmailCaseSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  input: EmailInputSchema,
  expectedSubjectText: Schema.NonEmptyString,
})

export const EmailDatasetSchema = Schema.Struct({
  version: Schema.NonEmptyString,
  cases: Schema.NonEmptyArray(EmailCaseSchema),
})

export type EmailDataset = typeof EmailDatasetSchema.Type
export type EmailCase = typeof EmailCaseSchema.Type

export const scorerVersion = "v1"

export const scoreEmail = (sample: EmailCase, draft: EmailDraft) => [
  {
    name: "subject-mentions-topic",
    passed: draft.subject.toLowerCase().includes(sample.expectedSubjectText.toLowerCase()),
  },
  {
    name: "personalized-greeting",
    passed: draft.body.startsWith(`Hi ${sample.input.recipient},`),
  },
  {
    name: "concise-body",
    passed: draft.body.split(/\s+/).length <= 80,
  },
]
