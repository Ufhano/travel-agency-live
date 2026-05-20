"use client";

import * as React from "react";
import Link from "next/link";
import { Banknote, ChevronDown, PiggyBank, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatZAR } from "@/lib/utils";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Drives paid amount and ring progress on one timeline, from 0 on mount. */
function useSynchronizedCountUp(
  paid: number,
  progress: number,
  duration = 2200,
): { paid: number; progress: number; containerRef: React.RefObject<HTMLDivElement | null> } {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [values, setValues] = React.useState({ paid: 0, progress: 0 });

  React.useEffect(() => {
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setValues({ paid, progress });
      return;
    }

    setValues({ paid: 0, progress: 0 });

    let frame = 0;
    let start: number | null = null;
    let cancelled = false;

    const step = (timestamp: number) => {
      if (cancelled) return;
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(t);
      setValues({ paid: paid * eased, progress: progress * eased });
      if (t < 1) frame = requestAnimationFrame(step);
    };

    const node = containerRef.current;
    if (!node) return;

    const run = () => {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(step);
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          run();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      observer.disconnect();
      run();
    }

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [paid, progress, duration]);

  return { ...values, containerRef };
}

function PaymentProgressRing({
  paid,
  total,
  outstanding,
  asOfLabel,
}: {
  paid: number;
  total: number;
  outstanding: number;
  asOfLabel: string;
}) {
  const size = 340;
  const stroke = 15;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcRatio = 0.86;
  const arcLength = circumference * arcRatio;

  const progress = total > 0 ? Math.min(paid / total, 1) : 0;
  const { paid: animatedPaid, progress: animatedProgress, containerRef } =
    useSynchronizedCountUp(paid, progress);
  const displayPaid = Math.round(animatedPaid);

  const progressLength = arcLength * animatedProgress;
  const gradientId = React.useId();

  return (
    <div
      ref={containerRef}
      className="relative mx-auto flex h-[360px] w-[360px] items-center justify-center"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-[100deg]"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="45%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${progressLength} ${circumference - progressLength}`}
          filter={`url(#${gradientId}-glow)`}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-[11px] font-medium backdrop-blur-sm">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-300" />
          <span>{asOfLabel}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl lg:text-6xl">
            {formatZAR(displayPaid)}
          </span>
          {outstanding > 0 ? (
            <span className="rounded-full bg-teal-400/20 px-2 py-0.5 text-xs font-semibold text-teal-200">
              −{formatZAR(outstanding)}
            </span>
          ) : null}
        </div>

        <p className="mt-1 text-sm text-white/70">
          paid out of {formatZAR(total)}
        </p>

        <Button
          asChild
          size="sm"
          className="mt-5 gap-1.5 rounded-full bg-teal-300/90 px-5 text-teal-950 hover:bg-teal-200"
        >
          <Link href="#departures">
            View departures
            <ChevronDown className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function DashboardPaymentHero({
  paid,
  total,
  outstanding,
  tripCount,
  asOfDay,
  className,
}: {
  paid: number;
  total: number;
  outstanding: number;
  tripCount: number;
  asOfDay: string;
  className?: string;
}) {
  const percentPaid = total > 0 ? Math.round((paid / total) * 100) : 0;
  const tripLabel = tripCount === 1 ? "1 departure" : `${tripCount} departures`;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl",
        className,
      )}
    >
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-900/75 to-teal-950/80 backdrop-blur-[2px]" />

      <div className="relative z-10 flex flex-col gap-8 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:py-12">
        <div className="max-w-lg text-white">
          <p className="text-lg font-medium text-white/80 sm:text-xl">Welcome,</p>
          <h2 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Payment overview
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/65 sm:text-base">
            Across {tripLabel}, travellers have paid{" "}
            <span className="font-semibold text-teal-200">{percentPaid}%</span> of booked
            package value. Track collections and outstanding balances from one place.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <PiggyBank className="h-4 w-4 text-teal-300" />
              <span>
                <span className="font-semibold">{formatZAR(paid)}</span> collected
              </span>
            </div>
            {outstanding > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1.5 text-amber-100">
                <Banknote className="h-4 w-4" />
                <span>
                  <span className="font-semibold">{formatZAR(outstanding)}</span> still to
                  collect
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-emerald-100">
                <span className="font-semibold">All packages settled</span>
              </div>
            )}
          </div>
        </div>

        <PaymentProgressRing
          paid={paid}
          total={total}
          outstanding={outstanding}
          asOfLabel={`Balances as at ${asOfDay}`}
        />
      </div>
    </section>
  );
}
