import nodemailer from "nodemailer";

export type SendVerificationResult =
  | { mode: "sent" }
  | { mode: "unconfigured" };

function gmailUser(): string | null {
  return process.env.GMAIL_USER?.trim() || null;
}

function gmailAppPassword(): string | null {
  return process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") || null;
}

function fromAddress(user: string): string {
  const configured = process.env.EMAIL_FROM?.trim();
  return configured || `Travel Agency <${user}>`;
}

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  link: string;
}): Promise<SendVerificationResult> {
  const user = gmailUser();
  const pass = gmailAppPassword();
  if (!user || !pass) return { mode: "unconfigured" };

  const first = input.name.trim().split(/\s+/)[0] || "there";
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: fromAddress(user),
    to: input.to.trim(),
    subject: "Confirm your Travel Agency account",
    text: [
      `Hi ${first},`,
      "",
      "Confirm your email to finish creating your account:",
      input.link,
      "",
      "This link expires in 24 hours. If you did not register, you can ignore this email.",
    ].join("\n"),
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
  });

  return { mode: "sent" };
}
