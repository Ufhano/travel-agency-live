import nodemailer from "nodemailer";

export type SendBookingConfirmationInput = {
  to: string;
  clientName: string;
  tripName: string;
  destination: string;
  departureDate: string;
  amountZar: number;
  invoiceNumber: string;
};

function gmailUser(): string | null {
  return process.env.GMAIL_USER?.trim() || null;
}

function gmailAppPassword(): string | null {
  return process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") || null;
}

function fromAddress(user: string): string {
  const configured = process.env.EMAIL_FROM?.trim();
  return configured || `Nendila Travel & Explorers <${user}>`;
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "Traveller";
}

function formatZar(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function sendBookingConfirmationEmail(
  input: SendBookingConfirmationInput,
): Promise<void> {
  const user = gmailUser();
  const pass = gmailAppPassword();
  if (!user || !pass) {
    console.warn("[booking-email] Gmail not configured — skipping confirmation email.");
    return;
  }

  const subject = `Booking confirmed — ${input.tripName}`;
  const text = [
    `Dear ${firstName(input.clientName)},`,
    "",
    "Thank you for your booking! Your payment was received successfully.",
    "",
    `Trip: ${input.tripName}`,
    `Destination: ${input.destination}`,
    `Departure: ${input.departureDate}`,
    `Amount paid: ${formatZar(input.amountZar)}`,
    `Invoice reference: ${input.invoiceNumber}`,
    "",
    "Our team will be in touch with further travel details.",
    "",
    "Nendila Travel & Explorers",
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
  });
}
