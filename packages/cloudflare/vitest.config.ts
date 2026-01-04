import { mergeConfig, defineProject } from "vitest/config"
import configShared from "../../vitest.shared.js"

export default mergeConfig(
  configShared,
  defineProject({
    test: {
      include: ["test/**/*.test.ts"]
    }
  })
)
