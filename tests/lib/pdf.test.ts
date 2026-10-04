import { describe, it, expect } from "vitest";
import { extractPdfText } from "@/lib/pdf";
import path from "node:path";

describe("extractPdfText", () => {
  it("extracts text from a 1-page PDF", async () => {
    const pages = await extractPdfText(path.resolve("tests/fixtures/sample.pdf"));
    expect(pages).toHaveLength(1);
    expect(pages[0].page).toBe(1);
    expect(pages[0].text.toLowerCase()).toContain("hello");
    expect(pages[0].text.toLowerCase()).toContain("kfp");
  });
});
