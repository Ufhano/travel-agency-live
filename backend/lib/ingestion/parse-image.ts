import { extractRowsFromFreeText } from "./extract-from-text";

/** OCR via tesseract.js; output is routed through the same text heuristics as PDF */
export async function parseImageWithOcr(
  buffer: Buffer,
  logs: string[],
): Promise<{ rows: Record<string, unknown>[]; text: string }> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", undefined, {
      logger: (m) => {
        if (m.status === "loading tesseract core")
          logs.push("OCR: loading engine (first request may take a moment)…");
        if (m.status === "recognizing text" && m.progress >= 1)
          logs.push("OCR: recognition complete.");
      },
    });

    try {
      const {
        data: { text },
      } = await worker.recognize(buffer);
      const raw = String(text ?? "").trim();
      const rows = extractRowsFromFreeText(raw, logs);
      return { rows, text: raw };
    } finally {
      await worker.terminate();
    }
  } catch (e) {
    logs.push(
      `Image OCR failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return { rows: [], text: "" };
  }
}
