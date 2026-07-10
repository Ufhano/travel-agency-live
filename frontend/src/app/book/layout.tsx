import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book your trip — Nendila Travel & Explorers",
  description: "Reserve your seat on our featured departure and pay securely with Yoco.",
};

export default function PublicBookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-foreground">
      {children}
    </div>
  );
}
