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

/** Per-tenant override store for the no-DB fallback (DATABASE_URL unset). */
const memoryTermsByTenant = new Map<string, string[]>();

export type ParseTermsResult =
  | { ok: true; terms: string[] }
  | { ok: false; error: string };

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

/** Coerce a raw DB / JSON value into a clean string[] (or null if unusable). */
function coerceStoredTerms(value: unknown): string[] | null {
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

export async function ensureInvoiceTermsSchema(sql: SqlExecutor): Promise<void> {
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS invoice_terms JSONB`;
}

/** Terms for a tenant, falling back to the default template wording. */
export async function getInvoiceTerms(
  sql: SqlExecutor | undefined,
  tenantId: string,
): Promise<string[]> {
  if (!sql) {
    return memoryTermsByTenant.get(tenantId) ?? [...DEFAULT_INVOICE_TERMS];
  }
  try {
    await ensureInvoiceTermsSchema(sql);
    const rows = (await sql`
      SELECT invoice_terms FROM tenants WHERE id = ${tenantId} LIMIT 1
    `) as { invoice_terms: unknown }[];
    const stored = coerceStoredTerms(rows[0]?.invoice_terms);
    return stored ?? [...DEFAULT_INVOICE_TERMS];
  } catch {
    return [...DEFAULT_INVOICE_TERMS];
  }
}

export async function setInvoiceTerms(
  sql: SqlExecutor | undefined,
  tenantId: string,
  terms: string[],
): Promise<void> {
  if (!sql) {
    memoryTermsByTenant.set(tenantId, terms);
    return;
  }
  await ensureInvoiceTermsSchema(sql);
  await sql`
    UPDATE tenants SET invoice_terms = ${JSON.stringify(terms)}::jsonb WHERE id = ${tenantId}
  `;
}
