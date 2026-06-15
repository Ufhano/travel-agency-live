import * as XLSX from 'xlsx';

import { isXlsxBuffer, runPythonExcelExtract } from './ingestion/parse-excel-python';
import type { PaymentInstallment } from './payment-schedule';

/** One logical record from a row or PDF heuristic pass. */
export type ImportExtractResult = {
  client: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    tripHint: string | null;
    packagePrice: number | null;
    balanceDueDate: string | null;
    /** Money still owed (from “Outstanding” column on payment trackers). */
    outstandingAmount: number | null;
  };
  payment: {
    invoiceNumber: string | null;
    amount: number | null;
    paidAt: string | null;
    method: string | null;
    note: string | null;
    /** Per-month amounts from group payment tracker columns. */
    installments?: PaymentInstallment[];
  };
  sourceRow?: number;
  /** Excel worksheet tab name when present — often encodes destination / product line. */
  sourceSheet?: string | null;
  confidence: 'high' | 'medium' | 'low';
};

/** Per-sheet column discovery stored server-side — not shown in import UI. */
export type ImportSheetMeta = {
  name: string;
  headerRow: number | null;
  columnHeaders: string[];
  /** Raw/sanitized header → logical field (fullName, email, …). */
  columnMapping: Record<string, string>;
};

export type ImportSpreadsheetMeta = {
  sheets: ImportSheetMeta[];
};

export type SpreadsheetImportResult = {
  rows: ImportExtractResult[];
  columnMeta?: ImportSpreadsheetMeta;
};

/** Internal workbook tabs (cabin/passport admin) — not traveller payment groups. */
export function isImportIgnoredWorksheet(sheetName: string): boolean {
  const n = sheetName.trim().toLowerCase();
  if (!n) return false;
  if (n === 'msc cruises 2026 admin') return true;
  return /\sadmin\s*$/.test(n);
}

const HEADER_ALIASES: Record<string, keyof NormalizedCols> = {
  fullname: 'fullName',
  name: 'fullName',
  'full name': 'fullName',
  traveller: 'fullName',
  traveler: 'fullName',
  travellername: 'fullName',
  travelername: 'fullName',
  'traveller name': 'fullName',
  'traveler name': 'fullName',
  client: 'fullName',
  customer: 'fullName',
  guest: 'fullName',
  passenger: 'fullName',
  pax: 'fullName',
  'lead traveller': 'fullName',
  'lead traveler': 'fullName',
  booker: 'fullName',

  /** Common in Excel group payment trackers */
  names: 'fullName',

  surname: '_lastName',
  surnames: '_lastName',
  lastname: '_lastName',
  'last name': '_lastName',
  familyname: '_lastName',

  forename: '_firstName',
  firstname: '_firstName',
  'first name': '_firstName',
  givenname: '_firstName',

  phone: 'phone',
  mobile: 'phone',
  cellphone: 'phone',
  'cell phone': 'phone',
  'cell no': 'phone',
  cel: 'phone',
  tel: 'phone',
  telephone: 'phone',
  'phone number': 'phone',
  'contact number': 'phone',

  email: 'email',
  'e-mail': 'email',
  mail: 'email',

  tripid: 'tripHint',
  'trip id': 'tripHint',
  trip_id: 'tripHint',
  trip: 'tripHint',
  'trip name': 'tripHint',
  departure: 'tripHint',
  tour: 'tripHint',
  destination: 'tripHint',

  packageprice: 'packagePrice',
  'package price': 'packagePrice',
  pkgprice: 'packagePrice',
  totalprice: 'packagePrice',
  'total package': 'packagePrice',
  price: 'packagePrice',

  balancedue: 'balanceDueDate',
  'balance due': 'balanceDueDate',
  'due date': 'balanceDueDate',
  balanceduedate: 'balanceDueDate',
  deadline: 'balanceDueDate',
  outstanding: '_outstandingAmount',
  'outstanding amount': '_outstandingAmount',
  'total amount to be paid': 'packagePrice',
  'total to be paid': 'packagePrice',

  invoiceno: 'invoiceNumber',
  'invoice number': 'invoiceNumber',
  'invoice ref': 'invoiceNumber',
  'invoice ref.': 'invoiceNumber',
  invoice_no: 'invoiceNumber',
  invoiceref: 'invoiceNumber',
  'booking ref': 'invoiceNumber',
  'booking reference': 'invoiceNumber',
  receiptno: 'invoiceNumber',

  amount: 'amount',
  paid: 'amount',
  payment: 'amount',
  'amount paid': 'amount',
  'payment amount': 'amount',
  'paid amount': 'amount',
  totalpaid: 'amount',
  'total paid': 'amount',

  paidat: 'paidAt',
  'paid date': 'paidAt',
  'paid at': 'paidAt',
  datepaid: 'paidAt',
  'payment date': 'paidAt',
  'date paid': 'paidAt',

  method: 'method',
  'payment method': 'method',

  note: 'note',
  notes: 'note',
  description: 'note',
};

type NormalizedCols = {
  fullName?: string;
  /** Internal: merged into fullName */
  _firstName?: string;
  _lastName?: string;
  phone?: string;
  email?: string;
  tripHint?: string;
  packagePrice?: number;
  balanceDueDate?: string;
  /** Money still owed (distinct from balance due date) */
  _outstandingAmount?: number;
  invoiceNumber?: string;
  amount?: number;
  paidAt?: string;
  method?: string;
  note?: string;
};

/** Longer aliases first so "traveller name" wins over "name" substring checks. */
const SORTED_ALIAS_KEYS = Object.keys(HEADER_ALIASES).sort((a, b) => b.length - a.length);

