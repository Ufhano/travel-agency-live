'use client';

import {useCallback, useRef, useState} from 'react';
import {FileUp} from 'lucide-react';

import type {ImportExtractResult} from '@/lib/import-parse';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {formatDate, formatZAR} from '@/lib/utils';

type ApiOk = {
  format: 'spreadsheet' | 'pdf' | 'word';
  fileName: string;
  count: number;
  rows: ImportExtractResult[];
  warnings: string[];
};

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiOk | null>(null);

  const submit = useCallback(async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setError(null);
    setPayload(null);
    setLoading(true);
    try {
      const body = new FormData();
      body.set('file', f);
      const res = await fetch('/api/import-document', {method: 'POST', body});
      const json = (await res.json()) as ApiOk | {error: string};
      if (!res.ok) setError((json as {error: string}).error ?? 'Upload failed.');
      else setPayload(json as ApiOk);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className='space-y-8'>
      <header className='space-y-2'>
        <h1 className='text-2xl font-semibold tracking-tight'>Import from document</h1>
        <p className='max-w-2xl text-sm text-muted-foreground'>
          Upload a spreadsheet (CSV or Excel), a Word (.docx) booking or receipt export, or a
          payment PDF. The demo extracts traveller details and payments for review — nothing is
          saved (internal preview only).
        </p>
      </header>

      <Card className='max-w-xl'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <FileUp className='h-5 w-5' aria-hidden />
            Upload file
          </CardTitle>
          <CardDescription>
            Supported: <strong className='font-medium text-foreground'>.csv</strong>,{' '}
            <strong className='font-medium text-foreground'>.xlsx</strong>,{' '}
            <strong className='font-medium text-foreground'>.xls</strong>,{' '}
            <strong className='font-medium text-foreground'>.docx</strong>,{' '}
            <strong className='font-medium text-foreground'>.pdf</strong> (max 6 MB). Older
            .doc → save as .docx first.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <input
              ref={fileRef}
              id='import-document-file'
              type='file'
              accept='.csv,.xlsx,.xls,.doc,.docx,.pdf,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
              className='hidden'
              disabled={loading}
              aria-label='Choose spreadsheet, Word, or PDF file to import'
              onChange={(e) => void submit(e.target.files)}
            />
            <Button
              type='button'
              variant='default'
              disabled={loading}
              aria-label={loading ? 'Reading file' : 'Open file picker to upload export'}
              onClick={() => fileRef.current?.click()}
            >
              {loading ? 'Reading file…' : 'Choose file'}
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={loading || !payload}
              onClick={() => {
                setPayload(null);
                setError(null);
              }}
            >
              Clear
            </Button>
          </div>
          {error ? (
            <p className='text-sm text-destructive' role='alert'>
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {payload?.warnings?.length ? (
        <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'>
          <p className='font-medium'>Notes</p>
          <ul className='mt-2 list-inside list-disc space-y-1'>
            {payload.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {payload && payload.rows.length > 0 ? (
        <div className='space-y-4'>
          <h2 className='text-lg font-semibold'>
            Extracted (
            {payload.format === 'pdf'
              ? 'PDF'
              : payload.format === 'word'
                ? 'Word'
                : 'spreadsheet'}
            )
            <span className='ml-2 font-normal text-muted-foreground'>
              — {payload.fileName} · {payload.count}{' '}
              {payload.count === 1 ? 'record' : 'records'}
            </span>
          </h2>
          <div className='space-y-6'>
            {payload.rows.map((row, idx) => (
              <ExtractedCard key={`${payload.fileName}-${row.sourceRow ?? idx}`} row={row} />
            ))}
          </div>
        </div>
      ) : payload && payload.rows.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No extractable rows in this file.</p>
      ) : null}

      <Card className='max-w-xl border-muted'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Spreadsheet column hints</CardTitle>
        </CardHeader>
        <CardContent className='text-xs text-muted-foreground'>
          <p>
            For spreadsheets, use a header row with names like{' '}
            <span className='font-mono text-foreground'>Full Name</span>,{' '}
            <span className='font-mono text-foreground'>Email</span>,{' '}
            <span className='font-mono text-foreground'>Phone</span>,{' '}
            <span className='font-mono text-foreground'>Trip</span>,{' '}
            <span className='font-mono text-foreground'>Invoice Number</span>,{' '}
            <span className='font-mono text-foreground'>Amount</span>,{' '}
            <span className='font-mono text-foreground'>Paid Date</span>,{' '}
            <span className='font-mono text-foreground'>Method</span>,{' '}
            <span className='font-mono text-foreground'>Package Price</span>,{' '}
            <span className='font-mono text-foreground'>Balance Due</span>.
            Word (.docx) and PDF imports use receipt-style text cues (invoice number, amounts,
            contact lines); results vary by template.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  val,
  className,
}: {
  label: string;
  val: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className='text-[11px] font-medium uppercase text-muted-foreground'>{label}</p>
      <p className='text-sm font-medium'>{val ?? '—'}</p>
    </div>
  );
}

function ExtractedCard({row}: {row: ImportExtractResult}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-4'>
        <CardTitle className='text-base'>
          Traveller profile & payment
          {row.sourceRow != null ? (
            <span className='ml-2 font-mono text-sm font-normal text-muted-foreground'>
              (row {row.sourceRow})
            </span>
          ) : null}
        </CardTitle>
        <span
          className={
            row.confidence === 'high'
              ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100'
              : row.confidence === 'medium'
                ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-950/40 dark:text-amber-50'
                : 'rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
          }
        >
          {row.confidence} confidence
        </span>
      </CardHeader>
      <CardContent className='grid gap-6 sm:grid-cols-2'>
        <div className='space-y-4'>
          <p className='text-xs font-semibold uppercase text-primary'>Client</p>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Field label='Full name' val={row.client.fullName} />
            <Field label='Email' val={row.client.email} />
            <Field label='Phone' val={row.client.phone} />
            <Field label='Trip' val={row.client.tripHint} />
            <Field
              label='Package price'
              val={
                row.client.packagePrice != null ? formatZAR(row.client.packagePrice) : null
              }
            />
            <Field
              label='Balance due'
              val={
                row.client.balanceDueDate
                  ? formatDate(row.client.balanceDueDate)
                  : null
              }
            />
          </div>
        </div>
        <div className='space-y-4'>
          <p className='text-xs font-semibold uppercase text-primary'>Payment</p>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Field label='Invoice #' val={row.payment.invoiceNumber} />
            <Field
              label='Amount'
              val={row.payment.amount != null ? formatZAR(row.payment.amount) : null}
            />
            <Field
              label='Paid date'
              val={row.payment.paidAt ? formatDate(row.payment.paidAt) : null}
            />
            <Field label='Method' val={row.payment.method} />
            <Field label='Note' val={row.payment.note} className='sm:col-span-2' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
