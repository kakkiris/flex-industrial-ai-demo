import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([300, 200]);
  page.drawText("Hello world from KFP test fixture", {
    x: 30,
    y: 100,
    size: 14,
    font,
  });
  const bytes = await pdf.save();
  const out = path.resolve("tests/fixtures/sample.pdf");
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, bytes);
  console.log("Wrote", out, `(${bytes.byteLength} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
