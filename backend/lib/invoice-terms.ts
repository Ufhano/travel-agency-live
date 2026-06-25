type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

/** Wording preserved from Mulisa Mapfumo Lesotho template (.docx). */
export const DEFAULT_INVOICE_TERMS: string[] = [
  "A non- refundable deposit of R800-00 per person is payable to Secure the booking.",
  "The remaining amount should be paid in instalments.",
  "Note that the snow activities are not included on the package",
  "50% of the amount must be paid 2 months before departure",
  "The full amount must be paid on or before 30 days of departure.",
  "Cancellations within 30 days of departure results to no refund.",
  "Cancellations due to what so ever reason when everything has been booked results to no refund, the only option available is for you to get a replacement from your side.",
  "No moving from one date to another or from one trip to another unless when we suggest it.",
  "Please note that it is your responsibility to make sure that you have a valid passport during the time of travelling.",
  "Note that the activities are not compulsory and Nendila Travel & Explorers will not be held responsible for any damages, loss and accidents that may occur during the activities.",
];

export const MAX_INVOICE_TERMS = 40;
export const MAX_INVOICE_TERM_LENGTH = 600;
export const MAX_INVOICE_TERM_SETS = 30;

/** Trip-specific (or unassigned) terms template. */
export type InvoiceTermsSet = {
  id: string;
  label: string;
  tripId: string | null;
  terms: string[];
};

/** Per-tenant terms: a default fallback plus optional trip-specific sets. */
export type InvoiceTermsConfig = {
  defaultTerms: string[];
  sets: InvoiceTermsSet[];
};

/** Per-tenant override store for the no-DB fallback (DATABASE_URL unset). */
const memoryConfigByTenant = new Map<string, InvoiceTermsConfig>();

export type ParseTermsResult =
  | { ok: true; terms: string[] }
  | { ok: false; error: string };

export type ParseConfigResult =
  | { ok: true; config: InvoiceTermsConfig }
  | { ok: false; error: string };

export function defaultInvoiceTermsConfig(): InvoiceTermsConfig {
  return { defaultTerms: [...DEFAULT_INVOICE_TERMS], sets: [] };
}

export function newTermsSetId(): string {
  return `terms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Split pasted text into numbered term lines (one non-empty line = one term). */
export function termsFromPastedText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Validate and normalise a terms payload from the UI/API. */
export function parseInvoiceTermsInput(input: unknown): ParseTermsResult {
  if (!Array.isArray(input)) {
    return { ok: false, error: "Terms must be a list of lines." };
  }
  if (input.length > MAX_INVOICE_TERMS) {
    return {
      ok: false,
      error: `Too many terms (max ${MAX_INVOICE_TERMS}).`,
    };
  }

  const terms: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") {
      return { ok: false, error: "Each term must be text." };
    }
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_INVOICE_TERM_LENGTH) {
      return {
        ok: false,
        error: `A term is too long (max ${MAX_INVOICE_TERM_LENGTH} characters).`,
      };
    }
    terms.push(trimmed);
  }

  if (terms.length === 0) {
    return { ok: false, error: "Add at least one term." };
  }

  return { ok: true, terms };
}

function parseTermsSetInput(raw: unknown): ParseTermsResult & { label?: string; tripId?: string | null; id?: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Each terms set must be an object." };
  }
  const obj = raw as Record<string, unknown>;
  const parsedTerms = parseInvoiceTermsInput(obj.terms);
  if (!parsedTerms.ok) return parsedTerms;

  const label = typeof obj.label === "string" ? obj.label.trim() : "";
  const tripId =
    obj.tripId === null || obj.tripId === undefined
      ? null
      : typeof obj.tripId === "string" && obj.tripId.trim()
        ? obj.tripId.trim()
        : null;
  const id =
    typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : newTermsSetId();

  return {
    ok: true,
    terms: parsedTerms.terms,
    label: label || "Trip terms",
    tripId,
    id,
  };
}

/** Validate a full invoice terms config from the settings UI. */
export function parseInvoiceTermsConfigInput(input: unknown): ParseConfigResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid terms configuration." };
  }
  const obj = input as Record<string, unknown>;

  const defaultParsed = parseInvoiceTermsInput(obj.defaultTerms);
  if (!defaultParsed.ok) {
    return { ok: false, error: `Default terms: ${defaultParsed.error}` };
  }

  if (!Array.isArray(obj.sets)) {
    return { ok: false, error: "Trip terms sets must be a list." };
  }
  if (obj.sets.length > MAX_INVOICE_TERM_SETS) {
    return {
      ok: false,
      error: `Too many trip term sets (max ${MAX_INVOICE_TERM_SETS}).`,
    };
  }

  const sets: InvoiceTermsSet[] = [];
  const usedTripIds = new Set<string>();

  for (const rawSet of obj.sets) {
    const parsed = parseTermsSetInput(rawSet);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    if (parsed.tripId) {
      if (usedTripIds.has(parsed.tripId)) {
        return {
          ok: false,
          error: "Each trip can only have one terms set.",
        };
      }
      usedTripIds.add(parsed.tripId);
    }
    sets.push({
      id: parsed.id!,
      label: parsed.label!,
      tripId: parsed.tripId ?? null,
      terms: parsed.terms,
    });
  }

  return {
    ok: true,
    config: { defaultTerms: defaultParsed.terms, sets },
  };
}

/** Coerce a raw DB / JSON value into a clean string[] (legacy format). */
function coerceStoredTermsArray(value: unknown): string[] | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  const terms = parsed
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return terms.length > 0 ? terms : null;
}

function coerceStoredSet(raw: unknown): InvoiceTermsSet | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const terms = coerceStoredTermsArray(obj.terms);
  if (!terms) return null;
  const id =
    typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : newTermsSetId();
  const label =
    typeof obj.label === "string" && obj.label.trim()
      ? obj.label.trim()
      : "Trip terms";
  const tripId =
    obj.tripId === null || obj.tripId === undefined
      ? null
      : typeof obj.tripId === "string" && obj.tripId.trim()
        ? obj.tripId.trim()
        : null;
  return { id, label, tripId, terms };
}

/** Coerce stored JSONB into the current config shape (supports legacy string[]). */
export function coerceStoredInvoiceTermsConfig(value: unknown): InvoiceTermsConfig {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return defaultInvoiceTermsConfig();
    }
  }

  if (Array.isArray(parsed)) {
    const legacy = coerceStoredTermsArray(parsed);
    return legacy
      ? { defaultTerms: legacy, sets: [] }
      : defaultInvoiceTermsConfig();
  }

  if (!parsed || typeof parsed !== "object") {
    return defaultInvoiceTermsConfig();
  }

  const obj = parsed as Record<string, unknown>;
  const defaultTerms =
    coerceStoredTermsArray(obj.defaultTerms) ?? [...DEFAULT_INVOICE_TERMS];
  const sets: InvoiceTermsSet[] = [];
  if (Array.isArray(obj.sets)) {
    for (const raw of obj.sets) {
      const set = coerceStoredSet(raw);
      if (set) sets.push(set);
    }
  }
  return { defaultTerms, sets };
}

/** Resolve which terms to print for a given trip. */
export function resolveInvoiceTermsForTrip(
  config: InvoiceTermsConfig,
  tripId: string | null | undefined,
): string[] {
  if (tripId) {
    const match = config.sets.find((s) => s.tripId === tripId);
    if (match && match.terms.length > 0) return match.terms;
  }
  return config.defaultTerms.length > 0
    ? config.defaultTerms
    : [...DEFAULT_INVOICE_TERMS];
}

export async function ensureInvoiceTermsSchema(sql: SqlExecutor): Promise<void> {
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS invoice_terms JSONB`;
}

