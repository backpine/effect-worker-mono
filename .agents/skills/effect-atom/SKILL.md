---
name: effect-atom
description: Implement or review Effect Atom in this repository's React app. Use for atom state, the registry, typed RPC queries and mutations, invalidation, or AsyncResult rendering.
---

# Effect Atom in this repository

Start with the app entry, RPC client, and users atoms in `apps/react-app/src/main.tsx`,
`apps/react-app/src/atoms/rpc.ts`, and `apps/react-app/src/atoms/users.ts`.
Check the installed `effect` and `@effect/atom-react` source for the versions
pinned in the root Bun catalog. Use `effect/reactivity` for atom definitions and
`@effect/atom-react` for React hooks.

## State and ownership

- Use the root `RegistryProvider` above the router. Define shared atoms and RPC
  clients at module scope so their identity survives rendering. Keep drafts and
  interaction state owned by one component in React state.
- Define one `AtomRpc.Service` per RPC group, with transport and serialization
  in the client module. Define feature reads with `client.query` and writes with
  `client.mutation`. For detail routes, pass the record ID to the detail RPC.
- Keep reactivity keys private to the feature and reuse them across related
  queries and writes. Expose a payload-only writable atom when every caller
  needs the same invalidation. The users mutation delegates through
  `Atom.writable` to the RPC mutation, which invalidates those keys on success.

## React and async results

- Use `useAtomValue` to read, `useAtomSet` to write, and `useAtom` for both.
  Use `promiseExit` when a caller needs to await completion and branch on success
  or failure. A promise setter observes the atom's next settled result, so
  serialize writes when callers need their own result.
- Match the rendering approach to the hook. Read `AsyncResult` explicitly with
  `useAtomValue`, or pair `useAtomSuspense` with a Suspense boundary and a failure
  strategy. The users list uses `AsyncResult.value` to keep loaded rows visible
  through refreshes. Match typed RPC failures by their `_tag` when choosing
  messages to show in the UI.

## Verify changes

Use a fresh `AtomRegistry` for atom tests and dispose it when the test ends.
Check that a successful write refreshes mounted queries and a failed write
preserves their data. See `apps/react-app/test/users-atoms.test.ts`.
Run `bun test apps/react-app/test` and
`bun run --filter react-app check` from the repository root.
