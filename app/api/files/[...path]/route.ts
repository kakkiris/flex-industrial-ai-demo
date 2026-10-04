import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const ALLOWED_ROOTS = [
  "uploads",
  "db/seed/lease-fixtures",
  "db/seed/om-fixtures",
  "db/seed/psa-fixtures",
  "docs",  // for reference docs (e.g., docs/reference/a2-cold-call-script.md surfaced on the Home grid)
];

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { path: parts } = await params;
    const rel = parts.join("/");
    const allowed = ALLOWED_ROOTS.some((root) => rel === root || rel.startsWith(root + "/"));
    if (!allowed) {
      return new Response("not found", { status: 404 });
    }

    const cwd = process.cwd();
    const abs = path.resolve(cwd, rel);
    // Reject any path that escapes cwd via "..".
    if (!abs.startsWith(cwd + path.sep) && abs !== cwd) {
      return new Response("not found", { status: 404 });
    }

    const data = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const contentType =
      ext === ".pdf" ? "application/pdf" :
      ext === ".png" ? "image/png" :
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      ext === ".md" ? "text/markdown; charset=utf-8" :
      ext === ".txt" ? "text/plain; charset=utf-8" :
      "application/octet-stream";

    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=300",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
