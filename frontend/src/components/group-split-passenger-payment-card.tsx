"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecordGroupSplitPaymentForm } from "@/components/record-group-split-payment-form";

export function GroupSplitPassengerPaymentCard({
  groupBookingId,
  passengerId,
  passengerName,
  balance,
}: {
  groupBookingId: string;
  passengerId: string;
  passengerName: string;
  balance: number;
}) {
  const router = useRouter();

  if (balance <= 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Record payment</CardTitle>
        <CardDescription>
          Credit an additional payment toward this traveller&apos;s package
          balance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RecordGroupSplitPaymentForm
          groupBookingId={groupBookingId}
          passengerId={passengerId}
          passengerName={passengerName}
          balance={balance}
          onRecorded={() => router.refresh()}
        />
      </CardContent>
    </Card>
  );
}
