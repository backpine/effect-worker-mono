import { Duration, Effect, Result } from "effect"
import { AiError } from "effect/ai"
import { draftEmail, type EmailDraft } from "../../src/index.js"
import { emailPrompts, type EmailPromptVersion } from "./prompts.js"
import { scoreEmail, scorerVersion, type EmailCase, type EmailDataset } from "./score.js"

type Outcome =
  | {
    readonly status: "ok"
    readonly draft: EmailDraft
    readonly promptVersion: string
    readonly criteria: ReturnType<typeof scoreEmail>
    readonly latencyMs: number
    readonly inputTokens: number | null
    readonly outputTokens: number | null
    readonly finishReason: string
  }
  | {
    readonly status: "error"
    readonly reason: string
    readonly latencyMs: number
  }

const evaluate = (sample: EmailCase, version: EmailPromptVersion) =>
  draftEmail(sample.input).pipe(
    Effect.provide(emailPrompts[version]),
    Effect.result,
    Effect.timed,
    Effect.map(([duration, result]): Outcome => {
      const latencyMs = Duration.toMillis(duration)
      if (Result.isFailure(result)) {
        const error = result.failure
        return { status: "error", reason: AiError.isAiError(error) ? error.reason._tag : error._tag, latencyMs }
      }
      const { draft, promptVersion, usage, finishReason } = result.success
      return {
        status: "ok",
        draft,
        promptVersion,
        criteria: scoreEmail(sample, draft),
        latencyMs,
        inputTokens: usage.inputTokens.total ?? null,
        outputTokens: usage.outputTokens.total ?? null,
        finishReason,
      }
    }),
  )

export const compareEmailPrompts = Effect.fn("compareEmailPrompts")(function* (
  dataset: EmailDataset,
  baselineVersion: EmailPromptVersion,
  candidateVersion: EmailPromptVersion,
) {
  const cases = yield* Effect.forEach(dataset.cases, Effect.fnUntraced(function* (sample) {
    const baseline = yield* evaluate(sample, baselineVersion)
    const candidate = yield* evaluate(sample, candidateVersion)
    const regressions = baseline.status === "ok" && candidate.status === "ok"
      ? candidate.criteria
        .filter((criterion) => !criterion.passed && baseline.criteria.some(
          (previous) => previous.name === criterion.name && previous.passed,
        ))
        .map((criterion) => criterion.name)
      : []
    return { id: sample.id, baseline, candidate, regressions }
  }))

  return {
    datasetVersion: dataset.version,
    scorerVersion,
    baselineVersion,
    candidateVersion,
    passed: cases.every(({ baseline, candidate, regressions }) =>
      baseline.status === "ok" && candidate.status === "ok" && regressions.length === 0),
    cases,
  }
})
