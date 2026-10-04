import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { env } from "@/lib/env";
import path from "node:path";
import fs from "node:fs";

const url = env().DATABASE_URL.replace(/^file:/, "");
const absolute = path.resolve(process.cwd(), url);
fs.mkdirSync(path.dirname(absolute), { recursive: true });

const sqlite = new Database(absolute);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
