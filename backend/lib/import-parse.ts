import * as XLSX from 'xlsx';

/** One logical record from a row or PDF heuristic pass. */
export type ImportExtractResult = {
  client: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    tripHint: string | null;
    packagePrice: number | null;
    balanceDueDate: string | null;
  };
  payment: {
    invoiceNumber: string | null;
    amount: number | null;
    paidAt: string | null;
    method: string | null;
    note: string | null;
  };
  sourceRow?: number;
  confidence: 'high' | 'medium' | 'low';
};

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

function rowToNormalized(row: Record<string, unknown>): NormalizedCols {
  const out: NormalizedCols = {};
  for (const [header, raw] of Object.entries(row)) {
    const keyFinal = inferColumnKey(header) ?? aliasKey(header);
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
    out.fullName = nameGuess[0].trim();
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

function spreadsheetRowToResult(
  n: NormalizedCols,
  sourceRow: number,
): ImportExtractResult {
  const ost = (n as NormalizedCols & {_outstandingAmount?: number})._outstandingAmount;
  const noteBase = n.note;
  let combinedNote =
    ost != null && ost > 0
      ? [noteBase, `Outstanding: R${Number(ost.toFixed(2))}`].filter(Boolean).join(' · ')
      : noteBase ?? null;

  const hasClient =
    Boolean(n.fullName) || Boolean(n.email) || Boolean(n.phone);
  const hasPayment =
    n.amount != null || Boolean(n.invoiceNumber) || Boolean(n.method);
  let confidence: ImportExtractResult['confidence'] = 'low';
  if (hasClient && hasPayment && n.amount != null) confidence = 'high';
  else if ((hasClient && hasPayment) || n.amount != null || hasClient)
    confidence = 'medium';

  return {
    client: {
      fullName: n.fullName ?? null,
      phone: n.phone ?? null,
      email: n.email ?? null,
      tripHint: n.tripHint ?? null,
      packagePrice: n.packagePrice ?? null,
      balanceDueDate: n.balanceDueDate ?? null,
    },
    payment: {
      invoiceNumber: n.invoiceNumber ?? null,
      amount: n.amount ?? null,
      paidAt: n.paidAt ?? null,
      method: n.method ?? null,
      note: combinedNote,
    },
    sourceRow,
    confidence,
  };
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

  const monthIndex: Record<string, number> = {
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

  const mi = monthIndex[monToken] ?? monthIndex[monToken.slice(0, 3)] ?? null;
  if (!mi) return null;

  let yr = Number.parseInt(yrStr, 10);
  if (!Number.isFinite(yr)) return null;
  if (yr < 100) yr += 2000;
  if (yr < 1980 || yr > 2100) return null;

  const mm = String(mi).padStart(2, '0');
  return {yyyyMmDd: `${yr}-${mm}-01`, label};
}

/**
 * Group payment trackers: Names + month columns (Aug-25) + Total Package / Outstanding.
 * Emits one import row per traveller per instalment month with a filled paid date (month start).
 */
function tryParsePaymentLedger(sheet: XLSX.WorkSheet): ImportExtractResult[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  let headerIdx = -1;
  let nameCol = -1;
  let outstandingCol = -1;
  let totalPkgCol = -1;
  const monthCols: {col: number; paidAt: string; label: string}[] = [];

  for (let r = 0; r < Math.min(matrix.length, 24); r++) {
    const row = matrix[r] ?? [];
    let nc = -1;
    const hits: typeof monthCols = [];
    let oc = -1;
    let tp = -1;

    for (let c = 0; c < row.length; c++) {
      const raw = String(row[c] ?? '').trim();
      if (!raw) continue;
      const low = normHeader(raw);

      if (low === 'names') nc = c;
      else if (nc < 0 && low === 'name') nc = c;

      if (low === 'total package') tp = c;
      if (low === 'outstanding') oc = c;

      const mo = parsePaymentLedgerMonth(raw);
      if (mo) hits.push({col: c, paidAt: mo.yyyyMmDd, label: mo.label});
    }

    if (nc >= 0 && hits.length >= 2) {
      headerIdx = r;
      nameCol = nc;
      monthCols.push(...hits);
      outstandingCol = oc;
      totalPkgCol = tp;
      break;
    }
  }

  if (headerIdx < 0 || nameCol < 0 || monthCols.length < 2) return [];

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

  const out: ImportExtractResult[] = [];

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const erow = matrix[r];
    const fullName = String(erow?.[nameCol] ?? '').trim();
    if (!fullName.length || fullName.length > 72) continue;
    if (/^(total|grand|sum|sub)\b/i.test(fullName)) continue;
    const words = fullName.split(/\s+/).filter(Boolean);
    const nameOk =
      words.length >= 2 &&
      (looksLikePersonName(fullName) ||
        words.every(
          (w) =>
            w.length >= 2 &&
            (w.endsWith("'") ||
              /^[\p{L}][\p{L}'.-]{1,}$/u.test(w) ||
              /^[A-ZÄÖÜ][a-zäöüß'-]+$/u.test(w)),
        ));
    if (!nameOk) continue;

    const pkgAmt: number | null = totalPkgCol >= 0 ? coerceMoney(erow?.[totalPkgCol]) : null;

    let rowOutstandingNote: string | null = null;
    if (outstandingCol >= 0) {
      const ox = coerceMoney(erow?.[outstandingCol]);
      if (ox != null && ox > 0)
        rowOutstandingNote = `Row outstanding R${Number(ox.toFixed(2))}`;
    }

    for (const mc of monthCols) {
      const amt = coerceMoney(erow?.[mc.col]);
      if (amt == null || amt <= 0) continue;

      const notes = [`Schedule ${mc.label}`, rowOutstandingNote].filter(Boolean).join(' · ');
      out.push({
        client: {
          fullName,
          phone: null,
          email: null,
          tripHint: tripHintMerged?.length ? tripHintMerged : null,
          packagePrice: pkgAmt ?? null,
          balanceDueDate: null,
        },
        payment: {
          invoiceNumber: null,
          amount: amt,
          paidAt: mc.paidAt,
          method: null,
          note: notes.slice(0, 500),
        },
        sourceRow: r + 1,
        confidence: pkgAmt != null && amt != null ? 'high' : 'medium',
      });
    }
  }

  return out.length > 0 ? out : [];
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

function parseRowsFromSheet(sheet: XLSX.WorkSheet): ImportExtractResult[] {
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  const tryRows = (rows: Record<string, unknown>[]) => {
    const results: ImportExtractResult[] = [];
    rows.forEach((row, i) => {
      const n = rowToNormalized(row);
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
      results.push(spreadsheetRowToResult(n, i + 2));
    });
    return results;
  };

  let results = tryRows(jsonRows);
  if (results.length > 0) return results;

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  for (const skip of [0, 1] as const) {
    if (matrix.length <= skip + 2) continue;
    const objs = matrixToObjects(matrix, skip);
    results = tryRows(objs);
    if (results.length > 0) return results;
  }

  const matrixRaw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
  for (const skip of [0, 1] as const) {
    if (matrixRaw.length <= skip + 2) continue;
    const objs = matrixToObjects(matrixRaw, skip);
    results = tryRows(objs);
    if (results.length > 0) return results;
  }

  return [];
}

export function parseSpreadsheetImport(buffer: Buffer): ImportExtractResult[] {
  const clean = stripBomBuffer(buffer);
  const wb = XLSX.read(clean, {type: 'buffer', raw: false});
  const name = wb.SheetNames[0];
  if (!name) return [];
  const sheet = wb.Sheets[name];

  const ledger = tryParsePaymentLedger(sheet);
  if (ledger.length > 0) return ledger;

  return parseRowsFromSheet(sheet);
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
