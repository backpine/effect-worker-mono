# AI operations

The example operation drafts an email from a recipient, a purpose, and the
facts to include. It returns a typed subject and body. It validates input
before calling the model and requires every supplied fact to appear in the
draft body.

Run the example, tests, and prompt comparison from the repo root.

```sh
bun run --filter @repo/ai example
bun test packages/ai/test
bun run --filter @repo/ai eval --baseline v1 --candidate v2
```

The example and the default eval use deterministic fixtures and require
no credentials. The fixture model demonstrates the runner and scorers.
To measure model quality, export `OPENAI_API_KEY` and set `OPENAI_MODEL` to an
OpenAI model ID that supports structured outputs.

```sh
bun run --filter @repo/ai eval --baseline v1 --candidate v2 --model "$OPENAI_MODEL"
```

## Add an operation

Follow `src/operations/draft-email`. Define input and output in `schema.ts`,
keep the instructions and prompt layer in `prompt.ts`, and use
`LanguageModel.generateObject` in `run.ts`. Keep rules that can be verified
in code alongside the operation.

Provide a `LanguageModel` and the operation's prompt layer at the entry point.
`EmailPromptDefault` supplies the checked-in prompt. Use
`makeEmailPromptLayer(version, instructions)` to supply a new version while
keeping the existing rules and user message renderer.

## Add an eval case

Add a reviewed input and its expected subject topic to `evals/email/cases.json`.
Put new prompt versions in `evals/email/prompts.ts` and select them with
`--baseline` and `--candidate`. Update the dataset or scorer version when its
contents change.

The runner passes the same cases through each prompt with the same model. The
JSON report includes each draft, criterion, prompt version, latency, and
token usage when the model reports it. The command exits nonzero when a
call fails or a passing baseline criterion regresses. Reports include
the generated drafts, so use synthetic or approved eval inputs.

```sh
bun packages/ai/evals/run.ts --baseline v1 --candidate v2 > email-eval.json
```
