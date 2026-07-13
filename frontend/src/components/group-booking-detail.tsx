"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientFullyPaidBadge } from "@/components/client-fully-paid-badge";
import { RecordGroupSplitPaymentForm } from "@/components/record-group-split-payment-form";
import { formatDate, formatZAR } from "@/lib/utils";
import type {
  GroupBookingPassenger,
  GroupBookingPassengerPayment,
  GroupBookingStatus,
  GroupBookingWithPassengers,
} from "@backend/types";

function statusBadgeVariant(
  status: GroupBookingStatus,
): "warning" | "secondary" | "success" {
  if (status === "Complete") return "success";
  if (status === "Partial") return "secondary";
  return "warning";
}

function passengerBalance(passenger: GroupBookingPassenger): number {
  return Math.max(0, passenger.packagePrice - passenger.amountPaid);
}

function EditablePackagePerPerson({
  groupBookingId,
  packagePrice,
  onUpdated,
}: {
  groupBookingId: string;
  packagePrice: number;
  onUpdated: (next: {
    packagePrice: number;
    groupBooking: GroupBookingWithPassengers;
  }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(packagePrice));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(packagePrice));
  }, [packagePrice, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function cancel() {
    setDraft(String(packagePrice));
    setError(null);
    setEditing(false);
  }

  async function commit() {
    const next = Math.round(Number(draft));
    if (!Number.isFinite(next) || next <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (next === packagePrice) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/group-bookings/${groupBookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packagePricePerPerson: next }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        packagePrice?: number;
        groupBooking?: GroupBookingWithPassengers;
        error?: string;
      };
      if (!res.ok || !json.groupBooking || json.packagePrice == null) {
        setError(json.error ?? `Failed to save (HTTP ${res.status}).`);
        return;
      }
      onUpdated({
        packagePrice: json.packagePrice,
        groupBooking: json.groupBooking,
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="group mt-1 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-lg font-semibold tabular-nums hover:underline"
          title="Click to edit package price"
        >
          {formatZAR(packagePrice)}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Edit package per person"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="h-8 w-[7.5rem] tabular-nums"
          aria-label="Package price per person"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void commit()}
          className="shrink-0 rounded p-1 text-emerald-700 hover:bg-muted disabled:opacity-50"
          aria-label="Save package price"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={cancel}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error ? (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Applies to all passengers
        </p>
      )}
    </div>
  );
}

export function GroupBookingDetail({ groupBookingId }: { groupBookingId: string }) {
  const [groupBooking, setGroupBooking] =
    useState<GroupBookingWithPassengers | null>(null);
  const [followUpPayments, setFollowUpPayments] = useState<
    GroupBookingPassengerPayment[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPassengerId, setExpandedPassengerId] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/group-bookings/${groupBookingId}`);
      const json = (await res.json()) as {
        groupBooking?: GroupBookingWithPassengers;
        followUpPayments?: GroupBookingPassengerPayment[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load group booking.");
      }
      setGroupBooking(json.groupBooking ?? null);
      setFollowUpPayments(json.followUpPayments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load group booking.");
    } finally {
      setLoading(false);
    }
  }, [groupBookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading group booking…
      </div>
    );
  }

  if (error && !groupBooking) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Could not load group booking
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <Link href="/group-bookings">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to list
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!groupBooking) return null;

  const paymentsByPassenger = new Map<string, GroupBookingPassengerPayment[]>();
  for (const payment of followUpPayments) {
    const list = paymentsByPassenger.get(payment.passengerId) ?? [];
    list.push(payment);
    paymentsByPassenger.set(payment.passengerId, list);
  }

  const packagePerPerson = groupBooking.passengers[0]?.packagePrice;
  const passengerCount = groupBooking.passengers.length;
  const groupExpectedTotal =
    packagePerPerson != null
      ? packagePerPerson * passengerCount
      : groupBooking.passengers.reduce((sum, p) => sum + p.packagePrice, 0);
  const groupPaidTotal = groupBooking.passengers.reduce(
    (sum, p) => sum + p.amountPaid,
    0,
  );

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">
                {groupBooking.referenceNumber}
              </CardTitle>
              <CardDescription className="mt-1">
                {groupBooking.tripName} · {groupBooking.tripDestination}
              </CardDescription>
            </div>
            <Badge variant={statusBadgeVariant(groupBooking.status)}>
              {groupBooking.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Group payment received
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatZAR(groupExpectedTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Package per person
            </p>
            {packagePerPerson != null ? (
              <EditablePackagePerPerson
                groupBookingId={groupBookingId}
                packagePrice={packagePerPerson}
                onUpdated={({ groupBooking: next }) => {
                  setGroupBooking(next);
                }}
              />
            ) : (
              <p className="mt-1 text-lg font-semibold tabular-nums">—</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payment date
            </p>
            <p className="mt-1 text-sm font-medium">
              {formatDate(groupBooking.paidAt)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fully paid
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatZAR(groupPaidTotal)} / {formatZAR(groupExpectedTotal)}
            </p>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Initial group proof of payment
            </p>
            {groupBooking.proofFileName ? (
              <Button
                variant="link"
                size="sm"
                className="mt-0 h-auto gap-1.5 px-0"
                asChild
              >
                <a
                  href={`/api/group-bookings/${groupBookingId}/proof`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {groupBooking.proofFileName}
                </a>
              </Button>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No file</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passengers</CardTitle>
          <CardDescription>
            Record payments until each passenger&apos;s balance is cleared.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {groupBooking.passengers.map((p) => {
            const balance = passengerBalance(p);
            const extraPayments = paymentsByPassenger.get(p.id) ?? [];
            const expanded = expandedPassengerId === p.id;

            return (
              <div
                key={p.id}
                className="rounded-lg border border-border/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.passengerName}</p>
                    {p.passengerEmail ? (
                      <p className="text-sm text-muted-foreground">
                        {p.passengerEmail}
                      </p>
                    ) : null}
                  </div>
                  <ClientFullyPaidBadge balance={balance} />
                </div>

                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Package</p>
                    <p className="font-semibold tabular-nums">
                      {formatZAR(p.packagePrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paid total</p>
                    <p className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                      {formatZAR(p.amountPaid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="font-semibold tabular-nums">
                      {formatZAR(balance)}
                    </p>
                  </div>
                </div>

                {extraPayments.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Additional payments
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Note</TableHead>
                          <TableHead>Proof</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extraPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.paidAt)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatZAR(payment.amount)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {payment.note || "—"}
                            </TableCell>
                            <TableCell>
                              {payment.proofFileName ? (
                                <a
                                  href={`/api/group-bookings/${groupBookingId}/passengers/${p.id}/payments/${payment.id}/proof`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  {payment.proofFileName}
                                </a>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                {balance > 0 ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        setExpandedPassengerId(expanded ? null : p.id)
                      }
                    >
                      {expanded ? "Hide payment form" : "Record payment"}
                    </Button>
                    {expanded ? (
                      <RecordGroupSplitPaymentForm
                        groupBookingId={groupBookingId}
                        passengerId={p.id}
                        passengerName={p.passengerName}
                        balance={balance}
                        onRecorded={() => void load()}
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
