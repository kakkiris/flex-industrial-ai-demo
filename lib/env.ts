import { z } from "zod";

const Env = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY required"),
  DATABASE_URL: z.string().default("file:./db/kfp-demo.db"),
  SLACK_WEBHOOK_URL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().url().optional(),
  ),
  NEXT_PUBLIC_APP_NAME: z.string().default("FlexOps AI Demo Suite"),
});

export type AppEnv = z.infer<typeof Env>;

export function loadEnv(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AppEnv {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid env: ${msg}`);
  }
  return parsed.data;
}

let cached: AppEnv | null = null;
export function env(): AppEnv {
  if (!cached) cached = loadEnv();
  return cached;
}
