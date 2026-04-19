# Nendila Travel Explorers Demo

## What this demo is for

This is a **non-production** internal preview for **Nendila Travel Explorers**. It helps business partners **see the value of moving off manual trip and payment tracking**—phone notes, overwritten invoice templates, and guesswork on headcounts—before you invest in pricing and implementation discussions.

The app shows a single **operations-style dashboard**: live-style visibility into departures, who has paid what, balances still due, and **one invoice record per payment** so history is never erased.

## Problem it illustrates

- **Scattered payment notes** are easy to lose or misread, which leads to **missed collections** and revenue leakage.
- **Reusing one invoice document** for every payment **destroys history** and hurts trust with travellers.
- **No shared view of fill and balances** drives poor ops decisions—locking large accommodation or the wrong vehicle when counts and cash don’t match reality.

This UI supports a clear story: **centralized departures + immutable receipts per payment + balances at a glance**.

## How to run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The trip operations dashboard is the home page.

```bash
npm run build && npm start
```

Use this to rehearse in production mode before a stakeholder session.

## What is real vs mocked

| Area | Behavior |
|------|----------|
| **Data** | 100% **seeded mock data** in `src/lib/data.ts` (trips, clients, payments). |
| **Persistence** | **None** — refresh resets to seed; no database. |
| **Auth / users** | **None** — open internal demo. |
| **Payments & PDF** | **Mock** — “Save as PDF” uses the browser print dialog; no gateway or PDF API. |
| **APIs** | **None** — calculations run in `src/lib/compute.ts` on the server. |

Seeded trips include **Namibia, Victoria Falls, Cape Town, Etosha, and Zanzibar** with mixed deposits, partial payments, and balances. Capacities are set so at least one departure reads as **nearing capacity** and others as **under-filled**, with **overdue balances** evaluated against demo date **19 Apr 2026**.

## Tech stack

- Next.js (App Router), TypeScript, Tailwind CSS  
- UI patterns inspired by shadcn/ui (local components under `src/components/ui`)  
- Charts: Recharts (dashboard only)

## Main routes

| Route | Purpose |
|-------|---------|
| `/` | Trip operations dashboard — KPIs, signals, departures, chart |
| `/trips/[tripId]` | Departure detail — pax, transport hint, lodging note, travellers |
| `/clients` | Traveller directory |
| `/clients/[clientId]` | Profile + receipt timeline (links to invoices) |
| `/invoices` | Invoice ledger — one row per payment |
| `/invoices/[paymentId]` | Print-ready receipt for **one payment** (unique invoice #) |

---

*Branding: **Nendila Travel Explorers** — internal operations demo only.*
