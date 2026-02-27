/**
 * PgDrizzle Service Tag
 *
 * Lightweight module containing only the PgDrizzle service tag.
 * Import from here (instead of the full pg-drizzle module) when you only need
 * the tag for type-level references (e.g. middleware definitions), to avoid
 * pulling in Node.js-only dependencies like pg.
 *
 * @module
 */
import { ServiceMap } from "effect"
import type { PgRemoteDatabase } from "drizzle-orm/pg-proxy"

/**
 * PgDrizzle service tag — provides a Drizzle PgRemoteDatabase instance.
 */
export class PgDrizzle extends ServiceMap.Service<
  PgDrizzle,
  PgRemoteDatabase
>()("@repo/db/PgDrizzle") {}
