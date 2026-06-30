"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Download,
  Loader2,
  Mail,
  MessageCircle,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateInvoicePdfBlob,
  invoicePdfFilename,
} from "@/lib/generate-invoice-pdf";
import { printInvoice } from "@/lib/invoice-print";
import { formatZAR, hasRealClientEmail } from "@/lib/utils";
import { DeleteInvoiceButton } from "@/components/delete-invoice-button";

/** Print the on-screen invoice so PDF matches the live layout (styles, logo, fonts). */
function whatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("27")) return digits;
  if (digits.startsWith("0")) return `27${digits.slice(1)}`;
  return digits;
}

function shareMessage(ctx: {
  clientName: string;
  invoiceNumber: string;
  tripName: string;
  amount: number;
  balance: number;
}): string {
  return [
    `Hi ${ctx.clientName},`,
    `Please find your invoice ${ctx.invoiceNumber} for ${ctx.tripName}.`,
    `Amount paid: ${formatZAR(ctx.amount)}.`,
    `Outstanding: ${formatZAR(ctx.balance)}.`,
  ].join(" ");
}

export function InvoiceToolbar({
  paymentId,
  clientId,
  tripId,
  invoiceNumber,
  clientName,
  clientEmail,
  clientPhone,
  tripName,
  amount,
  balance,
}: {
  paymentId: string;
  clientId: string;
  tripId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  tripName: string;
  amount: number;
  balance: number;
}) {
  const [busy, setBusy] = useState<"whatsapp" | "email" | "pdf" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasEmail = hasRealClientEmail(clientEmail);
  const msg = shareMessage({
    clientName,
    invoiceNumber,
    tripName,
    amount,
    balance,
  });

  async function buildPdfFile(): Promise<File> {
    const blob = await generateInvoicePdfBlob(invoiceNumber);
    return new File([blob], invoicePdfFilename(invoiceNumber), {
      type: "application/pdf",
    });
  }

  async function sendViaWhatsApp() {
    setBusy("whatsapp");
    setError(null);
    setFeedback(null);
    try {
      const file = await buildPdfFile();
      const shareData: ShareData = {
        files: [file],
        title: `Invoice ${invoiceNumber}`,
        text: msg,
      };

      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setFeedback("Invoice PDF shared — choose WhatsApp to send with attachment.");
        return;
      }

      const phone = whatsAppPhone(clientPhone);
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(link.href);

      window.open(url, "_blank", "noopener,noreferrer");
      setFeedback(
        "PDF downloaded. In WhatsApp, tap Attach and choose the downloaded invoice PDF.",
      );
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Could not share via WhatsApp.");
    } finally {
      setBusy(null);
    }
  }

  async function sendViaEmail() {
    if (!hasEmail) return;
    setBusy("email");
    setError(null);
    setFeedback(null);
    try {
      const file = await buildPdfFile();
      const subject = `Invoice ${invoiceNumber} — ${tripName}`;
      const emailBody = [
        `Dear ${clientName},`,
        "",
        "Please find your invoice attached as a PDF.",
        "",
        `Invoice number: ${invoiceNumber}`,
        `Trip: ${tripName}`,
        `Amount paid: ${formatZAR(amount)}`,
        `Outstanding: ${formatZAR(balance)}`,
        "",
        "Thank you for travelling with Nendila Travel & Explorers.",
      ].join("\n");

      const shareData: ShareData = {
        files: [file],
        title: subject,
        text: emailBody,
      };

      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setFeedback("Invoice PDF shared — choose your email app to send with attachment.");
        return;
      }

      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(link.href);

      const gmailUrl =
        "https://mail.google.com/mail/?view=cm&fs=1" +
        `&to=${encodeURIComponent(clientEmail)}` +
        `&su=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(emailBody)}`;
      window.open(gmailUrl, "_blank", "noopener,noreferrer");

      setFeedback(
        "PDF downloaded and a Gmail compose window opened. Click the attach (paperclip) icon and choose the downloaded invoice PDF, then send.",
      );
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Could not open email.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="no-print space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={busy !== null}
            onClick={() => void sendViaWhatsApp()}
          >
            {busy === "whatsapp" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Send via WhatsApp</span>
            <span className="sm:hidden">WhatsApp</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!hasEmail || busy !== null}
            title={!hasEmail ? "No email on record for this client" : undefined}
            onClick={() => void sendViaEmail()}
          >
            {busy === "email" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Send via Email
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
            disabled={busy !== null}
            onClick={async () => {
              setBusy("pdf");
              setError(null);
              try {
                const file = await buildPdfFile();
                const link = document.createElement("a");
                link.href = URL.createObjectURL(file);
                link.download = file.name;
                link.click();
                URL.revokeObjectURL(link.href);
                setFeedback("PDF downloaded.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not create PDF.");
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Save as PDF
          </Button>
          <DeleteInvoiceButton
            paymentId={paymentId}
            invoiceNumber={invoiceNumber}
            clientName={clientName}
            redirectTo="/invoices"
            variant="outline"
            size="sm"
            label="Delete"
          />
        </div>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className="text-sm text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
