import Link from "next/link";
import { AlertCircle, AlertTriangle, CircleCheck } from "lucide-react";
import type { KeyOperationalInsight } from "@backend/types";
import { cn } from "@/lib/utils";

const toneMessage: Record<KeyOperationalInsight["tone"], string> = {
  amber: "text-amber-600 dark:text-amber-500",
  red: "text-red-600 dark:text-red-400",
  green: "text-green-600 dark:text-green-500",
};

const toneIcon: Record<KeyOperationalInsight["tone"], string> = {
  amber: "text-amber-600 dark:text-amber-500",
  red: "text-red-600 dark:text-red-400",
  green: "text-green-600 dark:text-green-500",
};

function InsightIcon({ tone }: { tone: KeyOperationalInsight["tone"] }) {
  const className = cn("mt-0.5 h-4 w-4 shrink-0", toneIcon[tone]);
  if (tone === "red") return <AlertCircle className={className} aria-hidden />;
  if (tone === "green")
    return <CircleCheck className={className} aria-hidden />;
  return <AlertTriangle className={className} aria-hidden />;
}

export function KeyOperationalInsights({
  insights,
}: {
  insights: KeyOperationalInsight[];
}) {
  if (insights.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      aria-labelledby="key-operational-insights-heading"
    >
      <div className="mb-5 space-y-2">
        <h2
          id="key-operational-insights-heading"
          className="text-xl font-semibold tracking-tight text-gray-900 dark:text-zinc-50"
        >
          Key Operational Insights
        </h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Actionable insights based on trip occupancy, payments, and client
          balances.
        </p>
      </div>

      <ul className="space-y-3">
        {insights.map((row) => (
          <li key={row.id}>
            <div className="flex gap-3">
              <InsightIcon tone={row.tone} />
              <p className="min-w-0 text-sm leading-snug text-gray-700 dark:text-zinc-300">
                <Link
                  href={`/trips/${row.tripId}`}
                  className="font-semibold text-gray-900 underline-offset-2 hover:underline dark:text-zinc-50"
                >
                  {row.tripName}
                </Link>
                <span className="text-gray-300 dark:text-zinc-600" aria-hidden>
                  {" "}
                  —{" "}
                </span>
                <span className={toneMessage[row.tone]}>{row.message}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
