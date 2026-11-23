import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { connect } from "../../src/connect.js"
import { Database } from "../../src/database.js"

const packageDir = fileURLToPath(new URL("../../", import.meta.url))
const templateName = "effect_worker_template"

const command = async (cmd: string[], options?: { cwd: string; env: NodeJS.ProcessEnv }) => {
  const child = Bun.spawn(cmd, { ...options, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (status !== 0) {
    throw new Error(`${cmd.join(" ")} exited with status ${status}\n${stdout}${stderr}`)
  }
  return stdout.trim()
}

const docker = (...args: string[]) => command(["docker", ...args])

export const migrate = (connectionString: string) =>
  command([process.execPath, "run", "db:migrate"], {
    cwd: packageDir,
    env: { ...process.env, DATABASE_URL: connectionString },
  })

const testDatabase = (connectionString: string) => ({
  connectionString,
  run: <A, E>(program: Effect.Effect<A, E, Database>) =>
    Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const sql = yield* connect(connectionString)
      return yield* Effect.provideService(program, Database, sql)
    }))),
})

type TestDatabase = ReturnType<typeof testDatabase>

export const startTestPostgres = async () => {
  const container = `effect-worker-test-${randomUUID()}`
  const stop = () => docker("rm", "--force", container)

  try {
    await docker("run", "--detach", "--rm", "--name", container,
      "--publish", "127.0.0.1::5432",
      "--tmpfs", "/var/lib/postgresql/data",
      "--env", "POSTGRES_PASSWORD=postgres",
      "--env", `POSTGRES_DB=${templateName}`,
      "--health-cmd", "pg_isready -h 127.0.0.1 -U postgres",
      "--health-interval", "1s", "--health-retries", "30",
      "postgres:17-alpine",
    )

    const address = await docker("port", container, "5432/tcp")
    const baseUrl = `postgres://postgres:postgres@${address}`
    const deadline = Date.now() + 30_000
    while (true) {
      const health = await docker("inspect", "--format", "{{.State.Health.Status}}", container)
      if (health === "healthy") break
      if (health === "unhealthy" || Date.now() >= deadline) {
        throw new Error(`Test PostgreSQL did not become ready.\n${await docker("logs", container)}`)
      }
      await Bun.sleep(500)
    }

    await migrate(`${baseUrl}/${templateName}`)
    const admin = testDatabase(`${baseUrl}/postgres`)

    // Each test has its own database and sequence state, even when tests overlap.
    const withDatabase = async <A>(
      use: (db: TestDatabase) => Promise<A>,
      { migrated = true } = {},
    ): Promise<A> => {
      const name = `test_${randomUUID().replaceAll("-", "")}`
      const template = migrated ? templateName : "template0"
      await admin.run(Effect.gen(function* () {
        const sql = yield* Database
        yield* sql`CREATE DATABASE ${sql(name)} TEMPLATE ${sql(template)}`
      }))
      try {
        return await use(testDatabase(`${baseUrl}/${name}`))
      } finally {
        await admin.run(Effect.gen(function* () {
          const sql = yield* Database
          yield* sql`DROP DATABASE ${sql(name)}`
        }))
      }
    }

    return { stop, withDatabase }
  } catch (error) {
    await stop().catch(() => undefined)
    throw error
  }
}
