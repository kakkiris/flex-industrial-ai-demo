import { describe, it, expect } from "vitest";
import { loadEnv } from "@/lib/env";

describe("loadEnv", () => {
  it("requires ANTHROPIC_API_KEY", () => {
    expect(() => loadEnv({})).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("returns defaults for optional keys", () => {
    const env = loadEnv({ ANTHROPIC_API_KEY: "sk-test" });
    expect(env.DATABASE_URL).toBe("file:./db/kfp-demo.db");
    expect(env.NEXT_PUBLIC_APP_NAME).toBe("FlexOps AI Demo Suite");
    expect(env.SLACK_WEBHOOK_URL).toBeUndefined();
  });

  it("rejects an invalid SLACK_WEBHOOK_URL", () => {
    expect(() => loadEnv({
      ANTHROPIC_API_KEY: "sk-test",
      SLACK_WEBHOOK_URL: "not a url",
    })).toThrow(/SLACK_WEBHOOK_URL/);
  });
});
