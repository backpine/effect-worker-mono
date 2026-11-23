/** The Drizzle service used by query programs. The caller provides its connection. */
import { Context } from "effect"
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres"

export class Database extends Context.Service<Database, EffectPgDatabase>()(
  "@repo/db/Database",
) {}
