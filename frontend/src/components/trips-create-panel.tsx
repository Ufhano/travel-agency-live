"use client";

import { useRouter } from "next/navigation";
import { CreateTripInline } from "@/components/create-trip-inline";

export function TripsCreatePanel() {
  const router = useRouter();

  return (
    <CreateTripInline
      onCreated={() => {
        router.refresh();
      }}
    />
  );
}
