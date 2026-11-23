import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { ConfigProvider, Effect, Schema } from "effect"
import { FetchHttpClient } from "effect/http"
import cases from "../evals/email/cases.json"
import { compareEmailPrompts } from "../evals/email/compare.js"
import { EmailFixtureModel, makeFixtureModel } from "../evals/email/fixture-model.js"
import { EmailDatasetSchema } from "../evals/email/score.js"
import { makeOpenAiModel } from "../evals/openai.js"
import { draftEmail, EmailPromptDefault } from "../src/index.js"

const dataset = Schema.decodeUnknownSync(EmailDatasetSchema)(cases)

test("compares the same cases with both prompts and identifies per-case regressions", async () => {
  const improved = await Effect.runPromise(compareEmailPrompts(dataset, "v1", "v2").pipe(
    Effect.provide(EmailFixtureModel),
  ))
  expect(improved).toMatchObject({ datasetVersion: "v1", scorerVersion: "v1", passed: true })
  expect(improved.cases.map(({ id }) => id)).toEqual(dataset.cases.map(({ id }) => id))
  for (const sample of improved.cases) {
    expect(sample.baseline).toMatchObject({ status: "ok", promptVersion: "v1" })
    expect(sample.candidate).toMatchObject({
      status: "ok",
      promptVersion: "v2",
      criteria: [
        { name: "subject-mentions-topic", passed: true },
        { name: "personalized-greeting", passed: true },
        { name: "concise-body", passed: true },
      ],
    })
    expect(sample.regressions).toEqual([])
  }

  const regressed = await Effect.runPromise(compareEmailPrompts(dataset, "v2", "v1").pipe(
    Effect.provide(EmailFixtureModel),
  ))
  expect(regressed.passed).toBe(false)
  expect(regressed.cases.map(({ regressions }) => regressions)).toEqual(
    dataset.cases.map(() => ["personalized-greeting"]),
  )
})

test("records model and validation failures separately from quality scores", async () => {
  const report = await Effect.runPromise(compareEmailPrompts(dataset, "v1", "v2").pipe(
    Effect.provide(makeFixtureModel(() => Effect.succeed("{}"))),
  ))
  expect(report.passed).toBe(false)
  for (const { baseline, candidate } of report.cases) {
    expect(baseline).toMatchObject({ status: "error", reason: "StructuredOutputError" })
    expect(candidate).toMatchObject({ status: "error", reason: "StructuredOutputError" })
  }
})

test("the live model layer sends a structured request and decodes provider usage", async () => {
  const input = dataset.cases[0].input
  const draft = { subject: "Welcome meeting", body: input.facts.join(" ") }
  const fetch = Object.assign(async (...[url, init]: Parameters<typeof globalThis.fetch>) => {
    const request = new Request(url, init)
    expect(request.url).toBe("https://api.openai.com/v1/responses")
    expect(request.headers.get("authorization")).toBe("Bearer fixture-key")
    const body: unknown = await request.json()
    expect(body).toMatchObject({
      model: "fixture-model",
      store: false,
      text: { format: { type: "json_schema", name: "email_draft", strict: true } },
    })

    return Response.json({
      id: "response_fixture",
      model: "fixture-model",
      created_at: 1,
      output: [{
        id: "message_fixture",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(draft), annotations: [] }],
      }],
      usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
    })
  }, { preconnect: globalThis.fetch.preconnect })

  const result = await Effect.runPromise(draftEmail(input).pipe(
    Effect.provide([EmailPromptDefault, makeOpenAiModel("fixture-model")]),
    Effect.provideService(FetchHttpClient.Fetch, fetch),
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ OPENAI_API_KEY: "fixture-key" }))),
  ))
  expect(result).toMatchObject({
    draft,
    finishReason: "stop",
    usage: { inputTokens: { total: 20 }, outputTokens: { total: 10 } },
  })
})

test("the eval command keeps stdout parseable when a regression fails the comparison", async () => {
  const entry = fileURLToPath(new URL("../evals/run.ts", import.meta.url))
  const child = Bun.spawn([process.execPath, entry, "--baseline", "v2", "--candidate", "v1"], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const report: unknown = JSON.parse(stdout)
  expect(report).toMatchObject({ passed: false, baselineVersion: "v2", candidateVersion: "v1" })
  expect(code).toBe(1)
  expect(stderr).toContain("The comparison found errors or regressions.")
})
