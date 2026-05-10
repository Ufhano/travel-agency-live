export type SupportedIngestKind = "excel" | "csv" | "pdf" | "image";

export interface NormalizedTravelRecord {
  date: string | null;
  month: string;
  year: number;
  origin: string | null;
  destination: string | null;
  sector: string | null;
  client: string | null;
  amount: number | null;
  reference: string | null;
}

export interface MonthBucket {
  destinations: string[];
  sectors: string[];
  records: NormalizedTravelRecord[];
}

/** year → month name → aggregates */
export type GroupedStructuredData = Record<string, Record<string, MonthBucket>>;

export interface IngestResult {
  structuredData: GroupedStructuredData;
  rawExtractedText: string;
  rawRows: Array<Record<string, unknown>>;
  logs: string[];
}
