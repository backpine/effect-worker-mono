import { EmailPromptDefault, makeEmailPromptLayer } from "../../src/index.js"

export const greetingInstruction = 'Start the body with "Hi {recipient}," using the supplied recipient.'

export const emailPrompts = {
  v1: EmailPromptDefault,
  v2: makeEmailPromptLayer("v2", [
    greetingInstruction,
    "Name the purpose in the subject and keep the body to 80 words or fewer.",
  ].join("\n")),
}

export type EmailPromptVersion = keyof typeof emailPrompts
