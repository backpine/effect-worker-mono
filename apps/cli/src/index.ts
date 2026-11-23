import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Effect } from "effect"
import { runCli } from "./program"

BunRuntime.runMain(runCli().pipe(Effect.provide(BunServices.layer)), {
  disableErrorReporting: true,
})
