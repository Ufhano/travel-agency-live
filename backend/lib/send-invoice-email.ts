import nodemailer from "nodemailer";

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

function gmailUser(): string | null {
  return process.env.GMAIL_USER?.trim() || null;
}

function gmailAppPassword(): string | null {
  // App passwords are shown with spaces (e.g. "abcd efgh ijkl mnop"); strip them.
  return process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") || null;
}

function fromAddress(user: string): string {
  const configured = process.env.EMAIL_FROM?.trim();
  return configured || `Travel Agency <${user}>`;
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "Traveller";
}

export async function sendInvoiceEmailWithPdf(
  input: SendInvoiceEmailInput,
): Promise<SendInvoiceEmailResult> {
  const user = gmailUser();
  const pass = gmailAppPassword();
  if (!user || !pass) return { mode: "unconfigured" };

  const subject = `Invoice ${input.invoiceNumber} — ${input.tripName}`;
  const text = [
    `Dear ${firstName(input.clientName)},`,
    "",
    "Please find your invoice attached as a PDF.",
    "",
    `Invoice number: ${input.invoiceNumber}`,
    `Trip: ${input.tripName}`,
    "",
    "Thank you for travelling with us.",
  ].join("\n");

  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: fromAddress(user),
    to: input.to.trim(),
    subject,
    text,
    replyTo,
    attachments: [
      {
        filename: input.filename,
        content: Buffer.from(input.pdfBase64, "base64"),
        contentType: "application/pdf",
      },
    ],
  });

  return { mode: "sent", to: input.to.trim() };
}
