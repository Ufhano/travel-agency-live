import Image from "next/image";
import Link from "next/link";

import { PublicBookingForm } from "@/components/public-booking-form";
import { getSql } from "@backend/db";
import { getFeaturedTrip } from "@backend/public-booking";
import { getPublicTenantId } from "@backend/public-config";
import { formatTripDates, formatZAR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const tenantId = getPublicTenantId();
  const sql = getSql();

  if (!tenantId || !sql) {
    return (
      <PublicBookShell>
        <Unavailable message="Public booking is not configured yet. Set PUBLIC_TENANT_ID and DATABASE_URL in frontend/.env.local." />
      </PublicBookShell>
    );
  }

  const trip = await getFeaturedTrip(sql, tenantId);

  if (!trip) {
    return (
      <PublicBookShell>
        <Unavailable message="No trip is open for booking. In the admin app, set a trip to Open, add a public package price, and mark it as featured (or use the soonest upcoming Open departure)." />
      </PublicBookShell>
    );
  }

  const images = [
    ...(trip.heroImageUrl ? [trip.heroImageUrl] : []),
    ...trip.galleryUrls.filter((u) => u !== trip.heroImageUrl),
  ];

  return (
    <PublicBookShell>
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-primary uppercase tracking-wide">
              Featured departure
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {trip.name}
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">{trip.destination}</p>
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Dates</dt>
              <dd className="font-semibold">
                {formatTripDates(trip.departureDate, trip.returnDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Package price</dt>
              <dd className="font-semibold">{formatZAR(trip.publicPackagePrice)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Capacity</dt>
              <dd className="font-semibold">{trip.capacity} travellers</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-semibold">{trip.status}</dd>
            </div>
          </dl>

          {trip.accommodationNote ? (
            <section className="prose prose-sm max-w-none">
              <h2 className="text-lg font-semibold not-prose">Itinerary &amp; notes</h2>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {trip.accommodationNote}
              </p>
            </section>
          ) : null}

          {images.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Gallery</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {images.map((src) => (
                  <div
                    key={src}
                    className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl border bg-muted flex items-center justify-center">
              <Image
                src="/nendila-logo.png"
                alt="Nendila Travel"
                width={120}
                height={120}
                className="opacity-40"
              />
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-8">
          <PublicBookingForm
            tripId={trip.id}
            tripName={trip.name}
            packagePrice={trip.publicPackagePrice}
          />
        </div>
      </div>
    </PublicBookShell>
  );
}

function PublicBookShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image src="/nendila-logo.png" alt="" width={40} height={40} />
          <span className="font-semibold text-lg">Nendila Travel &amp; Explorers</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Staff login
        </Link>
      </header>
      {children}
      <footer className="mt-16 border-t pt-6 text-center text-xs text-muted-foreground">
        Secure payments powered by Yoco. Questions? Reply to your confirmation email.
      </footer>
    </div>
  );
}

function Unavailable({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <h1 className="text-lg font-semibold">Booking unavailable</h1>
      <p className="mt-2 text-sm">{message}</p>
    </div>
  );
}
