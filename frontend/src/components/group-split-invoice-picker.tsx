"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatZAR } from "@/lib/utils";

export function GroupSplitInvoicePicker({
  passengerId,
  passengerName,
  packagePrice,
  totalPaid,
  balance,
}: {
  passengerId: string;
  passengerName: string;
  packagePrice: number;
  totalPaid: number;
  balance: number;
}) {
  const fullyPaid = balance <= 0;
  const canPartial = totalPaid > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Invoice</CardTitle>
        <CardDescription>
          Generate a partial statement for the amount paid so far, or a final
          invoice when the package is fully paid.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1 text-sm text-muted-foreground">
          <p>
            Package:{" "}
            <span className="font-medium text-foreground">
              {formatZAR(packagePrice)}
            </span>
          </p>
          <p>
            Paid:{" "}
            <span className="font-medium text-emerald-800 dark:text-emerald-300">
              {formatZAR(totalPaid)}
            </span>
            {" · "}
            Remaining:{" "}
            <span className="font-medium text-foreground">
              {formatZAR(balance)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPartial ? (
            <Button variant="default" size="sm" className="gap-1.5" asChild>
              <Link href={`/clients/gs/${passengerId}/invoice?type=partial`}>
                <FileText className="h-4 w-4" />
                Partial invoice
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled
              title="No payments recorded yet."
            >
              <FileText className="h-4 w-4" />
              Partial invoice
            </Button>
          )}
          {fullyPaid ? (
            <Button variant="secondary" size="sm" className="gap-1.5" asChild>
              <Link href={`/clients/gs/${passengerId}/invoice?type=full`}>
                <FileText className="h-4 w-4" />
                Paid in full invoice
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled
              title={`${passengerName} still owes ${formatZAR(balance)} — partial invoice only until fully paid.`}
            >
              <FileText className="h-4 w-4" />
              Paid in full invoice
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
