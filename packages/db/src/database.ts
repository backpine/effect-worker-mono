import { Context } from "effect"
import type { SqlClient } from "effect/sql"

/** Query programs use the SQL client provided by the caller. */
export class Database extends Context.Service<Database, SqlClient.SqlClient>()(
  "@repo/db/Database",
) {}
