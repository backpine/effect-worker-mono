import { env } from "cloudflare:workers"
import { makeWorker } from "./runtime"

export default makeWorker({
  apiUrl: env.API_URL,
  localUserTools: env.LOCAL_USER_TOOLS === "true",
}) satisfies ExportedHandler<Env>
