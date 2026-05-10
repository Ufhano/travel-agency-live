import Papa from "papaparse";

export function parseCsv(buffer: Buffer, logs: string[]): Record<string, unknown>[] {
  let text: string;
  try {
    text = stripBom(buffer.toString("utf8"));
  } catch (e) {
    logs.push(`CSV UTF-8 decode failed: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }

  let delimiter = ",";
  try {
    const sampleLine =
      text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
    const guess = Papa.parse(sampleLine, { preview: 1 });
    if (guess.meta.delimiter) delimiter = guess.meta.delimiter;
  } catch {
    logs.push("CSV delimiter auto-detect failed; using comma.");
  }

  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
    delimiter,
    transformHeader: (h) => String(h).trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });

  for (const err of parsed.errors) {
    logs.push(`CSV warning (row ${String(err.row ?? "?")}): ${err.message}`);
  }

  const rows = (parsed.data ?? []).filter(
    (row) => row && typeof row === "object" && !isCsvRowEmpty(row),
  ) as Record<string, unknown>[];

  logs.push(`CSV parsed ${rows.length} data rows (delimiter: ${JSON.stringify(delimiter)}).`);

  return rows;
}

function stripBom(s: string): string {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

function isCsvRowEmpty(row: Record<string, unknown>): boolean {
  return Object.values(row).every(
    (v) => v == null || (typeof v === "string" && v.trim() === ""),
  );
}
