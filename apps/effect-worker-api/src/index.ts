import { makeWorker } from "@/runtime"
import { DatabaseLive } from "@/services/database"

export default makeWorker(DatabaseLive) satisfies ExportedHandler<Env>
