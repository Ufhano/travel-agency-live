export type SendInvoiceEmailInput = {
  to: string;
  clientName: string;
  invoiceNumber: string;
  tripName: string;
  pdfBase64: string;
  filename: string;
};

export type SendInvoiceEmailResult =
  | { mode: "sent"; to: string }
  | { mode: "unconfigured" };

function resendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

function emailFromEnv(): string | null {
  return process.env.EMAIL_FROM?.trim() || null;
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "Traveller";
}

export async function sendInvoiceEmailWithPdf(
  input: SendInvoiceEmailInput,
): Promise<SendInvoiceEmailResult> {
  const apiKey = resendApiKey();
  const from = emailFromEnv();
  if (!apiKey || !from) return { mode: "unconfigured" };

  const subject = `Invoice ${input.invoiceNumber} — ${input.tripName}`;
  const text = [
    `Dear ${firstName(input.clientName)},`,
    "",
    "Please find your invoice attached as a PDF.",
    "",
    `Invoice number: ${input.invoiceNumber}`,
    `Trip: ${input.tripName}`,
    "",
    "Thank you for travelling with Nendila Travel & Explorers.",
  ].join("\n");

  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to.trim()],
      subject,
      text,
      attachments: [
        {
          filename: input.filename,
          content: input.pdfBase64,
        },
      ],
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Resend error ${res.status}`);
  }

  return { mode: "sent", to: input.to.trim() };
}
