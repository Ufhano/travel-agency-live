import type { SupportedIngestKind } from "./types";

/** Lowercase MIME segments we classify as spreadsheets */
const EXCEL_MIMES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
]);

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/webp",
]);

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

/** Infer parser category from extension and optional Content-Type */
export function detectFileType(opts: {
  filename: string;
  mime?: string | null;
}): SupportedIngestKind | "unknown" {
  const ext = extensionOf(opts.filename);
  const mime = (opts.mime ?? "").trim().toLowerCase();
  const main = mime.split(";")[0].trim();

  if (main === "application/pdf" || ext === ".pdf") return "pdf";

  if (
    IMAGE_MIMES.has(main) ||
    ext === ".png" ||
    ext === ".jpg" ||
    ext === ".jpeg" ||
    ext === ".webp"
  )
    return "image";

  if (
    main === "text/csv" ||
    main === "application/csv" ||
    ext === ".csv"
  )
    return "csv";

  if (
    EXCEL_MIMES.has(main) ||
    ext === ".xlsx" ||
    ext === ".xls"
  )
    return "excel";

  if (mime.startsWith("image/")) return "image";

  return "unknown";
}