async function readStoredConfig(
  sql: SqlExecutor | undefined,
  tenantId: string,
): Promise<InvoiceTermsConfig> {
  if (!sql) {
    return (
      memoryConfigByTenant.get(tenantId) ?? defaultInvoiceTermsConfig()
    );
  }
  try {
    await ensureInvoiceTermsSchema(sql);
    const rows = (await sql`
      SELECT invoice_terms FROM tenants WHERE id = ${tenantId} LIMIT 1
    `) as { invoice_terms: unknown }[];
    return coerceStoredInvoiceTermsConfig(rows[0]?.invoice_terms);
  } catch {
    return defaultInvoiceTermsConfig();
  }
}

/** Full terms config for a tenant. */
export async function getInvoiceTermsConfig(
  sql: SqlExecutor | undefined,
  tenantId: string,
): Promise<InvoiceTermsConfig> {
  return readStoredConfig(sql, tenantId);
}

/** Legacy helper — returns default terms only. */
export async function getInvoiceTerms(
  sql: SqlExecutor | undefined,
  tenantId: string,
): Promise<string[]> {
  const config = await readStoredConfig(sql, tenantId);
  return config.defaultTerms;
}

export async function setInvoiceTermsConfig(
  sql: SqlExecutor | undefined,
  tenantId: string,
  config: InvoiceTermsConfig,
): Promise<void> {
  if (!sql) {
    memoryConfigByTenant.set(tenantId, config);
    return;
  }
  await ensureInvoiceTermsSchema(sql);
  await sql`
    UPDATE tenants SET invoice_terms = ${JSON.stringify(config)}::jsonb WHERE id = ${tenantId}
  `;
}

/** Legacy helper — updates only default terms, preserving trip sets. */
export async function setInvoiceTerms(
  sql: SqlExecutor | undefined,
  tenantId: string,
  terms: string[],
): Promise<void> {
  const config = await readStoredConfig(sql, tenantId);
  config.defaultTerms = terms;
  await setInvoiceTermsConfig(sql, tenantId, config);
}

/** Update or create the terms set linked to a trip (inline invoice edit). */
export async function upsertInvoiceTermsForTrip(
  sql: SqlExecutor | undefined,
  tenantId: string,
  tripId: string,
  terms: string[],
  label?: string,
): Promise<InvoiceTermsConfig> {
  const config = await readStoredConfig(sql, tenantId);
  const ix = config.sets.findIndex((s) => s.tripId === tripId);
  if (ix >= 0) {
    config.sets[ix] = {
      ...config.sets[ix]!,
      terms,
      label: label?.trim() || config.sets[ix]!.label,
    };
  } else {
    config.sets.push({
      id: newTermsSetId(),
      label: label?.trim() || "Trip terms",
      tripId,
      terms,
    });
  }
  await setInvoiceTermsConfig(sql, tenantId, config);
  return config;
}
