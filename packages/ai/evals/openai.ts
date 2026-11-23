import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import { Config, Layer } from "effect"
import { FetchHttpClient } from "effect/http"

export const makeOpenAiModel = (model: string) =>
  OpenAiLanguageModel.layer({
    model,
    config: { max_output_tokens: 512, store: false, strictJsonSchema: true },
  }).pipe(
    Layer.provide(OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") })),
    Layer.provide(FetchHttpClient.layer),
  )
