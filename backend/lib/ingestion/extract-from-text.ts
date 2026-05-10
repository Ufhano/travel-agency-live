/**
 * Turn loose PDF/OCR text into weakly-structured rows for {@link normalizeRecords}.
 * Heuristic only — favours recall over precision; callers should review output.
 */

const MONTH_LONG =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

function firstRefLike(text: string): string | undefined {
  const flat = text.replace(/\s+/g, " ");
  const inv = /\b(?:INV(?:OICE)?|Invoice)\s*[:\-#]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]{2,})\b/i.exec(
    flat,
  );
  if (inv?.[1]) return inv[1].trim();
  const ref = /\bRef(?:erence)?\s*[:\-#]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]{2,})\b/i.exec(
    flat,
  );
  if (ref?.[1]) return ref[1].trim();
  const dash = /\b([A-Z]{2,}-\d{2,}[A-Za-z0-9\-]*)\b/.exec(flat);
  if (dash?.[1]) return dash[1].trim();
  return undefined;
}

function allAmounts(text: string): number[] {
  const out: number[] = [];
  const re =
    /(?:R\s*|ZAR\s*|USD\s*|\$)\s*([\d][\d\s,]*(?:\.\d{1,4})?)|\b([\d][\d\s,]*(?:\.\d{1,4})?)\s*(?:ZAR|USD|EUR|GBP)\b/gi;
  let m: RegExpExecArray | null;
  const s = text.replace(/\s+/g, " ");
  while ((m = re.exec(s)) !== null) {
    const raw = (m[1] ?? m[2] ?? "").replace(/[\s,]/g, "");
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n) && n > 0 && n < 1e12) out.push(n);
  }
  const simple = /\b([\d]{1,3}(?:[,\d]{2,3})*(?:\.\d{2})?)\b/g;
  let m2: RegExpExecArray | null;
  while ((m2 = simple.exec(s)) !== null) {
    const n = Number.parseFloat(m2[1].replace(/,/g, ""));
    if (
      Number.isFinite(n) &&
      n >= 50 &&
      n < 1e7 &&
      !out.some((x) => Math.abs(x - n) < 0.01)
    )
      out.push(n);
  }
  return out.slice(0, 8);
}

function first_iso_date(text: string): string | undefined {
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
  if (iso) return iso[1];
  const dmy = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/.exec(text);
  if (dmy) {
    let d = Number(dmy[1]);
    let mo = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    if (
      Number.isFinite(d) &&
      Number.isFinite(mo) &&
      Number.isFinite(y) &&
      mo >= 1 &&
      mo <= 12
    )
      try {
        const dt = new Date(Date.UTC(y, mo - 1, Math.min(d, 28)));
        return dt.toISOString().slice(0, 10);
      } catch {
        /* noop */
      }
  }
  const long = new RegExp(
    `\\b(\\d{1,2})\\s+(${MONTH_LONG})\\s+(\\d{4})\\b`,
    "i",
  ).exec(text);
  if (long) {
    const d = Number(long[1]);
    const ms = `${long[2]} 1 ${long[3]}`;
    const dt = new Date(ms);
    if (!Number.isNaN(dt.valueOf()))
      dt.setUTCDate(d);
    if (!Number.isNaN(dt.valueOf()))
      return dt.toISOString().slice(0, 10);
  }
  return undefined;
}

/** Split text into coarse blocks separated by blank lines */
function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 8);
}

function routeFromPhrase(text: string): { origin?: string; destination?: string } {
  const m = /\b(?:from|dep(?:arture)?)\s*[:\s]+([^,\n]+?)\s+(?:to|→|->|-|dest(?:ination)?)\s*[:\s]+([^,\n]+)/i.exec(
    text.replace(/\s+/g, " "),
  );
  if (m)
    return {
      origin: m[1].trim().slice(0, 240),
      destination: m[2].trim().slice(0, 240),
    };
  const toOnly = /\b(?:to|arriving|destination)\s*[:\s]+([^\n,.]{3,160})/i.exec(text);
  if (toOnly) return { destination: toOnly[1].trim() };
  return {};
}

/** Lines that might be a traveller / company heading */
function pickClientSnippet(block: string): string | undefined {
  const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (/^(INV|Receipt|Booking|Trip|Fare|Tax|Tel|Tel\.|Email)/i.test(line))
      continue;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 6 && /^[A-Z]/.test(line))
      return line.slice(0, 200);
  }
  return undefined;
}

/** Build synthetic rows from unstructured document text */
export function extractRowsFromFreeText(rawText: string, logs: string[]): Record<string, unknown>[] {
  if (!rawText.trim()) {
    logs.push("Unstructured extractor: empty text.");
    return [];
  }

  const chunks = paragraphs(rawText);
  const rows: Record<string, unknown>[] = [];

  if (chunks.length === 0)
    chunks.push(rawText.trim().slice(0, 200_000));

  for (const block of chunks) {
    try {
      const dateStr = first_iso_date(block);
      const amounts = allAmounts(block);
      const ref = firstRefLike(block);

      const route = routeFromPhrase(block.replace(/\s+/g, " "));
      const client = pickClientSnippet(block);

      if (
        dateStr ??
        amounts[0] ??
        ref ??
        route.origin ??
        route.destination ??
        client
      ) {
        rows.push({
          date: dateStr ?? null,
          amount: amounts[0] ?? null,
          invoice: ref ?? null,
          reference: ref ?? null,
          destination: route.destination ?? null,
          origin: route.origin ?? null,
          client: client ?? null,
          _source: "free_text_block",
          _snippet: block.slice(0, 400),
        });

        /** Secondary amounts on same invoice block as faint extra rows — optional */

        if (amounts.length > 1) {
          for (let i = 1; i < Math.min(amounts.length, 3); i++) {
            if (Math.abs(amounts[i] - amounts[0]) < 0.01) continue;
            rows.push({
              date: dateStr ?? null,
              amount: amounts[i],
              reference: ref ?? null,
              destination: route.destination ?? null,
              origin: route.origin ?? null,
              client: client ?? null,
              _source: "free_text_amount_split",
            });
          }
        }
      }
    } catch (e) {
      logs.push(
        `Unstructured block skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Line-by-line pass for missed single-line receipts */
  for (const line of rawText.split(/\n/)) {
    const t = line.trim();
    if (t.length < 12) continue;
    const hasMoney = /R\s*[\d,]+|\$[\d,]+|ZAR/i.test(t);
    const hasDate = /\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}/.test(t);
    if (hasMoney && hasDate) {
      const d = first_iso_date(t);
      const am = allAmounts(t)[0];
      if (d && am)
        rows.push({
          date: d,
          amount: am,
          _source: "free_text_line",
          _line: t.slice(0, 300),
        });
    }
  }

  logs.push(`Unstructured extraction produced ${rows.length} candidate row(s).`);

  return rows;
}
