import path from "node:path";
import { pathToFileURL } from "node:url";

import { PDFParse } from "pdf-parse";

let configured = false;

/**
 * Turbopack / Next can break pdf.js fake-worker resolution. Point pdf.js at the
 * on-disk pdfjs-dist worker shipped with npm (avoid webpack analyzing `resolve()` paths).
 */
export function ensurePdfJsWorker(): void {
  if (configured) return;

  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs",
  );
  PDFParse.setWorker(pathToFileURL(workerPath).href);

  configured = true;
}
