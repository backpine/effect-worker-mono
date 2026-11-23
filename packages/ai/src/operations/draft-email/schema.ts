import { Schema } from "effect"

const line = Schema.NonEmptyString.check(Schema.isTrimmed(), Schema.isPattern(/^[^\r\n]+$/))

export const EmailInputSchema = Schema.Struct({
  recipient: line.check(Schema.isMaxLength(60)),
  purpose: line.check(Schema.isMaxLength(100)),
  facts: Schema.NonEmptyArray(line.check(Schema.isMaxLength(180))).check(Schema.isMaxLength(5)),
})

export const EmailDraftSchema = Schema.Struct({
  subject: line.check(Schema.isMaxLength(100)),
  body: Schema.NonEmptyString.check(Schema.isTrimmed(), Schema.isMaxLength(2_000)),
})

export type EmailInput = typeof EmailInputSchema.Type
export type EmailDraft = typeof EmailDraftSchema.Type
