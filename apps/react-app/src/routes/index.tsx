import { Suspense, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useAtomValue, useAtomSet } from "@effect/atom-react"
import { Cause } from "effect"
import { Button } from "@/components/ui/button"
import { usersAtom, createUserFn } from "@/atoms"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          Manage users via Effect RPC + Atom
        </p>
      </div>
      <CreateUserForm />
      <Suspense fallback={<p className="text-muted-foreground">Loading users...</p>}>
        <UsersList />
      </Suspense>
    </div>
  )
}

function CreateUserForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const result = useAtomValue(createUserFn)
  const submit = useAtomSet(createUserFn, { mode: "promise" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    try {
      await submit({ name: name.trim(), email: email.trim() })
      setName("")
      setEmail("")
    } catch {
      // Error state is tracked in the atom
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border p-4">
      <h2 className="text-lg font-semibold">Create User</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>
      {result._tag === "Failure" && (
        <p className="text-sm text-destructive">
          {Cause.pretty(result.cause)}
        </p>
      )}
      <Button type="submit" disabled={result.waiting}>
        {result.waiting ? "Creating..." : "Create User"}
      </Button>
    </form>
  )
}

function UsersList() {
  const result = useAtomValue(usersAtom)

  if (result._tag === "Initial") {
    return <p className="text-muted-foreground">Loading users...</p>
  }

  if (result._tag === "Failure") {
    return (
      <p className="text-destructive">
        {Cause.pretty(result.cause)}
      </p>
    )
  }

  const { users, total } = result.value

  if (users.length === 0) {
    return (
      <p className="text-muted-foreground">No users yet. Create one above.</p>
    )
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">
        All Users <span className="text-muted-foreground font-normal">({total})</span>
      </h2>
      <div className="divide-y divide-border rounded-lg border border-border">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(Number(user.createdAt)).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
