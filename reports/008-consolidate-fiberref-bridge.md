# Consolidating FiberRef Bridge

## Current State

### Duplication

Both apps define identical FiberRef logic:

```
apps/effect-worker-api/src/services/cloudflare.ts  ← defines currentEnv, currentCtx, etc.
apps/effect-worker-rpc/src/services/cloudflare.ts  ← defines currentEnv, currentCtx, etc.
packages/cloudflare/src/fiber-ref.ts               ← defines the same, but UNUSED
```

### How Apps Use FiberRefs

**Entry point (index.ts):**
```typescript
const effect = handleRequest(request).pipe(withCloudflareBindings(env, ctx))
return runtime.runPromise(effect)
```

**Middleware (middleware.ts):**
```typescript
const env = yield* FiberRef.get(currentEnv)
const ctx = yield* FiberRef.get(currentCtx)
```

### The Type Difference

| Location | `currentEnv` Type | `currentCtx` Type |
|----------|-------------------|-------------------|
| Apps | `Env \| null` (app-specific) | `ExecutionContext \| null` (Cloudflare type) |
| Package | `unknown` | `WorkerExecutionContext \| null` (custom interface) |

The apps use wrangler-generated `Env` type for type safety when accessing bindings like `env.DATABASE_URL`.

## Why This Matters

If apps define their own FiberRef instances, they create **separate FiberRefs** even with the same name. The package's FiberRefs are never populated, and if anything tried to read from them, they'd get `null`.

Currently this works because:
1. Apps define their own FiberRefs
2. Apps set values with `withCloudflareBindings` (their own)
3. Middleware reads from the same FiberRefs (their own)

But the package's FiberRefs sit unused.

## Solution: Use Package FiberRefs with App-Local Typed Wrapper

### Approach

1. Apps import and use the **package's FiberRefs** (single instance)
2. Apps create a thin **typed wrapper** for `withCloudflareBindings`
3. Remove duplicate FiberRef definitions from apps

### Implementation

**Step 1: Update package's fiber-ref.ts**

The package already has the right shape. Just ensure it's generic enough:

```typescript
// packages/cloudflare/src/fiber-ref.ts
export const currentEnv = FiberRef.unsafeMake<unknown>(null)
export const currentCtx = FiberRef.unsafeMake<WorkerExecutionContext | null>(null)

export const withCloudflareBindings = <Env>(env: Env, ctx: WorkerExecutionContext) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.locally(currentEnv, env),
      Effect.locally(currentCtx, ctx)
    )
```

**Step 2: Simplify app's cloudflare.ts**

```typescript
// apps/effect-worker-api/src/services/cloudflare.ts
import {
  currentEnv as _currentEnv,
  currentCtx,
  withCloudflareBindings as _withCloudflareBindings,
  waitUntil
} from "@backpine/cloudflare"
import { FiberRef } from "effect"

// Re-export with app-specific types
export { currentCtx, waitUntil }

/**
 * Get the current env with proper typing.
 */
export const getEnv = () => FiberRef.get(_currentEnv) as Effect.Effect<Env | null>

/**
 * Typed wrapper for withCloudflareBindings.
 */
export const withCloudflareBindings = (env: Env, ctx: ExecutionContext) =>
  _withCloudflareBindings(env, ctx)
```

**Step 3: Update middleware to use getEnv()**

```typescript
// apps/effect-worker-api/src/services/middleware.ts
import { getEnv, currentCtx } from "./cloudflare"

// Instead of:
const env = yield* FiberRef.get(currentEnv)

// Use:
const env = yield* getEnv()
```

### Benefits

1. **Single FiberRef instance** - Package owns the FiberRefs
2. **Type safety** - Apps provide typed wrappers
3. **Less duplication** - Apps just have thin wrappers
4. **Correct behavior** - Same FiberRef used everywhere

### Alternative: Direct Import with Casting

If you prefer minimal app code, apps can import directly and cast:

```typescript
import { currentEnv, currentCtx, withCloudflareBindings, waitUntil } from "@backpine/cloudflare"

// In middleware:
const env = (yield* FiberRef.get(currentEnv)) as Env | null
```

This works but loses type inference on `env`.

## Recommended Approach

**Option A: Typed Wrapper (Recommended)**

Apps keep a thin `cloudflare.ts` that:
- Imports from `@backpine/cloudflare`
- Provides typed `getEnv()` and `withCloudflareBindings()`
- No duplicate FiberRef definitions

**Files to modify:**
- `apps/effect-worker-api/src/services/cloudflare.ts` - use package, add typed wrapper
- `apps/effect-worker-rpc/src/services/cloudflare.ts` - use package, add typed wrapper
- `apps/*/src/services/middleware.ts` - use `getEnv()` instead of direct FiberRef.get

## Summary

The apps currently define their own FiberRef instances, duplicating code from the package. By using the package's FiberRefs with thin typed wrappers in apps, we:

1. Eliminate code duplication
2. Use a single FiberRef instance (correct behavior)
3. Maintain type safety through app-local wrappers
