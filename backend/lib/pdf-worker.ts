import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PDFParse } from "pdf-parse";

let configured = false;

/** Worker paths shipped with pdfjs-dist 4.x–5.x */
const WORKER_SEGMENT_LISTS = [
  ["legacy", "build", "pdf.worker.mjs"],
  ["legacy", "build", "pdf.worker.min.mjs"],
  ["build", "pdf.worker.mjs"],
  ["build", "pdf.worker.min.mjs"],
] as const;

/**
 * Under npm workspaces, `pdfjs-dist` often lives at the repo root while `next dev`
 * runs with `cwd` set to `frontend/`. Walk upward so PDF.js resolves the real worker.
 */
function resolvePdfWorkerPath(): string {
  let dir = process.cwd();
  const seen = new Set<string>();

  for (let depth = 0; depth < 10; depth++) {
    if (seen.has(dir)) break;
    seen.add(dir);

    const nm = path.join(dir, "node_modules", "pdfjs-dist");

    for (const segs of WORKER_SEGMENT_LISTS) {
      const candidate = path.join(nm, ...segs);
      if (existsSync(candidate)) return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    "pdfjs-dist worker file not found. From the repo root run: npm install (ensure pdf-parse / pdfjs-dist are installed).",
  );
}

/**
 * Turbopack / Next can break pdf.js fake-worker resolution — point pdf.js at the
 * real worker file on disk.
 */
export function ensurePdfJsWorker(): void {
  if (configured) return;

  PDFParse.setWorker(pathToFileURL(resolvePdfWorkerPath()).href);

  configured = true;
}
