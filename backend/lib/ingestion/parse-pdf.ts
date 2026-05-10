import { PDFParse } from "pdf-parse";

import { ensurePdfJsWorker } from "../pdf-worker";
import { extractRowsFromFreeText } from "./extract-from-text";

export async function parsePdf(
  buffer: Buffer,
  logs: string[],
): Promise<{ rows: Record<string, unknown>[]; text: string }> {
  ensurePdfJsWorker();
  let text = "";
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const parsed = await parser.getText();
      text = (parsed.text ?? "").trim();
    } finally {
      await parser.destroy();
    }
  } catch (e) {
    logs.push(`PDF parse failed: ${e instanceof Error ? e.message : String(e)}`);
    return { rows: [], text: "" };
  }

  if (!text) logs.push("PDF contained no extractable text (may be image-only — try image upload + OCR).");

  const rows = extractRowsFromFreeText(text, logs);
  return { rows, text };
}
