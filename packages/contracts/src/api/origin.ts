import { Schema } from "effect"

/** The contract supplies the /api prefix. Clients configure only the origin. */
export const ApiOriginSchema = Schema.URLFromString.check(Schema.makeFilter((url) =>
  ((url.protocol === "http:" || url.protocol === "https:") &&
    url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash) ||
  "Expected an HTTP(S) origin such as http://localhost:8787",
))
