import { Atom } from "effect/reactivity"
import type { CreateUser } from "@repo/domain"
import { UsersClient } from "./rpc"

const usersKeys = ["users"]
const createUserMutation = UsersClient.mutation("createUser")

export const usersAtom = UsersClient.query("listUsers", undefined, { reactivityKeys: usersKeys })

// Bind invalidation here so every caller refreshes the same list after a successful create.
export const createUserAtom = Atom.writable(
  (get) => get(createUserMutation),
  (ctx, payload: CreateUser) => ctx.set(createUserMutation, { payload, reactivityKeys: usersKeys }),
)
