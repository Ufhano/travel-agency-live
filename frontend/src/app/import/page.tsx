'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Database, Download, FileUp, Loader2, MapPin} from 'lucide-react';

import type {ImportExtractResult} from '@backend/import-parse';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {CreateTripInline} from '@/components/create-trip-inline';
import {useToast} from '@/components/ui/toast';
import {
  destinationFromGroupLabel,
  matchTripForGroup,
} from '@/lib/match-trip';
import {formatDate, formatZAR} from '@/lib/utils';

type ImportKind = 'spreadsheet' | 'pdf' | 'word';

type ApiOk = {
  format: 'spreadsheet' | 'pdf' | 'word';
  fileName: string;
  count: number;
  rows: ImportExtractResult[];
  warnings: string[];
  savedCount?: number;
  tripSync?: {
    trips: TripOption[];
    groupTripIds: Record<string, string>;
    createdCount: number;
    createdNames: string[];
  };
};

const ACCEPT_BY_KIND: Record<ImportKind, string> = {
  spreadsheet:
    '.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: '.pdf,application/pdf',
  word: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** Prefer Excel tab name (destination clue), then row trip hint. */
function importDestinationGroupKey(row: ImportExtractResult): string {
  const sheet = row.sourceSheet?.trim();
  if (sheet) return sheet;
  const trip = row.client.tripHint?.trim();
  if (trip) return trip;
  return 'Uncategorized';
}

/** Stable key for this import session (per card / save button). */
function makeRowKey(
  fileName: string,
  group: string,
  idxInGroup: number,
  row: ImportExtractResult,
): string {
  const name = (row.client.fullName ?? '').slice(0, 120);
  return `${fileName}|${group}|${idxInGroup}|${row.sourceRow ?? '-'}|${name}`;
}

type TripOption = {
  id: string;
  name: string;
  destination: string;
  departureDate: string;
};

type SaveClientsResponse = {
  tripId: string;
  savedCount: number;
  failedCount: number;
  saved: {clientId: string; paymentId?: string; paymentError?: string}[];
  failed: {index: number; error: string}[];
  error?: string;
};

const IMPORT_OPTIONS: readonly {
  value: ImportKind;
  title: string;
  description: string;
}[] = [
  {
    value: 'spreadsheet',
    title: 'Spreadsheet',
    description: 'CSV or Excel (.csv, .xlsx, .xls) with header row',
  },
  // {
  //   value: 'pdf',
  //   title: 'PDF',
  //   description: 'Payment or receipt PDF (text-based extract)',
  // },
  // {
  //   value: 'word',
  //   title: 'Word document',
  //   description: '.docx export — legacy .doc is not supported',
  // },
];

export default function ImportPage() {
  const router = useRouter();
  const {toast} = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const tripSelectRef = useRef<HTMLSelectElement>(null);
  const [importKind, setImportKind] = useState<ImportKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiOk | null>(null);

  const [trips, setTrips] = useState<TripOption[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsHint, setTripsHint] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [groupTripIds, setGroupTripIds] = useState<Record<string, string>>({});
  const [creatingTrips, setCreatingTrips] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(() => new Set());
  const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set());
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    setTripsLoading(true);
    try {
      const res = await fetch('/api/trips');
      const json = (await res.json()) as {
        trips: TripOption[];
        mode?: string;
        message?: string;
      };
      const list = Array.isArray(json.trips) ? json.trips : [];
      setTrips(list);
      setTripsHint(json.mode === 'static' ? (json.message ?? null) : null);
      if (list.length === 1) {
        setSelectedTripId((prev) => prev || list[0]!.id);
      }
    } catch {
      setTrips([]);
      setTripsHint('Could not load trips.');
    } finally {
      setTripsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const markSaving = useCallback((keys: string[], on: boolean) => {
    setSavingKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }, []);

  const saveRowsToTrip = useCallback(
    async (tripId: string, rows: ImportExtractResult[], rowKeys: string[]) => {
      if (rows.length === 0) return;
      if (tripsLoading) {
        setSaveBanner('Still loading trips — try again in a moment.');
        return;
      }
      if (trips.length === 0) {
        setSaveBanner(
          'No trips loaded. Add at least one trip in your database, or set DATABASE_URL in frontend/.env.local.',
        );
        tripSelectRef.current?.focus();
        return;
      }
      const id = tripId.trim();
      if (!id) {
        setSaveBanner('Choose a trip for this group, then save again.');
        tripSelectRef.current?.focus();
        return;
      }
      setSaveBanner(null);
      markSaving(rowKeys, true);
      try {
        const res = await fetch('/api/import/save-clients', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({tripId: id, rows}),
        });
        const data = (await res.json()) as SaveClientsResponse;
        if (!res.ok) {
          setSaveBanner(data.error ?? `Save failed (${res.status}).`);
          return;
        }
        if (data.savedCount === 0) {
          const err =
            data.failedCount > 0
              ? data.failed.map((f) => f.error).join('; ')
              : 'No rows were saved.';
          setSaveBanner(`Save failed: ${err}`);
          return;
        }
        const failedIdx = new Set(data.failed.map((f) => f.index));
        const paymentNotes: string[] = [];
        let si = 0;
        const newlySaved: string[] = [];
        for (let i = 0; i < rows.length; i++) {
          if (failedIdx.has(i)) continue;
          const entry = data.saved[si++];
          if (entry?.paymentError) {
            const label = rows[i]?.client.fullName?.trim() || `Row ${i + 1}`;
            paymentNotes.push(`${label}: ${entry.paymentError}`);
          }
          newlySaved.push(rowKeys[i]!);
        }
        setSavedKeys((prev) => {
          const next = new Set(prev);
          for (const k of newlySaved) next.add(k);
          return next;
        });
        const parts: string[] = [];
        parts.push(`Saved ${data.savedCount} traveller(s) to Neon. View them on the Clients page.`);
        if (data.failedCount > 0) {
          parts.push(
            `${data.failedCount} failed: ${data.failed.map((f) => f.error).join('; ')}`,
          );
        }
        if (paymentNotes.length > 0) {
          parts.push(paymentNotes.slice(0, 3).join(' '));
          if (paymentNotes.length > 3) parts.push(`…and ${paymentNotes.length - 3} more payment notes.`);
        }
        setSaveBanner(parts.join(' '));
        router.refresh();
      } catch {
        setSaveBanner('Could not reach the server to save.');
      } finally {
        markSaving(rowKeys, false);
      }
    },
    [markSaving, router, trips.length, tripsLoading],
  );

  const groupedByDestination = useMemo(() => {
    if (!payload?.rows.length) return [];
    const map = new Map<string, ImportExtractResult[]>();
    for (const row of payload.rows) {
      const g = importDestinationGroupKey(row);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(row);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, {sensitivity: 'base'}))
      .map(([group, rows]) => ({group, rows}));
  }, [payload]);

  useEffect(() => {
    if (!payload || trips.length === 0) return;
    setGroupTripIds((prev) => {
      const next = {...prev};
      for (const {group} of groupedByDestination) {
        if (next[group]) continue;
        const matched = matchTripForGroup(group, trips);
        if (matched) next[group] = matched;
      }
      return next;
    });
  }, [payload, trips, groupedByDestination]);

  const tripIdForGroup = useCallback(
    (group: string) => {
      const perGroup = groupTripIds[group]?.trim();
      if (perGroup) return perGroup;
      return selectedTripId.trim();
    },
    [groupTripIds, selectedTripId],
  );

  const unmatchedGroups = useMemo(
    () =>
      groupedByDestination.filter(
        ({group}) => !tripIdForGroup(group) && group !== 'Uncategorized',
      ),
    [groupedByDestination, tripIdForGroup],
  );

  const createTripForGroup = useCallback(
    async (group: string): Promise<TripOption | null> => {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: group,
          destination: destinationFromGroupLabel(group),
          capacity: 40,
          status: 'Open',
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        trip?: TripOption;
        error?: string;
      };
      if (!res.ok || !json.trip) {
        toast(json.error ?? `Could not create trip for "${group}".`, 'error');
        return null;
      }
      setTrips((prev) => {
        if (prev.some((t) => t.id === json.trip!.id)) return prev;
        return [...prev, json.trip!].sort((a, b) =>
          a.departureDate.localeCompare(b.departureDate),
        );
      });
      setGroupTripIds((prev) => ({...prev, [group]: json.trip!.id}));
      return json.trip;
    },
    [toast],
  );

  const createAllMissingTrips = useCallback(async () => {
    if (unmatchedGroups.length === 0) return;
    setCreatingTrips(true);
    setSaveBanner(null);
    try {
      let created = 0;
      for (const {group} of unmatchedGroups) {
        const trip = await createTripForGroup(group);
        if (trip) created++;
      }
      if (created > 0) {
        toast(`Created ${created} departure(s) from import groups.`, 'success');
        setSaveBanner(
          `Created ${created} new departure(s). Each group now has its own trip — save travellers per group below.`,
        );
        router.refresh();
      }
    } finally {
      setCreatingTrips(false);
    }
  }, [createTripForGroup, router, toast, unmatchedGroups]);

  const canSaveToDb = Boolean(selectedTripId.trim()) && trips.length > 0;
  const firstGroupHint = groupedByDestination[0]?.group;
  const createTripDefaultName =
    firstGroupHint && firstGroupHint !== 'Uncategorized' ? firstGroupHint : '';

  const submit = useCallback(
    async (files: FileList | null, kind: ImportKind) => {
      const f = files?.[0];
      if (!f) return;
      setError(null);
      setPayload(null);
      setSavedKeys(new Set());
      setSaveBanner(null);
      setLoading(true);
      try {
        const body = new FormData();
        body.set('file', f);
        body.set('importKind', kind);
        const res = await fetch('/api/import-document', {method: 'POST', body});
        const text = await res.text();
        let json: ApiOk | {error: string};
        try {
          json = JSON.parse(text) as ApiOk | {error: string};
        } catch {
          setError(
            res.ok
              ? 'Invalid response from server.'
              : `Server error (${res.status}). If this persists after redeploying, check Vercel function logs.`,
          );
          return;
        }
        if (!res.ok) setError((json as {error: string}).error ?? 'Upload failed.');
        else {
          const ok = json as ApiOk;
          setPayload(ok);
          if ((ok.savedCount ?? 0) > 0) {
            if (ok.tripSync?.trips?.length) {
              setTrips(ok.tripSync.trips);
              setGroupTripIds(ok.tripSync.groupTripIds ?? {});
            }
            const groups = new Map<string, ImportExtractResult[]>();
            for (const row of ok.rows) {
              const group = importDestinationGroupKey(row);
              const list = groups.get(group) ?? [];
              list.push(row);
              groups.set(group, list);
            }
            const keys = new Set<string>();
            for (const [group, groupRows] of groups) {
              groupRows.forEach((row, idx) => {
                keys.add(makeRowKey(ok.fileName, group, idx, row));
              });
            }
            setSavedKeys(keys);
            toast(
              `Saved ${ok.savedCount} travellers. They are on Clients and the dashboard.`,
              'success',
            );
            setSaveBanner(
              `The sample file created the departures and saved ${ok.savedCount} travellers. Uploading it again adds them again.`,
            );
            router.refresh();
          } else if (ok.tripSync?.trips?.length) {
            setTrips(ok.tripSync.trips);
            setGroupTripIds(ok.tripSync.groupTripIds ?? {});
            if (ok.tripSync.createdCount > 0) {
              toast(
                `Synced ${ok.tripSync.trips.length} departures from your spreadsheet (${ok.tripSync.createdCount} new).`,
                'success',
              );
              setSaveBanner(
                `Each worksheet tab is now a departure in the database. Pick the trip per group below, then save travellers.`,
              );
              router.refresh();
            }
          }
        }
      } catch {
        setError('Could not reach the server.');
      } finally {
        setLoading(false);
      }
    },
    [router, toast],
  );

  const onPickKind = (next: ImportKind) => {
    setImportKind(next);
    setError(null);
    setPayload(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className='space-y-8'>
      <header className='space-y-2'>
        <h1 className='text-2xl font-semibold tracking-tight'>Import from document</h1>
        <p className='max-w-2xl text-sm text-muted-foreground'>
          First choose what you are importing, then pick a matching file. After extraction, pick a trip
          and save travellers one by one, per group, or all at once — they appear on the Clients page
          for that trip.
        </p>
      </header>

      <Card className='max-w-3xl'>
        <CardHeader>
          <CardTitle className='text-lg'>Sample spreadsheet</CardTitle>
          <CardDescription>
            Download this file, choose Spreadsheet below, then upload it. The two tabs become
            departures and the six travellers are saved onto Clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant='outline' asChild>
            <a href='/samples/dummy-travellers.xlsx' download='dummy-travellers.xlsx'>
              <Download />
              Download dummy spreadsheet
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className='max-w-3xl'>
        <CardHeader>
          <CardTitle className='text-lg'>Step 1 — File type</CardTitle>
          <CardDescription>
            This tells the parser which rules to apply. Extensions must match your choice (max 6 MB).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className='grid gap-3 sm:grid-cols-3'
            role='radiogroup'
            aria-label='Import file category'
          >
            {IMPORT_OPTIONS.map((opt) => {
              const selected = importKind === opt.value;
              return (
                <button
                  key={opt.value}
                  type='button'
                  role='radio'
                  aria-checked={selected}
                  aria-label={opt.title}
                  disabled={loading}
                  onClick={() => onPickKind(opt.value)}
                  className={
                    selected
                      ? 'rounded-lg border-2 border-primary bg-primary/5 p-4 text-left shadow-sm outline-none ring-2 ring-primary/20 transition-colors'
                      : 'rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  }
                >
                  <p className='font-semibold text-foreground'>{opt.title}</p>
                  <p className='mt-1 text-xs text-muted-foreground'>{opt.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className='max-w-xl'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <FileUp className='h-5 w-5' aria-hidden />
            Step 2 — Upload file
          </CardTitle>
          <CardDescription>
            {importKind ? (
              <>
                Accepts files for:{' '}
                <strong className='font-medium text-foreground'>
                  {IMPORT_OPTIONS.find((o) => o.value === importKind)?.title}
                </strong>
                .
              </>
            ) : (
              'Select a file type above before choosing a file.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <input
              ref={fileRef}
              id='import-document-file'
              type='file'
              accept={importKind ? ACCEPT_BY_KIND[importKind] : undefined}
              className='hidden'
              disabled={loading || !importKind}
              aria-label={
                importKind
                  ? `Choose ${IMPORT_OPTIONS.find((o) => o.value === importKind)?.title} file to import`
                  : 'Choose file (select file type first)'
              }
              onChange={(e) => {
                if (!importKind) return;
                void submit(e.target.files, importKind);
              }}
            />
            <Button
              type='button'
              variant='default'
              disabled={loading || !importKind}
              aria-label={
                loading
                  ? 'Reading file'
                  : importKind
                    ? 'Open file picker to upload export'
                    : 'Select file type first'
              }
              onClick={() => fileRef.current?.click()}
            >
              {loading ? 'Reading file…' : 'Choose file'}
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={loading}
              onClick={() => {
                setPayload(null);
                setError(null);
                setImportKind(null);
                setSavedKeys(new Set());
                setSaveBanner(null);
                if (fileRef.current) fileRef.current.value = '';
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
            {payload.warnings.map((w, wi) => (
              <li key={`warn-${wi}-${w.slice(0, 40)}`}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {payload && payload.rows.length > 0 ? (
        <div className='space-y-4'>
          {/* Save to database — bulk fallback UI hidden; use per-group controls below instead.
          <Card className='border-primary/20 bg-primary/[0.03]'>
            <CardHeader className='pb-2'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Database className='h-4 w-4' aria-hidden />
                Save to database
              </CardTitle>
              <CardDescription>
                Each destination group needs its own departure in the database. Use
                &ldquo;Create missing departures&rdquo; to add trips from your
                spreadsheet tabs, then save travellers per group.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {trips.length === 0 && !tripsLoading ? (
                <CreateTripInline
                  defaultName={createTripDefaultName}
                  defaultDestination={createTripDefaultName}
                  onCreated={(trip) => {
                    setTrips((prev) => {
                      if (prev.some((t) => t.id === trip.id)) return prev;
                      return [...prev, trip].sort((a, b) =>
                        a.departureDate.localeCompare(b.departureDate),
                      );
                    });
                    setSelectedTripId(trip.id);
                    setSaveBanner(`Created “${trip.name}”. You can save travellers now.`);
                  }}
                />
              ) : null}
              <div className='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center'>
                <label htmlFor='import-trip-select' className='text-sm font-medium'>
                  Default trip (fallback)
                </label>
                <select
                  ref={tripSelectRef}
                  id='import-trip-select'
                  className='h-9 max-w-md rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  disabled={tripsLoading || trips.length === 0}
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                >
                  <option value=''>
                    {tripsLoading ? 'Loading trips…' : trips.length === 0 ? 'No trips — create one first' : 'Select a trip'}
                  </option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.destination ? ` — ${t.destination}` : ''}
                      {t.departureDate ? ` (${t.departureDate})` : ''}
                    </option>
                  ))}
                </select>
                {unmatchedGroups.length > 0 ? (
                  <Button
                    type='button'
                    variant='default'
                    size='sm'
                    disabled={creatingTrips || tripsLoading}
                    onClick={() => void createAllMissingTrips()}
                  >
                    {creatingTrips ? (
                      <>
                        <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' aria-hidden />
                        Creating…
                      </>
                    ) : (
                      `Create missing departures (${unmatchedGroups.length})`
                    )}
                  </Button>
                ) : null}
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  disabled={
                    groupedByDestination.every(({rows, group}) =>
                      rows.every((row, idx) =>
                        savedKeys.has(makeRowKey(payload.fileName, group, idx, row)),
                      ),
                    ) ||
                    groupedByDestination.some(({rows, group}) =>
                      rows.some((row, idx) =>
                        savingKeys.has(makeRowKey(payload.fileName, group, idx, row)),
                      ),
                    ) ||
                    tripsLoading
                  }
                  onClick={async () => {
                    for (const {group, rows} of groupedByDestination) {
                      const tripId = tripIdForGroup(group);
                      if (!tripId) {
                        setSaveBanner(
                          `No trip for "${group}". Create missing departures or pick a trip for that group.`,
                        );
                        return;
                      }
                      const pendingRows: ImportExtractResult[] = [];
                      const pendingKeys: string[] = [];
                      rows.forEach((row, idx) => {
                        const k = makeRowKey(payload.fileName, group, idx, row);
                        if (!savedKeys.has(k)) {
                          pendingRows.push(row);
                          pendingKeys.push(k);
                        }
                      });
                      if (pendingRows.length > 0) {
                        await saveRowsToTrip(tripId, pendingRows, pendingKeys);
                      }
                    }
                  }}
                >
                  Save all not yet saved
                </Button>
              </div>
              {unmatchedGroups.length > 0 ? (
                <p className='text-sm text-amber-800 dark:text-amber-200' role='status'>
                  {unmatchedGroups.length} group
                  {unmatchedGroups.length === 1 ? '' : 's'} still need a departure:{' '}
                  {unmatchedGroups
                    .slice(0, 4)
                    .map(({group}) => group)
                    .join(', ')}
                  {unmatchedGroups.length > 4
                    ? ` …and ${unmatchedGroups.length - 4} more`
                    : ''}
                  . Click &ldquo;Create missing departures&rdquo; or choose a trip per group below.
                </p>
              ) : null}
              {tripsHint ? <p className='text-xs text-amber-800 dark:text-amber-200'>{tripsHint}</p> : null}
              {!canSaveToDb && trips.length > 0 && !tripsLoading ? (
                <p className='text-sm text-amber-800 dark:text-amber-200' role='status'>
                  Select a trip above before saving travellers.
                </p>
              ) : null}
              {saveBanner ? (
                <p
                  className={
                    saveBanner.startsWith('Save failed')
                      ? 'text-sm text-destructive'
                      : 'text-sm text-muted-foreground'
                  }
                  role='status'
                >
                  {saveBanner}
                </p>
              ) : null}
            </CardContent>
          </Card>
          */}

          <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
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
            {groupedByDestination.length > 1 ? (
              <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                <MapPin className='h-3.5 w-3.5 shrink-0' aria-hidden />
                Split into {groupedByDestination.length} groups (worksheet tab or trip name).
              </p>
            ) : payload.format === 'spreadsheet' ? (
              <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                <MapPin className='h-3.5 w-3.5 shrink-0' aria-hidden />
                One group — multi-tab .xlsx files get a section per sheet when Python extract runs.
              </p>
            ) : null}
          </div>
          {saveBanner ? (
            <p
              className={
                saveBanner.startsWith('Save failed') || saveBanner.includes('failed')
                  ? 'text-sm text-destructive'
                  : 'text-sm text-muted-foreground'
              }
              role='status'
            >
              {saveBanner}
            </p>
          ) : null}
          <div className='space-y-8'>
            {groupedByDestination.map(({group, rows}) => {
              const keys = rows.map((row, idx) => makeRowKey(payload.fileName, group, idx, row));
              const allInGroupSaved = keys.every((k) => savedKeys.has(k));
              const groupSaving = keys.some((k) => savingKeys.has(k));
              const pendingRows = rows.filter((row, idx) => !savedKeys.has(keys[idx]!));
              const pendingKeys = keys.filter((k) => !savedKeys.has(k));
              return (
                <section
                  key={`grp-${payload.fileName}-${group}`}
                  className='rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm dark:bg-muted/10'
                >
                  <div className='mb-4 flex flex-wrap items-center gap-2 border-b border-border/60 pb-3'>
                    <span className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
                      Destination / group
                    </span>
                    <Badge variant='secondary' className='max-w-[min(100%,32rem)] truncate font-medium'>
                      {group}
                    </Badge>
                    <span className='text-xs text-muted-foreground'>
                      {rows.length} {rows.length === 1 ? 'record' : 'records'}
                    </span>
                    <label className='sr-only' htmlFor={`trip-${group}`}>
                      Trip for {group}
                    </label>
                    <select
                      id={`trip-${group}`}
                      className='h-8 max-w-[16rem] rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      disabled={tripsLoading || trips.length === 0}
                      value={tripIdForGroup(group)}
                      onChange={(e) =>
                        setGroupTripIds((prev) => ({...prev, [group]: e.target.value}))
                      }
                    >
                      <option value=''>Select trip…</option>
                      {trips.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.destination ? ` — ${t.destination}` : ''}
                        </option>
                      ))}
                    </select>
                    {!tripIdForGroup(group) && group !== 'Uncategorized' ? (
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='h-8 text-xs'
                        disabled={creatingTrips}
                        onClick={() => void createTripForGroup(group)}
                      >
                        Create trip
                      </Button>
                    ) : null}
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      className='ml-auto'
                      disabled={
                        !tripIdForGroup(group) ||
                        tripsLoading ||
                        allInGroupSaved ||
                        groupSaving ||
                        pendingRows.length === 0
                      }
                      onClick={() => {
                        void saveRowsToTrip(tripIdForGroup(group), pendingRows, pendingKeys);
                      }}
                    >
                      {groupSaving ? (
                        <>
                          <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' aria-hidden />
                          Saving…
                        </>
                      ) : (
                        'Save all in this group'
                      )}
                    </Button>
                  </div>
                  <div className='space-y-4'>
                    {rows.map((row, idx) => {
                      const rowKey = keys[idx]!;
                      return (
                        <ExtractedCard
                          key={`import-${payload.fileName}-g-${group}-i${idx}-r${row.sourceRow ?? 'na'}`}
                          row={row}
                          rowKey={rowKey}
                          isSaved={savedKeys.has(rowKey)}
                          isSaving={savingKeys.has(rowKey)}
                          canSave={Boolean(tripIdForGroup(group))}
                          onSave={() => {
                            void saveRowsToTrip(tripIdForGroup(group), [row], [rowKey]);
                          }}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
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
            <span className='font-mono text-foreground'>Total amount to be paid</span>,{' '}
            <span className='font-mono text-foreground'>Amount paid</span>,{' '}
            <span className='font-mono text-foreground'>Outstanding amount</span>,{' '}
            <span className='font-mono text-foreground'>Balance Due</span>.
            For .xlsx, install Python + openpyxl (see <span className='font-mono text-foreground'>backend/python/README.md</span>) for best multi-sheet extraction.
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

function ExtractedCard({
  row,
  rowKey,
  isSaved,
  isSaving,
  canSave,
  onSave,
}: {
  row: ImportExtractResult;
  rowKey: string;
  isSaved: boolean;
  isSaving: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
  return (
    <Card data-row-key={rowKey}>
      <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-4'>
        <CardTitle className='text-base'>
          Traveller profile & payment
          {row.sourceRow != null ? (
            <span className='ml-2 font-mono text-sm font-normal text-muted-foreground'>
              (row {row.sourceRow})
            </span>
          ) : null}
        </CardTitle>
        <div className='flex flex-wrap items-center gap-2'>
          {isSaved ? (
            <Badge variant='outline' className='border-emerald-600/50 text-emerald-800 dark:text-emerald-200'>
              Saved
            </Badge>
          ) : (
            <Button
              type='button'
              size='sm'
              variant='default'
              disabled={isSaving || !canSave}
              title={!canSave ? 'Select or create a trip first' : undefined}
              onClick={onSave}
            >
              {isSaving ? (
                <>
                  <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' aria-hidden />
                  Saving…
                </>
              ) : (
                'Save traveller'
              )}
            </Button>
          )}
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
        </div>
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
                row.client.outstandingAmount != null
                  ? formatZAR(row.client.outstandingAmount)
                  : row.client.balanceDueDate
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
              label='Amount paid'
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