function normHeader(h: unknown): string {
  let s = String(h ?? '').trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
  return s
    .toLowerCase()
    .replace(/[#./_\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactHeader(h: string): string {
  return h.replace(/\s/g, '');
}

function aliasKey(h: unknown): keyof NormalizedCols | undefined {
  const n = normHeader(h);
  if (!n) return undefined;
  const c = compactHeader(n);
  if (HEADER_ALIASES[c]) return HEADER_ALIASES[c];
  return HEADER_ALIASES[n];
}

/**
 * Infer column when exact alias fails (exports use many headings; pattern is like lightweight ETL fuzzy match).
 */
function inferColumnKey(headerRaw: unknown): keyof NormalizedCols | undefined {
  const exact = aliasKey(headerRaw);
  if (exact) return exact;

  const n = normHeader(headerRaw);
  if (!n) return undefined;
  if (/^outstand/.test(n)) return '_outstandingAmount';
  if (/^total\s*package/.test(n)) return 'packagePrice';
  const compact = compactHeader(n);
  const spaced = ` ${n.replace(/\s+/g, ' ')} `;

  for (const alias of SORTED_ALIAS_KEYS) {
    const col = HEADER_ALIASES[alias];
    if (!col) continue;
    const compactAlias = compactHeader(alias).replace(/\s/g, '');
    if (!compactAlias) continue;
    if (compact === compactAlias) return col;

    const aliasPhrase = alias.toLowerCase().replace(/\s+/g, ' ').trim();
    if (/[\s/]/.test(alias) && spaced.includes(` ${aliasPhrase} `)) return col;
  }

  const substringHits = SORTED_ALIAS_KEYS.filter((alias) => {
    const compactAlias = compactHeader(alias).replace(/\s/g, '');
    if (compactAlias.length < 8) return false;
    return compact.includes(compactAlias);
  });
  if (substringHits.length) {
    substringHits.sort((a, b) => compactHeader(b).length - compactHeader(a).length);
    return HEADER_ALIASES[substringHits[0]];
  }

  for (const tok of spaced.trim().split(/\s+/)) {
    const c = compactHeader(tok);
    const col = HEADER_ALIASES[c];
    if (col) return col;
  }

  if (
    /(nominee|nominated|\btravel|\btraveler|\btraveller|\bguest\b|\bpax\b|\bpassenger\b)/.test(n) &&
    /\bname\b/.test(n) &&
    !/\btrip\s*name\b/.test(n) &&
    !/\b(email|invoice|trip\s*no|booking\s+id)\b/.test(spaced.trim())
  ) {
    return 'fullName';
  }

  return undefined;
}

function normCompare(a: string, b: string): boolean {
  return normHeader(a) === normHeader(b);
}

/** Trip / sheet titles like "Graskop 28 - 30 Aug 2026" — not person names. */
function looksLikeDestinationLabel(s: string): boolean {
  const t = s.trim();
  if (t.length < 4) return false;
  if (looksLikeBookingProductLabel(t)) return true;
  if (/\d{1,2}\s*[-–—]\s*\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/.test(t)) return true;
  if (
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(t) &&
    /\d{4}/.test(t) &&
    !looksLikePersonName(t)
  )
    return true;
  if (
    /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/.test(t) &&
    !looksLikePersonName(t) &&
    t.split(/\s+/).length <= 6
  )
    return true;
  return false;
}

const ASSIGNABLE_FIELDS: (keyof NormalizedCols)[] = [
  'fullName',
  '_firstName',
  '_lastName',
  'phone',
  'email',
  'tripHint',
  'packagePrice',
  'balanceDueDate',
  '_outstandingAmount',
  'invoiceNumber',
  'amount',
  'paidAt',
  'method',
  'note',
];

function collectColumnSamples(
  rows: Record<string, unknown>[],
  headerKey: string,
  max = 40,
): unknown[] {
  const out: unknown[] = [];
  for (const row of rows) {
    const v = row[headerKey];
    if (v != null && v !== '') out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function scoreHeaderForField(header: string, field: keyof NormalizedCols): number {
  const inferred = inferColumnKey(header);
  const aliased = aliasKey(header);
  if (aliased === field) return 65;
  if (inferred === field) return 55;
  if (field === 'fullName' && (inferred === 'tripHint' || aliased === 'tripHint')) return -40;
  if (field === 'tripHint' && (inferred === 'fullName' || aliased === 'fullName')) return -40;
  const n = normHeader(header);
  if (field === '_outstandingAmount' && /^outstand/.test(n)) return 70;
  if (field === 'packagePrice' && /^total\s*package/.test(n)) return 70;
  return 0;
}

function scoreColumnValuesForField(
  samples: unknown[],
  field: keyof NormalizedCols,
  sheetName?: string,
): number {
  if (!samples.length) return 0;
  const n = samples.length;
  let score = 0;

  switch (field) {
    case 'fullName':
    case '_firstName':
    case '_lastName': {
      let personHits = 0;
      let destHits = 0;
      for (const s of samples) {
        const t = String(s).trim();
        if (looksLikeDestinationLabel(t) || (sheetName && normCompare(t, sheetName))) destHits++;
        else if (looksLikePersonName(t)) personHits++;
      }
      score = (personHits / n) * 85 - (destHits / n) * 120;
      break;
    }
    case 'email': {
      const hits = samples.filter((s) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim()),
      ).length;
      score = (hits / n) * 100;
      break;
    }
    case 'phone': {
      const hits = samples.filter((s) => {
        const t = String(s).trim();
        return (
          /\b(?:\+27|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/.test(t) ||
          /\b\d{10}\b/.test(t)
        );
      }).length;
      score = (hits / n) * 100;
      break;
    }
    case 'tripHint': {
      for (const s of samples) {
        const t = String(s).trim();
        if (looksLikeDestinationLabel(t)) score += 45 / n;
        if (sheetName && normCompare(t, sheetName)) score += 55 / n;
      }
      break;
    }
    case 'packagePrice':
    case 'amount':
    case '_outstandingAmount': {
      const hits = samples.filter((s) => coerceMoney(s) != null).length;
      score = (hits / n) * 90;
      break;
    }
    case 'balanceDueDate':
    case 'paidAt': {
      const hits = samples.filter((s) => coerceDate(s) != null).length;
      score = (hits / n) * 90;
      break;
    }
    case 'invoiceNumber': {
      const hits = samples.filter((s) => {
        const t = String(s).trim();
        return /\bINV[-/]?\d/i.test(t) || /^[A-Z0-9-]{4,24}$/i.test(t);
      }).length;
      score = (hits / n) * 80;
      break;
    }
    default:
      break;
  }
  return score;
}

/**
 * Lido-style phase 1: discover columns from headers + sample values, then assign fields.
 * Stored in API meta — never rendered as raw headers in the UI.
 */
function buildColumnMappingForSheet(
  sheetName: string,
  sheetRows: Record<string, unknown>[],
  rawHeaders?: string[],
): Record<string, keyof NormalizedCols> {
  const headerKeys = new Set<string>();
  for (const row of sheetRows) {
    for (const k of Object.keys(row)) {
      if (!k.startsWith('_')) headerKeys.add(k);
    }
  }
  if (rawHeaders) {
    for (const h of rawHeaders) {
      const t = String(h ?? '').trim();
      if (t) headerKeys.add(t);
    }
  }

  type Scored = {header: string; field: keyof NormalizedCols; score: number};
  const candidates: Scored[] = [];

  for (const header of headerKeys) {
    const isMonthCol = parsePaymentLedgerMonth(header) != null;
    const samples = collectColumnSamples(sheetRows, header);
    for (const field of ASSIGNABLE_FIELDS) {
      if (isMonthCol && field !== 'amount') continue;
      const total =
        scoreHeaderForField(header, field) +
        scoreColumnValuesForField(samples, field, sheetName);
      if (total >= 20) candidates.push({header, field, score: total});
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const mapping: Record<string, keyof NormalizedCols> = {};
  const assignedFields = new Set<keyof NormalizedCols>();

  for (const c of candidates) {
    if (assignedFields.has(c.field)) continue;
    if (mapping[c.header]) continue;
    mapping[c.header] = c.field;
    assignedFields.add(c.field);
  }

  return mapping;
}

function hasImportableData(r: ImportExtractResult): boolean {
  const hasClient = Boolean(
    r.client.fullName || r.client.email || r.client.phone,
  );
  const hasPayment =
    r.payment.amount != null || Boolean(r.payment.invoiceNumber);
  return hasClient || hasPayment;
}

/** Drop section-title rows (destination label only, no traveller/payment). */
/** Blank name row with only totals (e.g. 9200 sum row). */
function isSummaryTotalRow(r: ImportExtractResult): boolean {
  if (r.client.fullName?.trim()) return false;
  if (r.client.email?.trim() || r.client.phone?.trim()) return false;
  return r.payment.amount != null || r.client.packagePrice != null;
}

function isSectionOrHeaderRow(r: ImportExtractResult): boolean {
  const hasClient = Boolean(
    r.client.fullName || r.client.email || r.client.phone,
  );
  const hasPayment =
    r.payment.amount != null ||
    Boolean(r.payment.invoiceNumber || r.payment.method);
  const hasMoney =
    r.client.packagePrice != null || r.payment.amount != null;
  if (hasClient || hasPayment) return false;
  if (r.client.tripHint && !hasMoney) return true;
  return false;
}

function reconcileExtractRow(
  result: ImportExtractResult,
): ImportExtractResult | null {
  const c = result.client;
  const sheet = result.sourceSheet?.trim() ?? '';
  let fullName = c.fullName?.trim() ?? null;
  let tripHint = c.tripHint?.trim() ?? null;

  if (fullName) {
    if (
      (sheet && normCompare(fullName, sheet)) ||
      looksLikeDestinationLabel(fullName)
    ) {
      if (!tripHint) tripHint = fullName;
      fullName = null;
    }
  }

  if (!tripHint && sheet) tripHint = sheet;

  const fixed: ImportExtractResult = {
    ...result,
    client: {...c, fullName, tripHint},
  };

  if (isSectionOrHeaderRow(fixed)) return null;
  if (isSummaryTotalRow(fixed)) return null;
  if (!hasImportableData(fixed)) return null;
  return fixed;
}

/** e.g. July / Jul → 07 */
function monthWordToMm(w: string): string | null {
  const m = w.toLowerCase();
  const map: Record<string, string> = {
    january: '01',
    jan: '01',
    february: '02',
    feb: '02',
    march: '03',
    mar: '03',
    april: '04',
    apr: '04',
    may: '05',
    june: '06',
    jun: '06',
    july: '07',
    jul: '07',
    august: '08',
    aug: '08',
    september: '09',
    sep: '09',
    sept: '09',
    october: '10',
    oct: '10',
    november: '11',
    nov: '11',
    december: '12',
    dec: '12',
  };
  return map[m] ?? null;
}

/** Excel serial or common date strings → ISO yyyy-mm-dd or null */
function coerceDate(val: unknown): string | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    /* Instalment amounts (1500, 4600) are not Excel serial dates. */
    if (val < 30_000) return null;
    const parsed = XLSX.SSF.parse_date_code(val);
    if (!parsed) return null;
    const m = String(parsed.m).padStart(2, '0');
    const d = String(parsed.d).padStart(2, '0');
    return `${parsed.y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[/](\d{1,2})[/](\d{4})$/.exec(s);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  const m2 = /^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/.exec(s);
  if (m2) {
    const dd = m2[1].padStart(2, '0');
    const mm = m2[2].padStart(2, '0');
    return `${m2[3]}-${mm}-${dd}`;
  }
  const mWord = /\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/.exec(s);
  if (mWord) {
    const mo = monthWordToMm(mWord[2]);
    if (mo)
      return `${mWord[3]}-${mo}-${mWord[1].padStart(2, '0')}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function coerceMoney(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val))
    return Math.round(val * 100) / 100;
  if (typeof val !== 'string') return null;
  const cleaned = val
    .replace(/R\s*/gi, '')
    .replace(/ZAR\s*/gi, '')
    .trim()
    .replace(/\s/g, '')
    .replace(/,/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function mergeFirstLastName(n: NormalizedCols): void {
  const f = n._firstName?.trim();
  const l = n._lastName?.trim();
  delete n._firstName;
  delete n._lastName;
  if (f || l) {
    const combined = [f, l].filter(Boolean).join(' ').trim();
    if (combined && !n.fullName) n.fullName = combined;
    else if (combined && n.fullName && n.fullName.length < combined.length) n.fullName = combined;
  }
}

function rowToNormalized(
  row: Record<string, unknown>,
  columnMapping?: Record<string, keyof NormalizedCols>,
): NormalizedCols {
  const out: NormalizedCols = {};

  for (const [header, raw] of Object.entries(row)) {
    if (header.startsWith('_')) continue;

    const keyFinal = columnMapping
      ? columnMapping[header]
      : inferColumnKey(header) ?? aliasKey(header);
    if (!keyFinal) continue;

    const v =
      typeof raw === 'string' ? raw.trim() : raw === null || raw === undefined ? '' : raw;
    if (v === '' || v === null || v === undefined) continue;

    switch (keyFinal) {
      case '_outstandingAmount':
        {
          const o = coerceMoney(v);
          if (o != null) out[keyFinal] = o;
          break;
        }
      case '_firstName':
      case '_lastName':
      case 'fullName':
      case 'phone':
      case 'email':
      case 'tripHint':
      case 'invoiceNumber':
      case 'method':
      case 'note':
        if (keyFinal === 'fullName' || keyFinal === '_firstName' || keyFinal === '_lastName') {
          const s = String(v).trim();
          if (keyFinal === 'fullName') out.fullName = s;
          else if (keyFinal === '_firstName') out._firstName = s;
          else out._lastName = s;
        } else {
          (out as Record<string, string>)[keyFinal] = String(v).trim();
        }
        break;
      case 'packagePrice':
      case 'amount': {
        const nVal = coerceMoney(v);
        if (nVal != null) out[keyFinal] = nVal;
        break;
      }
      case 'balanceDueDate':
      case 'paidAt': {
        if (typeof v === 'number' && v < 30_000) break;
        const d = coerceDate(v);
        if (d) out[keyFinal] = d;
        break;
      }
      default:
        break;
    }
  }

  mergeFirstLastName(out);

  let inferredAmount = 0;
  const nameGuess: string[] = [];

  for (const raw of Object.values(row)) {
    if (typeof raw !== 'number' && (raw == null || raw === '')) continue;

    const strVal =
      typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';
    if (!strVal && typeof raw !== 'number') continue;

    const probe =
      typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? strVal : '';

    if (!out.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) out.email = strVal;

    if (!out.phone) {
      const p =
        strVal.match(/\b(?:\+27|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/)?.[0] ??
        strVal.match(/\b\d{10}\b/)?.[0];
      if (p) out.phone = p.replace(/\s+/g, ' ');
    }

    const mMoney = coerceMoney(raw);
    if (mMoney != null && mMoney > inferredAmount && mMoney < 999_999_999)
      inferredAmount = mMoney;

    if (!out.invoiceNumber) {
      const inv = strVal.match(/\bINV[-/]?\d{4}[-/]?\d{2,5}\b/i)?.[0];
      if (inv) out.invoiceNumber = inv.toUpperCase().replace(/\//g, '-');
    }

    if (typeof probe === 'string') {
      const tr = probe.trim();
      if (
        looksLikePersonName(tr) &&
        !looksLikeDestinationLabel(tr) &&
        !/^total|balance|deposit|trip\b/i.test(tr) &&
        !/@/.test(tr)
      ) {
        nameGuess.push(tr);
      }
    }
  }

  if (out.amount == null && inferredAmount > 0) out.amount = inferredAmount;

  if (!out.fullName && nameGuess.length) {
    nameGuess.sort((a, b) => b.trim().split(/\s+/).length - a.trim().split(/\s+/).length);
    const best = nameGuess[0].trim();
    if (!looksLikeDestinationLabel(best)) out.fullName = best;
  }

  return out;
}

/** Table / product columns like "Lesotho Package" are not people. */
function looksLikeBookingProductLabel(s: string): boolean {
  const t = s.trim();
  if (/^no\.?\s+of\s+clients?\b/i.test(t)) return true;
  if (/\b(highlights|safari|circuit|escape|getaway|experience)\b/i.test(t)) return true;
  if (/\w+\s+Package\s*$/i.test(t)) return true;
  return false;
}

function shortenTripInclusionBlob(s: string): string {
  const t = s.trim();
  const pkgTitle = /^([\s\S]{0,80}?\bPackage\b)/i.exec(t);
  if (pkgTitle?.[1]) {
    const oneLine = pkgTitle[1].replace(/\s+/g, ' ').trim();
    const beforeComma = oneLine.split(',')[0].trim();
    if (
      beforeComma.length >= 8 &&
      /\bPackage\b/i.test(beforeComma) &&
      beforeComma.length <= 60
    )
      return beforeComma;
    return oneLine.length <= 80 ? oneLine : oneLine.slice(0, 80);
  }
  const firstSeg = t.split(/[,;]/)[0].trim();
  if (firstSeg.length >= 4 && firstSeg.length <= 90) return firstSeg;
  return t.slice(0, 120).trim();
}

const STOP_NAME = new Set([
  'the',
  'and',
  'for',
  'trip',
  'invoice',
  'receipt',
  'payment',
  'total',
  'amount',
  'date',
  'method',
  'balance',
  'thank',
  'page',
  'travel',
  'agency',
  'internal',
  'preview',
]);

const PARTICLE = new Set([
  'van',
  'der',
  'den',
  'de',
  'du',
  'von',
  'le',
  'la',
  'el',
  'da',
  'st',
  'jr',
  'sr',
  'ii',
  'iii',
]);

function looksLikePersonName(s: string): boolean {
  const t = s.trim();
  if (t.length < 4 || t.length > 90) return false;
  if (/@|https?:\/\/|^\d+$|^\d[\d\s,.-]*$/.test(t)) return false;
  if (/\b(pty|ltd|inc|cc|t\/a|tel|fax|email)\b/i.test(t)) return false;
  if (looksLikeBookingProductLabel(t)) return false;

  /* Lowercase Latin names common in pasted Word / exports */
  if (/^[a-z]+(?:[\s'-][a-z]+){2,}$/i.test(t) && t.split(/\s+/).filter(Boolean).length <= 8) {
    const badFirst = new Set(['trip', 'total', 'amount', 'payment', 'invoice', 'agency', 'thank']);
    const firstToken = t.split(/\s+/)[0]?.toLowerCase();
    if (firstToken && !badFirst.has(firstToken)) return true;
  }

  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 8) return false;
  let ok = 0;
  for (const p of parts) {
    const core = p.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    if (!core) continue;
    if (PARTICLE.has(core.toLowerCase())) {
      ok++;
      continue;
    }
    const allCapsWord = /^[A-ZÄÖÜÉÌÍÎÏÓÔÙÚ]+$/.test(core) && core.length >= 3 && core.length <= 28;
    if (
      /^[A-Z][a-z]{1,24}$/.test(core) ||
      /^[A-Z]{2,3}$/.test(core) ||
      allCapsWord ||
      /^[A-Z][a-z]+-[A-Z][a-z]+$/.test(core)
    )
      ok++;
    else return false;
  }
  if (ok < 2) return false;
  const lower = t.toLowerCase();
  for (const w of STOP_NAME) {
    if (lower === w || lower.startsWith(`${w} `)) return false;
  }
  return true;
}

/** Payment tracker rows: amount paid = Total Package − Outstanding. */
function finalizePaymentTrackerAmounts(
  n: NormalizedCols,
): {amount: number | null; outstanding: number | null; balanceDueDate: string | null} {
  const ost = (n as NormalizedCols & {_outstandingAmount?: number})._outstandingAmount;
  const pkg = n.packagePrice ?? null;
  const outstanding = ost != null ? ost : null;

  let amount = n.amount ?? null;
  if (pkg != null && outstanding != null) {
    amount = paymentLedgerAmountPaid(pkg, outstanding);
  }

  let balanceDueDate = n.balanceDueDate ?? null;
  if (outstanding != null) balanceDueDate = null;

  return {amount, outstanding, balanceDueDate};
}

function spreadsheetRowToResult(
  n: NormalizedCols,
  sourceRow: number,
): ImportExtractResult {
  const {amount, outstanding, balanceDueDate} = finalizePaymentTrackerAmounts(n);
  const noteBase = n.note;
  let combinedNote =
    outstanding != null && outstanding > 0
      ? [noteBase, `Outstanding: R${Number(outstanding.toFixed(2))}`]
          .filter(Boolean)
          .join(' · ')
      : noteBase ?? null;

  const hasClient =
    Boolean(n.fullName) || Boolean(n.email) || Boolean(n.phone);
  const hasPayment =
    amount != null || Boolean(n.invoiceNumber) || Boolean(n.method);
  let confidence: ImportExtractResult['confidence'] = 'low';
  if (hasClient && hasPayment && amount != null) confidence = 'high';
  else if ((hasClient && hasPayment) || amount != null || hasClient)
    confidence = 'medium';

  return {
    client: {
      fullName: n.fullName ?? null,
      phone: n.phone ?? null,
      email: n.email ?? null,
      tripHint: n.tripHint ?? null,
      packagePrice: n.packagePrice ?? null,
      balanceDueDate,
      outstandingAmount: outstanding,
    },
    payment: {
      invoiceNumber: n.invoiceNumber ?? null,
      amount,
      paidAt: n.paidAt ?? null,
      method: n.method ?? null,
      note: combinedNote,
    },
    sourceRow,
    confidence,
  };
}

const LEDGER_MONTH_INDEX: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const LEDGER_MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function ledgerMonthLabel(month: number, year: number): string {
  const abbr = LEDGER_MONTH_ABBR[month - 1] ?? 'Mon';
  const yy = year >= 2000 ? String(year).slice(-2) : String(year);
  return `${abbr}-${yy}`;
}

/** e.g. "Aug-25", "Sept-25", "Jan-26" → yyyy-mm-01 (normHeader turns "-" into space) */
function parsePaymentLedgerMonth(cell: unknown): {
  yyyyMmDd: string;
  label: string;
} | null {
  const label = String(cell ?? '').trim().replace(/\u00a0/g, ' ');
  if (!label) return null;
  const normalized = normHeader(label).replace(/\s+/g, ' ');
  const m = /^([a-z]{3,9})\s+(\d{2}|\d{4})$/.exec(normalized);
  if (!m) return null;

  const monToken = m[1];
  const yrStr = m[2];

  const mi = LEDGER_MONTH_INDEX[monToken] ?? LEDGER_MONTH_INDEX[monToken.slice(0, 3)] ?? null;
  if (!mi) return null;

  let yr = Number.parseInt(yrStr, 10);
  if (!Number.isFinite(yr)) return null;
  if (yr < 100) yr += 2000;
  if (yr < 1980 || yr > 2100) return null;

  const mm = String(mi).padStart(2, '0');
  return {yyyyMmDd: `${yr}-${mm}-01`, label};
}

/** Month instalment columns stored as Excel serial dates in header row (raw read). */
function parsePaymentLedgerMonthFromCell(cell: unknown): {
  yyyyMmDd: string;
  label: string;
} | null {
  let probe: unknown = cell;
  if (typeof probe === 'string') {
    const t = probe.trim();
    if (/^\d{5,6}$/.test(t)) probe = Number(t);
    else if (t) {
      const textHit = parsePaymentLedgerMonth(t);
      if (textHit) return textHit;
    }
  }

  if (typeof probe !== 'number' || !Number.isFinite(probe) || probe < 30_000)
    return null;
  const parsed = XLSX.SSF.parse_date_code(probe);
  if (!parsed?.y || !parsed.m) return null;
  const mm = String(parsed.m).padStart(2, '0');
  return {
    yyyyMmDd: `${parsed.y}-${mm}-01`,
    label: ledgerMonthLabel(parsed.m, parsed.y),
  };
}

/** Amount paid on group trackers = Total Package − Outstanding. */
function paymentLedgerAmountPaid(
  packagePrice: number | null,
  outstanding: number | null,
): number | null {
  if (packagePrice == null) return null;
  const owed = outstanding ?? 0;
  return Math.max(0, Math.round((packagePrice - owed) * 100) / 100);
}

function isLedgerTravellerName(fullName: string): boolean {
  const cleaned = fullName
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned.length) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (looksLikePersonName(cleaned)) return true;
  return words.every(
    (w) =>
      w.length >= 1 &&
      (/^[\p{L}][\p{L}'.-]{0,}$/u.test(w) ||
        /^[A-ZÄÖÜ][a-zäöüß'-]+$/u.test(w) ||
        /^\d+$/.test(w)),
  );
}

type PaymentLedgerHeader = {
  headerIdx: number;
  nameCol: number;
  /** When "Names" spans surname + first name columns (header blank on second col). */
  firstNameCol: number;
  outstandingCol: number;
  totalPkgCol: number;
  monthCols: {col: number; paidAt: string; label: string}[];
};

function ledgerAdjacentFirstNameCol(
  row: unknown[],
  nameCol: number,
  matrix: unknown[][],
  headerIdx: number,
): number {
  const nextHeader = String(row[nameCol + 1] ?? '').trim();
  if (nextHeader && normHeader(nextHeader) !== 'names') return -1;

  let hits = 0;
  for (let r = headerIdx + 1; r < Math.min(matrix.length, headerIdx + 12); r++) {
    const first = String(matrix[r]?.[nameCol + 1] ?? '').trim();
    if (!first || /^\d+$/.test(first)) continue;
    if (looksLikePersonName(first) || /^[\p{L}][\p{L}'. -]{1,}$/u.test(first)) hits++;
  }
  return hits >= 2 ? nameCol + 1 : -1;
}

function ledgerTravellerFullName(
  erow: unknown[] | undefined,
  nameCol: number,
  firstNameCol: number,
): string {
  const last = String(erow?.[nameCol] ?? '').trim();
  const first =
    firstNameCol >= 0 ? String(erow?.[firstNameCol] ?? '').trim() : '';
  if (first && !/^\d+$/.test(first)) {
    return [last, first].filter(Boolean).join(' ').trim();
  }
  return last;
}

/** Find header row (titles above, index column before Names is OK). */
function detectPaymentLedgerHeader(matrix: unknown[][]): PaymentLedgerHeader | null {
  let best: PaymentLedgerHeader | null = null;
  let bestScore = -1;

  for (let r = 0; r < Math.min(matrix.length, 50); r++) {
    const row = matrix[r] ?? [];
    let nc = -1;
    let oc = -1;
    let tp = -1;
    const hits: PaymentLedgerHeader['monthCols'] = [];

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const raw = String(cell ?? '').trim();
      if (!raw) continue;
      const low = normHeader(raw);

      if (
        low === 'names' ||
        low === 'name' ||
        low === 'surnames' ||
        low === 'surname' ||
        /^names?$/.test(low) ||
        (low.includes('name') &&
          !low.includes('package') &&
          !low.includes('trip') &&
          !low.includes('invoice') &&
          !/^id\s/.test(low))
      ) {
        if (nc < 0) nc = c;
      }

      if (low === 'total package' || /^total\s*package/.test(low)) tp = c;
      if (low === 'outstanding' || /^outstand/.test(low)) oc = c;

      const mo = parsePaymentLedgerMonthFromCell(cell);
      if (mo) hits.push({col: c, paidAt: mo.yyyyMmDd, label: mo.label});
    }

    const score =
      (nc >= 0 ? 25 : 0) +
      (tp >= 0 ? 20 : 0) +
      (oc >= 0 ? 20 : 0) +
      hits.length * 4;

    const viable =
      nc >= 0 &&
      tp >= 0 &&
      (hits.length >= 1 || oc >= 0);

    if (viable && score > bestScore) {
      bestScore = score;
      best = {
        headerIdx: r,
        nameCol: nc,
        firstNameCol: ledgerAdjacentFirstNameCol(row, nc, matrix, r),
        outstandingCol: oc,
        totalPkgCol: tp,
        monthCols: hits,
      };
    }
  }

  if (best) return best;

  /* Legacy: Names + at least two month columns */
  for (let r = 0; r < Math.min(matrix.length, 50); r++) {
    const row = matrix[r] ?? [];
    let nc = -1;
    const hits: PaymentLedgerHeader['monthCols'] = [];
    let oc = -1;
    let tp = -1;

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const raw = String(cell ?? '').trim();
      if (!raw) continue;
      const low = normHeader(raw);
      if (low === 'names' || (nc < 0 && low === 'name')) nc = c;
      if (low === 'total package' || /^total\s*package/.test(low)) tp = c;
      if (low === 'outstanding' || /^outstand/.test(low)) oc = c;
      const mo = parsePaymentLedgerMonthFromCell(cell);
      if (mo) hits.push({col: c, paidAt: mo.yyyyMmDd, label: mo.label});
    }

    if (nc >= 0 && hits.length >= 2) {
      return {
        headerIdx: r,
        nameCol: nc,
        firstNameCol: ledgerAdjacentFirstNameCol(row, nc, matrix, r),
        outstandingCol: oc,
        totalPkgCol: tp,
        monthCols: hits,
      };
    }
  }

  return null;
}

/**
 * Group payment trackers: Names + month columns (Aug-25) + Total Package / Outstanding.
 * One import row per traveller; amount paid = Total Package − Outstanding.
 */
function tryParsePaymentLedger(
  sheet: XLSX.WorkSheet,
  sheetName?: string,
): ImportExtractResult[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  const detected = detectPaymentLedgerHeader(matrix);
  if (!detected) return [];

  const {headerIdx, nameCol, firstNameCol, outstandingCol, totalPkgCol, monthCols} =
    detected;

  const titlePieces: string[] = [];
  for (let tr = 0; tr < headerIdx; tr++) {
    const row = matrix[tr] ?? [];
    const rowText = row
      .map((c) => String(c ?? '').trim())
      .filter((t) => t.length >= 6 && !/^row\s*\d+/i.test(t))
      .join(' · ');
    if (rowText.length >= 8) titlePieces.push(rowText);
  }
  const tripHintMerged = [...new Set(titlePieces)].join(' · ').slice(0, 280) || null;
  const tripLabel = sheetName?.trim() || tripHintMerged;

  const travellers: ImportExtractResult[] = [];

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const erow = matrix[r];
    const fullName = ledgerTravellerFullName(erow, nameCol, firstNameCol);
    if (!fullName.length || fullName.length > 72) continue;
    if (/^(total|grand|sum|sub)\b/i.test(fullName)) continue;
    if (!isLedgerTravellerName(fullName)) continue;

    const pkgAmt: number | null = totalPkgCol >= 0 ? coerceMoney(erow?.[totalPkgCol]) : null;

    let outstandingAmt: number | null = null;
    let rowOutstandingNote: string | null = null;
    if (outstandingCol >= 0) {
      const ox = coerceMoney(erow?.[outstandingCol]);
      outstandingAmt = ox != null ? ox : 0;
      if (ox != null && ox > 0)
        rowOutstandingNote = `Row outstanding R${Number(ox.toFixed(2))}`;
    } else if (pkgAmt != null) {
      outstandingAmt = 0;
    }

    let lastPaidAt: string | null = null;
    const scheduleParts: string[] = [];
    const installments: PaymentInstallment[] = [];
    for (const mc of monthCols) {
      const instalment = coerceMoney(erow?.[mc.col]);
      if (instalment == null || instalment <= 0) continue;
      scheduleParts.push(`${mc.label}: R${instalment.toFixed(0)}`);
      installments.push({
        label: mc.label,
        amount: instalment,
        paidAt: mc.paidAt,
      });
      if (!lastPaidAt || mc.paidAt > lastPaidAt) lastPaidAt = mc.paidAt;
    }

    const amountPaid = paymentLedgerAmountPaid(pkgAmt, outstandingAmt);
    if (pkgAmt == null && amountPaid == null) continue;

    const notes = [
      scheduleParts.length ? scheduleParts.join(' · ') : null,
      rowOutstandingNote,
    ]
      .filter(Boolean)
      .join(' · ');

    travellers.push({
      client: {
        fullName,
        phone: null,
        email: null,
        tripHint: tripLabel?.length ? tripLabel : null,
        packagePrice: pkgAmt ?? null,
        balanceDueDate: null,
        outstandingAmount: outstandingAmt,
      },
      payment: {
        invoiceNumber: null,
        amount: amountPaid,
        paidAt: lastPaidAt,
        method: null,
        note: notes.length > 0 ? notes.slice(0, 500) : null,
        installments: installments.length > 0 ? installments : undefined,
      },
      sourceRow: r + 1,
      sourceSheet: sheetName ?? null,
      confidence:
        pkgAmt != null && amountPaid != null ? 'high' : 'medium',
    });
  }

  return travellers.length > 0 ? travellers : [];
}

function stripBomBuffer(buf: Buffer): Buffer {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3);
  }
  return buf;
}

function matrixToObjects(
  matrix: unknown[][],
  headerRowIndex: number,
): Record<string, unknown>[] {
  if (matrix.length <= headerRowIndex + 1) return [];
  const headers = matrix[headerRowIndex].map((c) => String(c ?? '').trim());
  const out: Record<string, unknown>[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || !row.some((c) => String(c ?? '').trim() !== '')) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      const key = h || `__col_${j}`;
      obj[key] = row[j];
    });
    out.push(obj);
  }
  return out;
}

/** Header-keyed rows (e.g. from Python per-sheet extract) → traveller/payment cards. */
export function recordsToImportExtractResults(
  rows: Record<string, unknown>[],
  sheetBlocks?: {name: string; headerRow?: number | null; columnHeaders?: string[]}[],
): {rows: ImportExtractResult[]; columnMeta: ImportSpreadsheetMeta} {
  const importRows = rows.filter((row) => {
    const sh = row._sheet;
    const sheet = typeof sh === 'string' ? sh.trim() : '';
    return !sheet || !isImportIgnoredWorksheet(sheet);
  });
  const sheetBlocksFiltered = sheetBlocks?.filter(
    (b) => !isImportIgnoredWorksheet(b.name),
  );

  const bySheet = new Map<string, Record<string, unknown>[]>();
  for (const row of importRows) {
    const sh = row._sheet;
    const sheet = typeof sh === 'string' && sh.trim() ? sh.trim() : '';
    const key = sheet || '__default__';
    if (!bySheet.has(key)) bySheet.set(key, []);
    bySheet.get(key)!.push(row);
  }

  const mappingsBySheet = new Map<string, Record<string, keyof NormalizedCols>>();
  const sheetsMeta: ImportSheetMeta[] = [];

  for (const [sheetKey, sheetRows] of bySheet) {
    const sheetName = sheetKey === '__default__' ? '' : sheetKey;
    const block = sheetBlocksFiltered?.find((b) => b.name === sheetName);
    const mapping = buildColumnMappingForSheet(
      sheetName,
      sheetRows,
      block?.columnHeaders,
    );
    mappingsBySheet.set(sheetKey, mapping);

    const headerKeys = new Set<string>();
    for (const row of sheetRows) {
      for (const k of Object.keys(row)) {
        if (!k.startsWith('_')) headerKeys.add(k);
      }
    }
    if (block?.columnHeaders) {
      for (const h of block.columnHeaders) {
        const t = String(h ?? '').trim();
        if (t) headerKeys.add(t);
      }
    }

    if (sheetName) {
      sheetsMeta.push({
        name: sheetName,
        headerRow: block?.headerRow ?? null,
        columnHeaders: block?.columnHeaders ?? [...headerKeys],
        columnMapping: Object.fromEntries(
          Object.entries(mapping).map(([k, v]) => [k, v as string]),
        ),
      });
    }
  }

  const results: ImportExtractResult[] = [];
  importRows.forEach((row, i) => {
    const sh = row._sheet;
    const sheetKey =
      typeof sh === 'string' && sh.trim() ? sh.trim() : '__default__';
    const mapping = mappingsBySheet.get(sheetKey);

    const n = rowToNormalized(row, mapping);
    const any =
      Object.keys(n).length > 0 &&
      [
        'fullName',
        'email',
        'phone',
        'tripHint',
        'amount',
        'invoiceNumber',
        'packagePrice',
        'paidAt',
        'method',
        'note',
        'balanceDueDate',
      ].some((k) => {
        const v = n[k as keyof NormalizedCols];
        return v != null && v !== '';
      });
    if (!any) return;
    const raw = row as Record<string, unknown>;
    const sr = raw._sourceRow;
    const sourceRow =
      typeof sr === 'number' && Number.isFinite(sr)
        ? Math.trunc(sr)
        : typeof sr === 'string' && /^\d+$/.test(sr)
          ? parseInt(sr, 10)
          : i + 2;
    const base = spreadsheetRowToResult(n, sourceRow);
    const sourceSheet =
      typeof sh === 'string' && sh.trim().length > 0 ? sh.trim() : null;
    let reconciled = reconcileExtractRow({...base, sourceSheet});
    if (reconciled) {
      const pkg = reconciled.client.packagePrice;
      const ost = reconciled.client.outstandingAmount;
      if (pkg != null && ost != null) {
        reconciled = {
          ...reconciled,
          payment: {
            ...reconciled.payment,
            amount: paymentLedgerAmountPaid(pkg, ost),
          },
          client: {...reconciled.client, balanceDueDate: null},
        };
      }
      results.push(reconciled);
    }
  });
  return {rows: results, columnMeta: {sheets: sheetsMeta}};
}

function tagRowsWithSheet<T extends Record<string, unknown>>(
  rows: T[],
  sheetName?: string,
): Record<string, unknown>[] {
  if (!sheetName) return rows as Record<string, unknown>[];
  return rows.map((r) => ({ ...r, _sheet: sheetName }));
}

function parseRowsFromSheet(
  sheet: XLSX.WorkSheet,
  sheetName?: string,
): {rows: ImportExtractResult[]; sheetMeta?: ImportSheetMeta} {
  const jsonRows = tagRowsWithSheet(
    XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    }),
    sheetName,
  );

  let parsed = recordsToImportExtractResults(jsonRows);
  if (parsed.rows.length > 0) {
    return {
      rows: parsed.rows,
      sheetMeta: parsed.columnMeta.sheets[0],
    };
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  for (const skip of [0, 1] as const) {
    if (matrix.length <= skip + 2) continue;
    const objs = tagRowsWithSheet(matrixToObjects(matrix, skip), sheetName);
    parsed = recordsToImportExtractResults(objs);
    if (parsed.rows.length > 0) {
      return {
        rows: parsed.rows,
        sheetMeta: parsed.columnMeta.sheets[0],
      };
    }
  }

  const matrixRaw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
  for (const skip of [0, 1] as const) {
    if (matrixRaw.length <= skip + 2) continue;
    const objs = tagRowsWithSheet(matrixToObjects(matrixRaw, skip), sheetName);
    parsed = recordsToImportExtractResults(objs);
    if (parsed.rows.length > 0) {
      return {
        rows: parsed.rows,
        sheetMeta: parsed.columnMeta.sheets[0],
      };
    }
  }

  return {rows: []};
}

export function parseSpreadsheetImport(buffer: Buffer): SpreadsheetImportResult {
  const clean = stripBomBuffer(buffer);
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(clean, { type: 'buffer', raw: false });
  } catch {
    return {rows: []};
  }
  const out: ImportExtractResult[] = [];
  const sheetsMeta: ImportSheetMeta[] = [];
  for (const name of wb.SheetNames) {
    if (isImportIgnoredWorksheet(name)) continue;
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const ledger = tryParsePaymentLedger(sheet, name);
    if (ledger.length > 0) {
      out.push(...ledger);
      continue;
    }
    const parsed = parseRowsFromSheet(sheet, name);
    out.push(...parsed.rows);
    if (parsed.sheetMeta) sheetsMeta.push(parsed.sheetMeta);
  }
  return {
    rows: out,
    columnMeta: sheetsMeta.length ? {sheets: sheetsMeta} : undefined,
  };
}

/** Prefer Python + openpyxl for .xlsx when Node finds nothing; else per-sheet Node path. */
export async function parseSpreadsheetImportAsync(
  buffer: Buffer,
): Promise<SpreadsheetImportResult> {
  const clean = stripBomBuffer(buffer);

  const nodeResult = parseSpreadsheetImport(clean);
  if (nodeResult.rows.length > 0) return nodeResult;

  if (isXlsxBuffer(clean)) {
    const py = await runPythonExcelExtract(clean);
    if (py.ok && py.rows.length > 0) {
      const sheetBlocks = py.sheets?.map((s) => ({
        name: s.name,
        headerRow: s.headerRow ?? null,
        columnHeaders: s.columnHeaders ?? [],
      }));
      const fromPy = recordsToImportExtractResults(py.rows, sheetBlocks);
      if (fromPy.rows.length > 0) return fromPy;
    }
  }
  return nodeResult;
}

/* --- Unstructured (Word / PDF): keyword scan over full text --- */

type Labeled = {
  fullName?: string;
  tripHint?: string;
  packagePrice?: number;
  /** "Amount paid" on booking sheets */
  amountPaid?: number;
  outstanding?: number;
  paidAt?: string;
  method?: string;
  invoiceNumber?: string;
  note?: string;
};

function cleanLabeledValue(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/^[,;:\s]+|[,;:\s]+$/g, '');
}

function matchAllLabeled(
  text: string,
  pattern: RegExp,
  fn: (m: RegExpExecArray) => void,
): void {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    fn(m);
  }
}

