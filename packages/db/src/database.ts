/**
 * Database service tag
 *
 * Lightweight, type-only‑safe module holding just the `Database` service tag —
 * the Drizzle database handle (`EffectPgDatabase` from the first-class
 * `drizzle-orm/effect-postgres` client). Import from here when you only need the
 * tag (e.g. middleware contracts) without pulling the driver into the bundle.
 *
 * The live instance is built **per request** by the database middleware (see the
 * app's `services`), never at module load — required by Cloudflare Hyperdrive.
 *
 * @module
 */
import { Context } from "effect"
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres"

export class Database extends Context.Service<Database, EffectPgDatabase>()(
  "@repo/db/Database",
) {}
