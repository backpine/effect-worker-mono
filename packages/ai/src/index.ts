export { EmailDraftSchema, EmailInputSchema, type EmailDraft, type EmailInput } from "./operations/draft-email/schema.js"
export { EmailPrompt, EmailPromptDefault, makeEmailPromptLayer } from "./operations/draft-email/prompt.js"
export { draftEmail, MissingEmailFacts } from "./operations/draft-email/run.js"
