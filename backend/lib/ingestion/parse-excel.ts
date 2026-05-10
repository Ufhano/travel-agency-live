import * as XLSX from "xlsx";

/** Per-sheet row objects with string keys from headers; all sheets merged */
export function parseExcel(buffer: Buffer, logs: string[]): Record<string, unknown>[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: false });
  } catch (e) {
    logs.push(`Excel read failed: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }

  const merged: Record<string, unknown>[] = [];
  let sheetCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    let rows: Record<string, unknown>[];
    try {
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
        raw: false,
      });
    } catch (e) {
      logs.push(`Sheet "${sheetName}" JSON export failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    sheetCount += 1;
    for (const row of rows) {
      if (isEmptyRowObject(row)) continue;
      merged.push({ ...row, _sheet: sheetName });
    }
  }

  logs.push(`Excel read ${sheetCount} sheet(s) → ${merged.length} populated row(s).`);

  return merged;
}

function isEmptyRowObject(row: Record<string, unknown>): boolean {
  const vals = Object.values(row).filter((k) => k !== "_sheet");
  return vals.every((v) => v == null || String(v).trim() === "");
}
