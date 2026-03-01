import { Effect } from "effect"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { RpcClient } from "effect/unstable/rpc"
import { UsersRpc } from "@repo/contracts/rpc"
import { rpcRuntime } from "./rpc"

// --- Read Atoms ---

export const usersAtom = rpcRuntime.atom(
  RpcClient.make(UsersRpc).pipe(
    Effect.flatMap((c) => c.listUsers()),
  ),
)

export const userAtom = Atom.family((id: string) =>
  Atom.make((get) => {
    const result = get(usersAtom)
    return AsyncResult.map(result, (data) =>
      data.users.find((u) => u.id === id) ?? null,
    )
  }),
)

// --- Mutation Atoms ---

export const createUserFn = rpcRuntime.fn(
  (payload: { email: string; name: string }, ctx) =>
    RpcClient.make(UsersRpc).pipe(
      Effect.flatMap((c) => c.createUser(payload)),
      Effect.tap(() => Effect.sync(() => ctx.refresh(usersAtom))),
    ),
)
