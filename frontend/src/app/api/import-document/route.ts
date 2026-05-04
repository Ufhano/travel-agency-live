import mammoth from 'mammoth';
import {NextResponse} from 'next/server';
import {PDFParse} from 'pdf-parse';

import type {ImportExtractResult} from '@/lib/import-parse';
import {ensurePdfJsWorker} from '@/lib/pdf-worker';
import {parseSpreadsheetImport, parseUnstructuredImportText} from '@/lib/import-parse';

export const runtime = 'nodejs';

const MAX_BYTES = 6 * 1024 * 1024;

type DocFormat = 'spreadsheet' | 'pdf' | 'word';

export async function POST(request: Request): Promise<Response> {
  try {
    const ct = request.headers.get('content-type') ?? '';
    if (!ct.includes('multipart/form-data'))
      return NextResponse.json({error: 'Expected multipart/form-data'}, {status: 400});

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file))
      return NextResponse.json({error: 'Missing file field "file".'}, {status: 400});

    const typed = file as File;
    if (typed.size > MAX_BYTES)
      return NextResponse.json({error: 'File too large (max 6 MB).'}, {status: 413});

    const name = typed.name ?? '';
    const lower = name.toLowerCase();

    const buf = Buffer.from(await typed.arrayBuffer());

    let rows: ImportExtractResult[];
    let format: DocFormat;

    if (lower.endsWith('.pdf')) {
      ensurePdfJsWorker();
      const parser = new PDFParse({data: new Uint8Array(buf)});
      try {
        const parsed = await parser.getText();
        rows = [parseUnstructuredImportText(parsed.text ?? '')];
      } finally {
        await parser.destroy();
      }
      format = 'pdf';
    } else if (lower.endsWith('.docx')) {
      const {value} = await mammoth.extractRawText({buffer: buf});
      rows = [parseUnstructuredImportText(value ?? '')];
      format = 'word';
    } else if (lower.endsWith('.doc')) {
      return NextResponse.json(
        {
          error:
            'Older Word .doc files are not supported. Save As .docx (or export to PDF) and upload again.',
        },
        {status: 415},
      );
    } else if (
      lower.endsWith('.xlsx') ||
      lower.endsWith('.xls') ||
      lower.endsWith('.csv')
    ) {
      rows = parseSpreadsheetImport(buf);
      format = 'spreadsheet';
    } else {
      return NextResponse.json(
        {
          error:
            'Unsupported type. Upload .csv, .xlsx, .xls, .docx, or .pdf (legacy .doc → save as .docx).',
        },
        {status: 415},
      );
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
