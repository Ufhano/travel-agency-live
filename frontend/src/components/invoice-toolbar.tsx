"use client";

import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Print the on-screen invoice so PDF matches the live layout (styles, logo, fonts). */
function printInvoice(invoiceNumber: string) {
  const originalTitle = document.title;
  document.title = `Invoice ${invoiceNumber}`;

  const restore = () => {
    document.title = originalTitle;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

export function InvoiceToolbar({
  clientId,
  tripId,
  invoiceNumber,
}: {
  clientId: string;
  tripId: string;
  invoiceNumber: string;
}) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All invoices
      </Link>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`/clients/${clientId}`}>Client profile</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`/trips/${tripId}`}>Trip detail</Link>
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="gap-2"
          onClick={() => printInvoice(invoiceNumber)}
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          onClick={() => printInvoice(invoiceNumber)}
        >
          <Download className="h-4 w-4" />
          Save as PDF
        </Button>
      </div>
    </div>
  );
}
