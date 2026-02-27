import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { useUsers, useCreateUser } from "@/rpc"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          Manage users via Effect RPC
        </p>
      </div>
      <CreateUserForm />
      <UsersList />
    </div>
  )
}

function CreateUserForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const createUser = useCreateUser()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    createUser.mutate(
      { name: name.trim(), email: email.trim() },
      {
        onSuccess: () => {
          setName("")
          setEmail("")
        },
      }
    )
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
      {createUser.error && (
        <p className="text-sm text-destructive">
          {createUser.error instanceof Error
            ? createUser.error.message
            : "Failed to create user"}
        </p>
      )}
      <Button type="submit" disabled={createUser.isPending}>
        {createUser.isPending ? "Creating..." : "Create User"}
      </Button>
    </form>
  )
}

function UsersList() {
  const { data, isLoading, error } = useUsers()

  if (isLoading) {
    return <p className="text-muted-foreground">Loading users...</p>
  }

  if (error) {
    return (
      <p className="text-destructive">
        {error instanceof Error ? error.message : "Failed to load users"}
      </p>
    )
  }

  if (!data || data.users.length === 0) {
    return (
      <p className="text-muted-foreground">No users yet. Create one above.</p>
    )
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">
        All Users <span className="text-muted-foreground font-normal">({data.total})</span>
      </h2>
      <div className="divide-y divide-border rounded-lg border border-border">
        {data.users.map((user) => (
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
