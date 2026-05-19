import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** ZIP / Office Open XML signature */
export function isXlsxBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
    (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
  );
}

export function resolveExcelExtractScript(): string | null {
  let dir = process.cwd();
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    if (seen.has(dir)) break;
    seen.add(dir);
    const candidate = path.join(dir, "backend", "python", "excel_extract.py");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function pythonArgvCandidates(): string[][] {
  const exe = process.env.PYTHON?.trim();
  if (exe) return [[exe]];
  if (process.platform === "win32")
    return [["py", "-3"], ["python"], ["python3"]];
  return [["python3"], ["python"]];
}

export type PythonExcelSheetMeta = {
  name: string;
  headerRow: number | null;
  columnHeaders: string[];
};

export type PythonExcelResult = {
  ok: boolean;
  rows: Record<string, unknown>[];
  sheets?: PythonExcelSheetMeta[];
  logs: string[];
  error?: string;
};

/**
 * Runs `backend/python/excel_extract.py` on a temp .xlsx file.
 * Install: `pip install -r backend/python/requirements.txt`
 * Override interpreter: `PYTHON=C:\\path\\to\\python.exe`
 */
export async function runPythonExcelExtract(
  buffer: Buffer,
): Promise<PythonExcelResult> {
  const script = resolveExcelExtractScript();
  if (!script)
    return {
      ok: false,
      rows: [],
      logs: [],
      error: "backend/python/excel_extract.py not found from cwd",
    };

  const tmpDir = path.join(os.tmpdir(), "travel-agency-xlsx");
  await mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(
    tmpDir,
    `ingest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.xlsx`,
  );
  await writeFile(tmpFile, buffer);

  const attempts = pythonArgvCandidates();
  let lastErr = "";

  try {
    for (const argv0 of attempts) {
      const cmd = argv0[0];
      const prefix = argv0.slice(1);
      try {
        const { stdout } = await execFileAsync(
          cmd,
          [...prefix, script, tmpFile],
          {
            maxBuffer: 48 * 1024 * 1024,
            timeout: 120_000,
            windowsHide: true,
          },
        );
        const parsed = JSON.parse(stdout.trim()) as {
          ok?: boolean;
          rows?: Record<string, unknown>[];
          sheets?: {
            name?: string;
            header_row?: number | null;
            column_headers?: string[];
          }[];
          logs?: string[];
          error?: string;
        };
        if (!parsed.ok)
          return {
            ok: false,
            rows: [],
            logs: parsed.logs ?? [],
            error: parsed.error ?? "Python reported ok=false",
          };
        const sheets: PythonExcelSheetMeta[] = Array.isArray(parsed.sheets)
          ? parsed.sheets
              .filter((s) => s && typeof s.name === "string")
              .map((s) => ({
                name: s.name as string,
                headerRow:
                  typeof s.header_row === "number" ? s.header_row : null,
                columnHeaders: Array.isArray(s.column_headers)
                  ? s.column_headers.map((h) => String(h ?? ""))
                  : [],
              }))
          : [];
        return {
          ok: true,
          rows: Array.isArray(parsed.rows) ? parsed.rows : [],
          sheets,
          logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    return {
      ok: false,
      rows: [],
      logs: [],
      error: `Python not runnable (${attempts.map((a) => a.join(" ")).join(" | ")}): ${lastErr}`,
    };
  } finally {
    try {
      await unlink(tmpFile);
    } catch {
      /* temp cleanup best-effort */
    }
  }
}
