import type { Config } from "drizzle-kit";

// Drizzle config. The schema file lands in Task 3; until then `pnpm db:generate`
// will fail with a clear "schema file not found" message rather than a missing-config
// error. Keep this file in sync with db/client.ts when the schema lands.
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: { url: "./db/kfp-demo.db" },
} satisfies Config;
