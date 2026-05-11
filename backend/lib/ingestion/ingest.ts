import { detectFileType } from "./detect-file-type";
import { groupByMonth } from "./group-by-month";
import { normalizeRecords } from "./normalize-data";
import { parseCsv } from "./parse-csv";
import { parseExcel } from "./parse-excel";
import { parseImageWithOcr } from "./parse-image";
import { parsePdf } from "./parse-pdf";
import type { IngestResult } from "./types";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * End-to-end ingestion: detect type → parse → normalize → group.
 * Designed to log and continue on partial failure.
 */
export async function ingestFile(opts: {
  buffer: Buffer;
  filename: string;
  mime?: string | null;
  maxBytes?: number;
}): Promise<IngestResult> {
  const logs: string[] = [];
  const max = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  if (opts.buffer.length > max) {
    logs.push(`Rejected: file exceeds ${max} bytes.`);
    return {
      structuredData: {},
      rawExtractedText: "",
      rawRows: [],
      logs,
    };
  }

  const kind = detectFileType({
    filename: opts.filename,
    mime: opts.mime ?? null,
  });
  logs.push(`Detected category: ${kind}.`);

  let rawRows: Record<string, unknown>[] = [];
  let rawExtractedText = "";

  try {
    if (kind === "unknown") {
      logs.push(
        "Unsupported file type (use .xlsx, .xls, .csv, .pdf, .png, .jpg, .jpeg, .webp).",
      );
      return {
        structuredData: {},
        rawExtractedText: "",
        rawRows: [],
        logs,
      };
    }

    if (kind === "excel") {
      rawRows = await parseExcel(opts.buffer, logs);
      rawExtractedText = safeJsonPreview(rawRows);
    } else if (kind === "csv") {
      rawRows = parseCsv(opts.buffer, logs);
      rawExtractedText = safeJsonPreview(rawRows);
    } else if (kind === "pdf") {
      const { rows, text } = await parsePdf(opts.buffer, logs);
      rawRows = rows;
      rawExtractedText = text;
    } else {
      const { rows, text } = await parseImageWithOcr(opts.buffer, logs);
      rawRows = rows;
      rawExtractedText = text;
    }
  } catch (e) {
    logs.push(
      `Parser failure: ${e instanceof Error ? e.message : String(e)}`,
    );
    return {
      structuredData: {},
      rawExtractedText,
      rawRows,
      logs,
    };
  }

  const normalized = normalizeRecords(rawRows, logs);
  const structuredData = groupByMonth(normalized);

  return {
    structuredData,
    rawExtractedText,
    rawRows,
    logs,
  };
}

function safeJsonPreview(rows: unknown[], max = 32_000): string {
  try {
    const s = JSON.stringify(rows, null, 0);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return "[unserializable raw rows]";
  }
}