function extractLabeledFields(text: string): Labeled {
  const out: Labeled = {};
  const hits: {name: string; score: number}[] = [];

  const pushName = (raw: string, score: number) => {
    const cut = cleanLabeledValue(raw.split(/[•|,]/)[0])
      .replace(/^[-–—\s:]+/, '')
      .trim();
    if (!cut || /@/.test(cut)) return;
    if (!looksLikePersonName(cut) || looksLikeBookingProductLabel(cut)) return;
    hits.push({name: cut, score});
  };

  matchAllLabeled(text, /\bname\s+of\s+client\b\s*[:\.#–—\-]?\s*([^\n\r]+)/gi, (m) =>
    pushName(m[1], 220),
  );
  matchAllLabeled(
    text,
    /\b(?:client(?:'s)?\s+full\s+name|legal\s+name)\s*[:\.#–—\-]?\s*([^\n\r]+)/gi,
    (m) => pushName(m[1], 200),
  );
  matchAllLabeled(
    text,
    /\b(?:guest\s+name|traveller\s*name|traveler\s*name|customer\s+name)\s*[:\.#–—\-]?\s*([^\n\r]+)/gi,
    (m) => pushName(m[1], 170),
  );
  matchAllLabeled(
    text,
    /\b(?:full\s+name|booked\s+by|billing\s+name)\s*[:\.#–—\-]?\s*([^\n\r]+)/gi,
    (m) => pushName(m[1], 150),
  );
  matchAllLabeled(
    text,
    /\b(?:bill\s*to|issued\s*to|payable\s+to)\s*[:\.#–—\-]?\s*([^\n\r]{3,120})/gi,
    (m) => pushName(m[1], 130),
  );
  matchAllLabeled(
    text,
    /\b(?:nominee|participant|delegate)\s*[:\.#–—\-]?\s*([^\n\r]{3,110})/gi,
    (m) => pushName(m[1], 90),
  );

  hits.sort((a, b) => b.score - a.score);
  if (hits.length) out.fullName = hits[0].name;

  /* Trip / package title (prefer "Lesotho Package"), not inclusion paragraph */
  matchAllLabeled(
    text,
    /\b([A-ZÀ-Ž][A-Za-zà-ź]*(?:\s+[A-Za-z][a-zà-ź]*){0,4}\s+Package)\b/gi,
    (m) => {
      const t = m[1].trim();
      /* Prefer shortest "Lesotho Package" title vs a long "... Package" sentence */
      if (!out.tripHint || (t.includes('Package') && t.length <= out.tripHint.length))
        out.tripHint = t;
    },
  );
  matchAllLabeled(text, /\b(?:trip|tour|destination|departure)\s*[:\.#–—\-]+\s*([^\n\r]{4,220})/gi, (m) => {
    if (!out.tripHint) out.tripHint = cleanLabeledValue(m[1]);
  });

  /* Money — booking grids usually have Amount paid ≠ Total ≠ Outstanding */
  matchAllLabeled(
    text,
    /\bamount\s+p(?:aid)?\b\s*[:\.#–—\-]?\s*(?:R\s*)?([\d\s,.]+(?:\.\d{2})?)/gi,
    (m) => {
      const nVal = coerceMoney(m[1]);
      if (nVal != null) out.amountPaid = nVal;
    },
  );

  matchAllLabeled(
    text,
    /\btotal\s+amount\b(?:\s+to\s+be\s+paid)?\b\s*[:\.#–—\-]?\s*R\s*([\d\s,.]+(?:\.\d{2})?)/gi,
    (m) => {
      const nVal = coerceMoney(m[1]);
      if (nVal != null) out.packagePrice = nVal;
    },
  );
  matchAllLabeled(
    text,
    /\b(?:quoted|booking|full|package)\s+price\b\s*[:\.#–—\-]?\s*R\s*([\d\s,.]+(?:\.\d{2})?)/gi,
    (m) => {
      const nVal = coerceMoney(m[1]);
      if (nVal != null && out.packagePrice == null) out.packagePrice = nVal;
    },
  );

  matchAllLabeled(
    text,
    /\boutstanding\b(?:\s+amount)?\b\s*[:\.#–—\-]?\s*R\s*([\d\s,.]+(?:\.\d{2})?)/gi,
    (m) => {
      const nVal = coerceMoney(m[1]);
      if (nVal != null) out.outstanding = nVal;
    },
  );

  matchAllLabeled(
    text,
    /\b(?:date|trip\s+date|travel\s+date|departure\s+date)\s*[:\.#–—\-]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/gi,
    (m) => {
      const d = coerceDate(m[1]);
      if (d && !out.paidAt) out.paidAt = d;
    },
  );
  matchAllLabeled(
    text,
    /\b(?:paid\s+(?:date|at|on)|payment\s+date|date\s+paid|invoice\s+date)\s*[:\.#–—\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi,
    (m) => {
      const d = coerceDate(m[1]);
      if (d && !out.paidAt) out.paidAt = d;
    },
  );

  matchAllLabeled(text, /\bmethod\s*[:\.#–—\-]\s*([^\n\r]{3,120})/gi, (m) => {
    if (!out.method) out.method = cleanLabeledValue(m[1]).slice(0, 120);
  });
  /* Do not infer "deposit" from amount lines — only explicit payment rails */
  matchAllLabeled(text, /\b(?:eft|card|cash|paypal|snapscan|ozow)\b/i, (m) => {
    if (!out.method) out.method = m[0];
  });

  matchAllLabeled(
    text,
    /\b(?:invoice|receipt)\s*(?:no\.?|#|number)\s*[:\s]*([A-Za-z]{0,4}\d[^,\s]{0,28}|\d[^,\s]{2,26})/gi,
    (m) => {
      if (!out.invoiceNumber)
        out.invoiceNumber = String(m[1]).replace(/\s+/g, '').toUpperCase();
    },
  );

  return out;
}

function bestNameFromLines(lines: string[], labeledName?: string): string | null {
  const candidates: {s: string; score: number}[] = [];

  const pushIfName = (s: string, score: number): void => {
    const t = s.trim();
    if (!looksLikePersonName(t) || looksLikeBookingProductLabel(t)) return;
    candidates.push({s: t, score});
  };

  if (labeledName && looksLikePersonName(labeledName)) {
    candidates.push({s: labeledName, score: 100});
  }

  lines.forEach((line, idx) => {
    const ll = line.toLowerCase();
    if (/^contacts?\b/i.test(ll)) return;
    if (/^(trip|invoice|payment|amount|method|issued|thank|booking\s+reference)\b/i.test(line))
      return;
    if (looksLikeBookingProductLabel(line)) return;

    let bonus = 0;
    const prev =
      idx > 0
        ? lines[idx - 1].toLowerCase()
        : idx < lines.length - 1
          ? ''
          : '';
    const nearby = `${prev} ${ll}`.toLowerCase();
    if (
      /\b(?:name|customer|guest|traveller|traveler|client|bill|booking)\b/i.test(nearby) &&
      /\b(?:name)\b|:|–|-/.test(line)
    )
      bonus += 25;
    if (looksLikePersonName(line)) pushIfName(line, 35 + bonus);
    else if (/^(?:mr|mrs|ms|miss|dr|prof)\.?\s+[A-Za-z]/i.test(line))
      pushIfName(line.replace(/^(?:mr|mrs|ms|miss|dr|prof)\.?\s+/i, ''), 40 + bonus);
  });

  if (!candidates.length) {
    for (const line of lines) {
      if (/^contacts?\b/i.test(line.toLowerCase())) continue;
      if (looksLikePersonName(line) && !looksLikeBookingProductLabel(line))
        pushIfName(line, 15);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.s ?? null;
}

/**
 * Best-effort field extraction from plain text (PDF, Word, pasted export, etc.).
 * Uses label keywords globally + line heuristics (similar intent to OCR/receipt parsers).
 */
export function parseUnstructuredImportText(fullText: string): ImportExtractResult {
  const text = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const flat = text.replace(/\n+/g, ' ');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const labeled = extractLabeledFields(text);

  let invoiceNumber: string | null =
    /\bINV[-/]?\d{4}[-/]?\d{2,5}\b/i.exec(text)?.[0]?.toUpperCase().replace(/\//g, '-') ??
    labeled.invoiceNumber?.toUpperCase() ??
    null;

  const emails = [...flat.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g)].map(
    (m) => m[0],
  );
  const email = emails[0] ?? null;

  const contactsLine = /\bcontacts?\s*[:\.#–—\-]?\s*([^\n\r]+)/i.exec(
    text.replace(/\u00a0/g, ' '),
  )?.[1];

  let phoneMatch: string | null = null;
  if (contactsLine) {
    phoneMatch =
      contactsLine.match(/\b(?:\+27|0)[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/)?.[0] ??
      contactsLine.match(/\b0\d{9}\b/)?.[0] ??
      contactsLine.match(/\b\d{10}\b/)?.[0] ??
      null;
  }
  phoneMatch ??=
    flat.match(/\b(?:\+27|0)[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/)?.[0] ??
    flat.match(/\b0\d{9}\b/)?.[0] ??
    flat.match(/\b\d{10}\b/)?.[0] ??
    null;

  phoneMatch = phoneMatch?.replace(/\s+/g, ' ').trim() ?? null;

  let amount =
    labeled.amountPaid ??
    (() => {
      const amtRe =
        /\bR\s*([\d]{1,3}(?:[,.\s]\d{3})+(?:\.\d{2})?|[\d,]+\.\d{2})\b/gi;
      let best: number | null = null;
      let m: RegExpExecArray | null;
      while ((m = amtRe.exec(flat))) {
        const nAmt = coerceMoney(m[1]);
        if (
          nAmt != null &&
          nAmt >= 10 &&
          (best == null || nAmt > best)
        )
          best = nAmt;
      }
      return best;
    })();

  let packagePrice = labeled.packagePrice ?? null;

  /* If grid labels missing but paid + outstanding are present */
  if (
    packagePrice == null &&
    labeled.amountPaid != null &&
    labeled.outstanding != null
  ) {
    const sum =
      Math.round((labeled.amountPaid + labeled.outstanding) * 100) / 100;
    if (sum > labeled.amountPaid) packagePrice = sum;
  }

  if (
    packagePrice != null &&
    amount != null &&
    Math.abs(packagePrice - amount) < 1
  )
    packagePrice = null;

  let paidAt: string | null = labeled.paidAt ?? null;
  if (!paidAt) {
    const dmyWord = /\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/.exec(flat)?.[1];
    if (dmyWord) paidAt = coerceDate(dmyWord);
  }
  if (!paidAt) {
    const isoDates = [...flat.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((m) => m[1]);
    if (isoDates.length) paidAt = isoDates[isoDates.length - 1];
  }

  let fullName =
    labeled.fullName && !/@/.test(labeled.fullName) ? labeled.fullName.trim() : null;
  if (!fullName || !looksLikePersonName(fullName)) {
    const fromLines = bestNameFromLines(lines, fullName ?? undefined);
    if (fromLines) fullName = fromLines;
  }

  let tripHint: string | null = labeled.tripHint
    ? shortenTripInclusionBlob(labeled.tripHint)
    : null;

  const pkgBare = /\b([A-Za-z][A-Za-z\s]{2,42}\bPackage)\b/i.exec(text)?.[1];
  if ((!tripHint || tripHint.length > 80) && pkgBare && pkgBare.length < 80)
    tripHint = shortenTripInclusionBlob(pkgBare);

  if (!tripHint) {
    const tripIdx = lines.findIndex((l) => /^(trip|tour|package)\s*[:\.#–—\-]/i.test(l));
    if (tripIdx >= 0)
      tripHint =
        shortenTripInclusionBlob(
          lines.slice(tripIdx, tripIdx + 3).join(' '),
        ).replace(/^(trip|tour|package)\s*[:\s]*/i, '') || null;
  }

  const methodLine = lines.find((l) => /^method\b/i.test(l));
  let method =
    labeled.method ??
    (methodLine ? methodLine.replace(/^method\s*[:\s.#–—\-]*/i, '').slice(0, 120) : null);
  if (method?.toLowerCase().trim() === 'deposit' && !methodLine) method = null;

  const noteParts: string[] = [];
  if (labeled.outstanding != null && labeled.outstanding > 0)
    noteParts.push(`Outstanding: R${labeled.outstanding.toFixed(2)}`);
  lines.forEach((l) => {
    if (/^ref(?:erence)?\s*[:#.]?\s*/i.test(l) && !invoiceNumber)
      invoiceNumber ||= l.replace(/^ref(?:erence)?\s*[:#.]*\s*/i, '').trim().slice(0, 36);
    if (/booking\s+(?:notes?|ref)/i.test(l)) noteParts.push(l);
  });
  const note = noteParts.join(' · ').slice(0, 500) || null;

  let confidence: ImportExtractResult['confidence'] = 'low';
  const score =
    [fullName, email, invoiceNumber].filter(Boolean).length + (amount != null ? 1 : 0);
  if (score >= 3) confidence = 'high';
  else if (score >= 2) confidence = 'medium';

  /* Travel/date column ≠ balance deadline on many booking summaries */
  const impliesBalanceDeadline =
    /\b(?:balance|final\s+payment|amount)\s+due\s+(?:on|by)?\s*(?:date|:)/i.test(text) ||
    /\bdue\s+date\b/i.test(text);

  return {
    client: {
      fullName,
      phone: phoneMatch,
      email,
      tripHint,
      packagePrice,
      balanceDueDate: impliesBalanceDeadline && paidAt ? paidAt : null,
      outstandingAmount: labeled.outstanding ?? null,
    },
    payment: {
      invoiceNumber,
      amount,
      paidAt,
      method,
      note,
    },
    confidence,
  };
}

/** @deprecated Use {@link parseUnstructuredImportText} */
export const parsePdfImportText = parseUnstructuredImportText;
