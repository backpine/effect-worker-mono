import { expect, it } from "bun:test"
import { fileURLToPath } from "node:url"
import { version } from "../package.json"

const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url))
const run = async (...args: string[]) => {
  const child = Bun.spawn([process.execPath, entry, ...args], {
    env: { API_URL: "invalid" },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { code, stdout, stderr }
}

it("starts with Bun and serves help and version without API configuration", async () => {
  const help = await run("users", "create", "--help")
  expect(help.code).toBe(0)
  expect(help.stdout).toContain("--email")
  expect(help.stderr).toBe("")
  const reportedVersion = await run("--version")
  expect(reportedVersion.code).toBe(0)
  expect(reportedVersion.stdout.trim()).toBe(`effect-worker v${version}`)
  expect(reportedVersion.stderr).toBe("")
})

it("sets a process exit code and emits only stderr on invalid input", async () => {
  const invalid = await run("users", "create", "--email", "bad", "--name", "Ada", "--json")
  expect(invalid.code).toBe(2)
  expect(invalid.stdout).toBe("")
  expect(invalid.stderr).toContain("Invalid email format")
})
