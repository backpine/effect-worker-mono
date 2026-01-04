import { mergeConfig, defineProject } from "vitest/config"
import configShared from "../../vitest.shared"

export default mergeConfig(
  configShared,
  defineProject({
    test: {
      include: ["test/**/*.test.ts"]
    }
  })
)
