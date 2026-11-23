import { AsyncResult, Atom } from "effect/reactivity"
import { UsersClient } from "./rpc"

export const usersKeys = ["users"]
export const usersAtom = UsersClient.query("listUsers", undefined, { reactivityKeys: usersKeys })
export const createUserFn = UsersClient.mutation("createUser")

export const userAtom = Atom.family((id: number) =>
  Atom.make((get) =>
    AsyncResult.map(get(usersAtom), (data) => data.users.find((user) => user.id === id) ?? null)
  )
)
