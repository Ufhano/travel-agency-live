import mammoth from 'mammoth';
import {NextResponse} from 'next/server';
import {PDFParse} from 'pdf-parse';

import type {ImportExtractResult} from '@backend/import-parse';
import {ensurePdfJsWorker} from '@backend/pdf-worker';
import {parseSpreadsheetImport, parseUnstructuredImportText} from '@backend/import-parse';

export const runtime = 'nodejs';

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

export async function POST(request: Request): Promise<Response> {
  try {
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
    const format = kind;

    if (kind === 'pdf') {
      ensurePdfJsWorker();
      const parser = new PDFParse({data: new Uint8Array(buf)});
      try {
        const parsed = await parser.getText();
        rows = [parseUnstructuredImportText(parsed.text ?? '')];
      } finally {
        await parser.destroy();
      }
    } else if (kind === 'word') {
      const {value} = await mammoth.extractRawText({buffer: buf});
      rows = [parseUnstructuredImportText(value ?? '')];
    } else {
      rows = parseSpreadsheetImport(buf);
    }

    const unstructuredWarning =
      'Extracted fields may be incomplete — layout varies by file type. Always review before importing to production.';

    return NextResponse.json({
      format,
      fileName: name,
      count: rows.length,
      rows,
      warnings:
        format === 'pdf' || format === 'word'
          ? [unstructuredWarning]
          : rows.length === 0
            ? [
                'No data rows matched. Ensure the first row has headers like Full Name, Email, Amount, etc.',
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
