import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node"
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
})
