"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatZAR } from "@/lib/utils";
import type {
  GroupBookingStatus,
  GroupBookingWithPassengers,
  PassengerPaidStatus,
} from "@backend/types";

function statusBadgeVariant(
  status: GroupBookingStatus,
): "warning" | "secondary" | "success" {
  if (status === "Complete") return "success";
  if (status === "Partial") return "secondary";
  return "warning";
}

export function GroupBookingDetail({ groupBookingId }: { groupBookingId: string }) {
  const [groupBooking, setGroupBooking] =
    useState<GroupBookingWithPassengers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/group-bookings/${groupBookingId}`);
      const json = (await res.json()) as {
        groupBooking?: GroupBookingWithPassengers;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load group booking.");
      }
      setGroupBooking(json.groupBooking ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load group booking.");
    } finally {
      setLoading(false);
    }
  }, [groupBookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePaid(
    passengerId: string,
    current: PassengerPaidStatus,
  ) {
    const next: PassengerPaidStatus = current === "paid" ? "unpaid" : "paid";
    setUpdatingId(passengerId);
    try {
      const res = await fetch(
        `/api/group-bookings/${groupBookingId}/passengers/${passengerId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paidStatus: next }),
        },
      );
      const json = (await res.json()) as {
        error?: string;
        passenger?: { id: string; paidStatus: PassengerPaidStatus };
        groupStatus?: GroupBookingStatus;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not update passenger.");
      }

      setGroupBooking((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: json.groupStatus ?? prev.status,
          passengers: prev.passengers.map((p) =>
            p.id === passengerId
              ? { ...p, paidStatus: json.passenger?.paidStatus ?? next }
              : p,
          ),
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update passenger.");
    } finally {
      setUpdatingId(null);
    }
  }

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

  const paidCount = groupBooking.passengers.filter(
    (p) => p.paidStatus === "paid",
  ).length;

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
              Group total
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatZAR(groupBooking.totalAmount)}
            </p>
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
              Passengers paid
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {paidCount} / {groupBooking.passengers.length}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proof of payment
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
          <CardTitle className="text-base">Passenger allocations</CardTitle>
          <CardDescription>
            Mark each passenger as paid once their individual share has been
            received.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Passenger</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupBooking.passengers.map((p) => {
                const isPaid = p.paidStatus === "paid";
                const busy = updatingId === p.id;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.passengerName}
                      <div className="text-xs text-muted-foreground sm:hidden">
                        {p.passengerEmail}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {p.passengerEmail}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZAR(p.amount)}
                    </TableCell>
                    <TableCell>
                      {isPaid ? (
                        <Badge variant="success">Paid</Badge>
                      ) : (
                        <Badge variant="warning">Unpaid</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant={isPaid ? "outline" : "default"}
                        size="sm"
                        className="gap-1.5"
                        disabled={busy}
                        onClick={() => void togglePaid(p.id, p.paidStatus)}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isPaid ? (
                          <XCircle className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {isPaid ? "Undo" : "Mark paid"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
