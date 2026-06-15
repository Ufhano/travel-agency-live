import {NextResponse} from 'next/server';

import {ensureTripsForImportGroups} from '@backend/ensure-import-trips';
import {getSql} from '@backend/db';
import type {
  ImportExtractResult,
  ImportSpreadsheetMeta,
} from '@backend/import-parse';
import {
  parseSpreadsheetImportAsync,
  parseUnstructuredImportText,
} from '@backend/import-parse';
import {getSession} from '@/lib/auth-server';
import {isSuperuser} from '@backend/roles';

export const runtime = 'nodejs';
/** Spreadsheet / PDF parsing can exceed the default 10s on large files. */
export const maxDuration = 60;

const MAX_BYTES = 6 * 1024 * 1024;

type DocFormat = 'spreadsheet' | 'pdf' | 'word';

const DOC_FORMAT_SET: ReadonlySet<string> = new Set(['spreadsheet', 'pdf', 'word']);

function extensionMatchesChosenKind(lower: string, kind: DocFormat): boolean {
  switch (kind) {
    case 'spreadsheet':
      return (
        lower.endsWith('.csv') ||
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls')
      );
    case 'pdf':
      return lower.endsWith('.pdf');
    case 'word':
      return lower.endsWith('.docx');
    default:
      return false;
  }
}

function kindLabel(kind: DocFormat): string {
  switch (kind) {
    case 'spreadsheet':
      return 'Spreadsheet (.csv / .xlsx / .xls)';
    case 'pdf':
      return 'PDF (.pdf)';
    case 'word':
      return 'Word (.docx)';
    default:
      return kind;
  }
}

/** pdf-parse + pdfjs worker break cold starts on Vercel if imported at module scope. */
async function parsePdfBuffer(buf: Buffer): Promise<ImportExtractResult[]> {
  const {PDFParse} = await import('pdf-parse');
  const {ensurePdfJsWorker} = await import('@backend/pdf-worker');
  ensurePdfJsWorker();
  const parser = new PDFParse({data: new Uint8Array(buf)});
  try {
    const parsed = await parser.getText();
    return [parseUnstructuredImportText(parsed.text ?? '')];
  } finally {
    await parser.destroy();
  }
}

async function parseWordBuffer(buf: Buffer): Promise<ImportExtractResult[]> {
  const mammoth = await import('mammoth');
  const {value} = await mammoth.extractRawText({buffer: buf});
  return [parseUnstructuredImportText(value ?? '')];
}

function importGroupKey(row: ImportExtractResult): string {
  const sheet = row.sourceSheet?.trim();
  if (sheet) return sheet;
  const trip = row.client.tripHint?.trim();
  if (trip) return trip;
  return 'Uncategorized';
}

function collectImportGroups(rows: ImportExtractResult[]): string[] {
  return rows.map(importGroupKey);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({error: 'Unauthorized.'}, {status: 401});
    }
    if (!isSuperuser(session.role)) {
      return NextResponse.json({error: 'Forbidden.'}, {status: 403});
    }

    const ct = request.headers.get('content-type') ?? '';
    if (!ct.includes('multipart/form-data'))
      return NextResponse.json({error: 'Expected multipart/form-data'}, {status: 400});

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file))
      return NextResponse.json({error: 'Missing file field "file".'}, {status: 400});

    const kindRaw = form.get('importKind');
    const kind =
      typeof kindRaw === 'string' && DOC_FORMAT_SET.has(kindRaw) ? (kindRaw as DocFormat) : null;
    if (!kind)
      return NextResponse.json(
        {
          error:
            'Select what you are uploading (spreadsheet, PDF, or Word) before choosing a file.',
        },
        {status: 400},
      );

    const typed = file as File;
    if (typed.size > MAX_BYTES)
      return NextResponse.json({error: 'File too large (max 6 MB).'}, {status: 413});

    const name = typed.name ?? '';
    const lower = name.toLowerCase();

    const buf = Buffer.from(await typed.arrayBuffer());

    if (lower.endsWith('.doc'))
      return NextResponse.json(
        {
          error:
            'Older Word .doc files are not supported. Save As .docx (or export to PDF) and upload again.',
        },
        {status: 415},
      );

    if (!extensionMatchesChosenKind(lower, kind))
      return NextResponse.json(
        {
          error: `Expected ${kindLabel(kind)} for your selection — this file (${name}) does not match.`,
        },
        {status: 400},
      );

    let rows: ImportExtractResult[];
    let columnMeta: ImportSpreadsheetMeta | undefined;
    const format = kind;

    if (kind === 'pdf') {
      rows = await parsePdfBuffer(buf);
    } else if (kind === 'word') {
      rows = await parseWordBuffer(buf);
    } else {
      const parsed = await parseSpreadsheetImportAsync(buf);
      rows = parsed.rows;
      columnMeta = parsed.columnMeta;
    }

    const unstructuredWarning =
      'Extracted fields may be incomplete — layout varies by file type. Always review before importing to production.';

    const sql = getSql();
    let tripSync:
      | {
          trips: Awaited<ReturnType<typeof ensureTripsForImportGroups>>['trips'];
          groupTripIds: Record<string, string>;
          createdCount: number;
          createdNames: string[];
        }
      | undefined;

    if (session && sql && rows.length > 0 && format === 'spreadsheet') {
      try {
        const sync = await ensureTripsForImportGroups(
          sql,
          session.tenantId,
          collectImportGroups(rows),
        );
        tripSync = {
          trips: sync.trips,
          groupTripIds: sync.groupTripIds,
          createdCount: sync.createdCount,
          createdNames: sync.createdNames,
        };
      } catch (e) {
        console.error('[import-document] trip sync failed:', e);
      }
    }

    return NextResponse.json({
      format,
      fileName: name,
      count: rows.length,
      rows,
      ...(columnMeta ? {columnMeta} : {}),
      ...(tripSync ? {tripSync} : {}),
      warnings:
        format === 'pdf' || format === 'word'
          ? [unstructuredWarning]
          : rows.length === 0
            ? [
                'No data rows matched. Ensure the first row has headers like Full Name, Email, Amount, etc.',
              ]
            : tripSync && tripSync.createdCount > 0
              ? [
                  `Created ${tripSync.createdCount} departure(s) from worksheet tabs: ${tripSync.createdNames.slice(0, 5).join(', ')}${tripSync.createdNames.length > 5 ? '…' : ''}.`,
                ]
              : [],
    });
  } catch (e) {
    console.error('[import-document]', e);
    return NextResponse.json(
      {error: 'Failed to parse file. Try a different export or format.'},
      {status: 500},
    );
  }
}
