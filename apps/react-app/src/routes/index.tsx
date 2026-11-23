import { useRef, useState, type FormEvent } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "@effect/atom-react"
import { Cause, Exit, Option } from "effect"
import { AsyncResult } from "effect/reactivity"
import type { RpcClientError } from "effect/rpc"
import type { DatabaseConnectionError, UserCreationError } from "@repo/domain"
import { Button } from "@repo/ui/button"
import { TextField } from "@repo/ui/text-field"
import { createUserAtom, usersAtom } from "@/atoms"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Users</h1>
      <CreateUserForm />
      <UsersList />
    </div>
  )
}

function CreateUserForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const submitting = useRef(false)
  const [result, submit] = useAtom(createUserAtom, { mode: "promiseExit" })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = { name: name.trim(), email: email.trim() }
    // Promise setters observe the next settled result. Keep this form's writes serial.
    if (submitting.current || !payload.name || !payload.email) return
    submitting.current = true
    try {
      const exit = await submit(payload)
      if (Exit.isSuccess(exit)) {
        setName("")
        setEmail("")
      }
    } finally {
      submitting.current = false
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="create-user"
      className="space-y-4 rounded-lg border border-border bg-surface p-4"
    >
      <h2 id="create-user" className="text-lg font-semibold">Create User</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="name"
          label="Name"
          autoComplete="name"
          value={name}
          onValueChange={setName}
          required
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onValueChange={setEmail}
          required
        />
      </div>
      {result._tag === "Failure" && !result.waiting && (
        <p role="alert" className="text-sm text-destructive">
          {userRequestError(result.cause, "Could not create the user.")}
        </p>
      )}
      <Button type="submit" busy={result.waiting}>
        {result.waiting ? "Creating..." : "Create User"}
      </Button>
    </form>
  )
}

function UsersList() {
  const result = useAtomValue(usersAtom)
  const error = result._tag === "Failure" && !result.waiting
    ? userRequestError(result.cause, "Could not load users.")
    : undefined

  // Keep the last successful list visible while it refreshes or if the refresh fails.
  const data = AsyncResult.value(result)
  if (Option.isNone(data)) {
    return error
      ? <p role="alert" className="text-destructive">{error}</p>
      : <p className="text-muted-foreground">Loading users...</p>
  }

  const { users, total } = data.value

  return (
    <div aria-busy={result.waiting || undefined} className="space-y-2">
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {users.length === 0 ? (
        <p className="text-muted-foreground">No users yet. Create one above.</p>
      ) : (
        <>
          <h2 className="text-lg font-semibold">
            All Users <span className="text-muted-foreground font-normal">({total})</span>
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-surface">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {user.createdAt.toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function userRequestError(
  cause: Cause.Cause<DatabaseConnectionError | UserCreationError | RpcClientError.RpcClientError>,
  fallback: string,
) {
  const error = Cause.findErrorOption(cause)
  return Option.isSome(error) && error.value._tag === "DatabaseConnectionError"
    ? error.value.message
    : fallback
}
