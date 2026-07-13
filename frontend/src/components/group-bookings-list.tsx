"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
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
import type { GroupBookingListItem, GroupBookingStatus } from "@backend/types";

function statusBadgeVariant(
  status: GroupBookingStatus,
): "warning" | "secondary" | "success" {
  if (status === "Complete") return "success";
  if (status === "Partial") return "secondary";
  return "warning";
}

export function GroupBookingsList() {
  const [groupBookings, setGroupBookings] = useState<GroupBookingListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/group-bookings");
        const json = (await res.json()) as {
          groupBookings?: GroupBookingListItem[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? "Failed to load group bookings.");
        }
        if (!cancelled) {
          setGroupBookings(json.groupBookings ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load group bookings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading group bookings…
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Could not load group bookings
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (groupBookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">No group bookings yet</CardTitle>
          <CardDescription>
            Create a group fare split when passengers pay together for one trip.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/group-bookings/new">
              <Plus className="h-4 w-4" />
              New group booking
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 sm:px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Trip</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden md:table-cell">Paid on</TableHead>
              <TableHead className="text-right">Passengers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupBookings.map((gb) => (
              <TableRow key={gb.id}>
                <TableCell>
                  <Link
                    href={`/group-bookings/${gb.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {gb.referenceNumber}
                  </Link>
                </TableCell>
                <TableCell>{gb.tripName}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatZAR(gb.totalExpected)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(gb.paidAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {gb.passengerCount}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(gb.status)}>
                    {gb.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(gb.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
