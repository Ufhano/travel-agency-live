export { detectFileType } from "./detect-file-type";
export { ingestFile } from "./ingest";
export {
  normalizeRecord,
  normalizeRecords,
  parseMoney,
} from "./normalize-data";
export { groupByMonth } from "./group-by-month";
export { parseExcel } from "./parse-excel";
export { parseCsv } from "./parse-csv";
export { parsePdf } from "./parse-pdf";
export { parseImageWithOcr } from "./parse-image";
export { extractRowsFromFreeText } from "./extract-from-text";
export type {
  GroupedStructuredData,
  IngestResult,
  MonthBucket,
  NormalizedTravelRecord,
  SupportedIngestKind,
} from "./types";
