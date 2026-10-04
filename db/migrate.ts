import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";

// migrate.ts is invoked from the CLI via tsx, which does not auto-load .env.local
// the way Next.js does at runtime. We read DATABASE_URL directly from process.env
// with a default that matches the app's default, instead of going through the
// strict zod-validated env() loader (which would require ANTHROPIC_API_KEY to be
// set just to run a migration).
const url = (process.env.DATABASE_URL ?? "file:./db/kfp-demo.db").replace(/^file:/, "");
const dbPath = path.resolve(process.cwd(), url);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./db/migrations" });

// FTS5 virtual table for C3 lease-section retrieval. Drizzle does not model virtual
// tables, so we exec the DDL directly. IF NOT EXISTS makes this safe to re-run.
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS lease_sections_fts USING fts5(
    lease_id, section, page UNINDEXED, text
  );
`);

console.log("Migrations applied to", dbPath);
sqlite.close();
