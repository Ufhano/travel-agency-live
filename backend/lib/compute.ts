import type { AppData } from "./app-data";
import type {
  Client,
  ClientPaymentStatus,
  DashboardInsight,
  KeyOperationalInsight,
  Payment,
  PaymentWithContext,
  Trip,
  TripAggregate,
} from "./types";

export type TripCompute = {
  getPaymentById(paymentId: string): Payment | undefined;
  getTrip(tripId: string): Trip | undefined;
  getClient(clientId: string): Client | undefined;
  getClientsOnTrip(tripId: string): Client[];
  paymentsForClient(clientId: string): Payment[];
  totalPaidForClient(clientId: string): number;
  balanceForClient(client: Client): number;
  clientPaymentStatus(client: Client): ClientPaymentStatus;
  enrichPayment(payment: Payment): PaymentWithContext | undefined;
  allPaymentsEnriched(): PaymentWithContext[];
  transportAndPlanning(
    trip: Trip,
    headcount: number,
  ): { transportSuggestion: string; planningHeadline: string };
  aggregateTrip(tripId: string): TripAggregate | undefined;
  dashboardSummary(): {
    totalTrips: number;
    totalClients: number;
    totalInvoiced: number;
    /** Sum of booked package totals across trips (excluding empty departures). */
    totalAmountToBePaid: number;
    totalCollected: number;
    totalOutstanding: number;
    tripAggregates: TripAggregate[];
  };
  buildInsights(): DashboardInsight[];
  buildKeyOperationalInsights(max?: number): KeyOperationalInsight[];
  displayTripStatus(trip: Trip, agg: TripAggregate): string;
};

export function createCompute(data: AppData): TripCompute {
  const { trips, clients, payments } = data;
  const asOfDate = new Date().toISOString().slice(0, 10);

  function getPaymentById(paymentId: string): Payment | undefined {
    return payments.find((p) => p.id === paymentId);
  }

  function getTrip(tripId: string): Trip | undefined {
    return trips.find((t) => t.id === tripId);
  }

  function getClient(clientId: string): Client | undefined {
    return clients.find((c) => c.id === clientId);
  }

  function getClientsOnTrip(tripId: string): Client[] {
    return clients.filter((c) => c.tripId === tripId);
  }

  function paymentsForClient(clientId: string): Payment[] {
    return payments
      .filter((p) => p.clientId === clientId)
      .sort(
        (a, b) =>
          new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
      );
  }

  function totalPaidForClient(clientId: string): number {
    return paymentsForClient(clientId).reduce((s, p) => s + p.amount, 0);
  }

  function balanceForClient(client: Client): number {
    return Math.max(0, client.packagePrice - totalPaidForClient(client.id));
  }

  function clientPaymentStatus(client: Client): ClientPaymentStatus {
    const paid = totalPaidForClient(client.id);
    const bal = balanceForClient(client);
    if (bal <= 0) return "Paid in Full";
    if (client.balanceDueDate < asOfDate && bal > 0) return "Overdue";
    if (paid <= 0) return "Partial Payment";
    if (paid < client.packagePrice * 0.35) return "Deposit Paid";
    return "Partial Payment";
  }

  function enrichPayment(
    payment: Payment,
  ): PaymentWithContext | undefined {
    const client = getClient(payment.clientId);
    const trip = getTrip(payment.tripId);
    if (!client || !trip) return undefined;

    const ordered = paymentsForClient(payment.clientId);
    let cumulative = 0;
    let totalPaidAfter = 0;
    let balanceAfter = client.packagePrice;
    for (const p of ordered) {
      cumulative += p.amount;
      if (p.id === payment.id) {
        totalPaidAfter = cumulative;
        balanceAfter = Math.max(0, client.packagePrice - cumulative);
        break;
      }
    }

    return {
      ...payment,
      client,
      trip,
      totalPaidAfter,
      balanceAfter,
    };
  }

  function allPaymentsEnriched(): PaymentWithContext[] {
    return payments
      .map((p) => enrichPayment(p))
      .filter((x): x is PaymentWithContext => x != null)
      .sort(
        (a, b) =>
          new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
      );
  }

  function transportAndPlanning(trip: Trip, headcount: number): {
    transportSuggestion: string;
    planningHeadline: string;
  } {
    const cap = trip.capacity;
    const ratio = headcount / cap;
    if (headcount <= 0) {
      return {
        transportSuggestion: "No bookings yet — hold large vehicle deposits.",
        planningHeadline: "Confirm marketing push before locking bulk costs.",
      };
    }
    if (ratio < 0.35) {
      return {
        transportSuggestion:
          "Minibus or 14-seater H1 — avoid coach deposits until fill improves.",
        planningHeadline:
          "Low headcount: delay large accommodation blocks; re-assess in 2 weeks.",
      };
    }
    if (ratio < 0.65) {
      return {
        transportSuggestion:
          "Standard tour coach or two H1s — keep option on larger coach.",
        planningHeadline:
          "Moderate fill: provisional rooming list; confirm transport 6–8 weeks out.",
      };
    }
    return {
      transportSuggestion:
        "Full-size coach or confirmed large vehicle — secure accommodation now.",
      planningHeadline:
        "Strong fill: finalize accommodation and transport; watch last seats for margin.",
    };
  }

  function aggregateTrip(tripId: string): TripAggregate | undefined {
    const trip = getTrip(tripId);
    if (!trip) return undefined;
    const tripClients = getClientsOnTrip(tripId);
    const confirmedCount = tripClients.length;
    const totalExpectedRevenue = tripClients.reduce(
      (s, c) => s + c.packagePrice,
      0,
    );
    const totalPaid = tripClients.reduce(
      (s, c) => s + totalPaidForClient(c.id),
      0,
    );
    const outstanding = Math.max(0, totalExpectedRevenue - totalPaid);
    const fillRatio = trip.capacity > 0 ? confirmedCount / trip.capacity : 0;
    const { transportSuggestion, planningHeadline } = transportAndPlanning(
      trip,
      confirmedCount,
    );
    return {
      trip,
      clients: tripClients,
      confirmedCount,
      totalExpectedRevenue,
      totalPaid,
      outstanding,
      fillRatio,
      transportSuggestion,
      planningHeadline,
    };
  }

  function dashboardSummary() {
    const tripList = trips.map((t) => aggregateTrip(t.id)!);
    const totalTrips = trips.length;
    const totalClients = clients.length;
    const totalInvoiced = payments.reduce((s, p) => s + p.amount, 0);
    const totalAmountToBePaid = tripList.reduce(
      (s, t) => s + t.totalExpectedRevenue,
      0,
    );
    const totalCollected = tripList.reduce((s, t) => s + t.totalPaid, 0);
    const totalOutstanding = tripList.reduce((s, t) => s + t.outstanding, 0);
    return {
      totalTrips,
      totalClients,
      totalInvoiced,
      totalAmountToBePaid,
      totalCollected,
      totalOutstanding,
      tripAggregates: tripList,
    };
  }

  function buildInsights(): DashboardInsight[] {
    const out: DashboardInsight[] = [];
    for (const t of trips) {
      const agg = aggregateTrip(t.id)!;
      if (agg.fillRatio < 0.4 && agg.trip.departureDate > asOfDate) {
        out.push({
          tripId: t.id,
          type: "under-filled",
          label: `${t.name}: light load (${Math.round(agg.fillRatio * 100)}% full) — delay big accommodation commits`,
        });
      }
      if (agg.fillRatio >= 0.85) {
        out.push({
          tripId: t.id,
          type: "near-capacity",
          label: `${t.name}: almost full (${agg.confirmedCount}/${t.capacity}) — lock coach & rooms`,
        });
      }
      const overdueClients = agg.clients.filter(
        (c) =>
          balanceForClient(c) > 0 &&
          c.balanceDueDate < asOfDate,
      );
      if (overdueClients.length > 0) {
        out.push({
          tripId: t.id,
          type: "overdue-balance",
          label: `${t.name}: ${overdueClients.length} traveller(s) past balance date — follow up`,
        });
      }
    }
    return out;
  }

  const KEY_INSIGHTS_MAX = 4;

  function buildKeyOperationalInsights(
    max = KEY_INSIGHTS_MAX,
  ): KeyOperationalInsight[] {
    const overdueRows: KeyOperationalInsight[] = [];
    const nearRows: KeyOperationalInsight[] = [];
    const underRows: KeyOperationalInsight[] = [];

    for (const t of trips) {
      const agg = aggregateTrip(t.id)!;

      const overdueClients = agg.clients.filter(
        (c) =>
          balanceForClient(c) > 0 &&
          c.balanceDueDate < asOfDate,
      );
      if (overdueClients.length > 0) {
        overdueRows.push({
          id: `overdue-${t.id}`,
          tripId: t.id,
          tripName: t.name,
          message: `${overdueClients.length} overdue. Follow up balances.`,
          tone: "red",
        });
      }

      if (agg.fillRatio >= 0.85) {
        nearRows.push({
          id: `near-${t.id}`,
          tripId: t.id,
          tripName: t.name,
          message: "Near capacity. Confirm accommodation & transport.",
          tone: "amber",
        });
      }

      if (agg.fillRatio < 0.4 && agg.trip.departureDate > asOfDate) {
        underRows.push({
          id: `under-${t.id}`,
          tripId: t.id,
          tripName: t.name,
          message: "Low bookings. Delay major accommodation commitments.",
          tone: "amber",
        });
      }
    }

    const merged = [...overdueRows, ...nearRows, ...underRows];
    return merged.slice(0, max);
  }

  function displayTripStatus(trip: Trip, agg: TripAggregate): string {
    if (trip.status === "Closed") return "Closed";
    if (agg.fillRatio < 0.35 && trip.departureDate > asOfDate) {
      return "Under-filled";
    }
    if (agg.fillRatio >= 0.85 && trip.status !== "Draft") {
      return "Filling Fast";
    }
    return trip.status;
  }

  return {
    getPaymentById,
    getTrip,
    getClient,
    getClientsOnTrip,
    paymentsForClient,
    totalPaidForClient,
    balanceForClient,
    clientPaymentStatus,
    enrichPayment,
    allPaymentsEnriched,
    transportAndPlanning,
    aggregateTrip,
    dashboardSummary,
    buildInsights,
    buildKeyOperationalInsights,
    displayTripStatus,
  };
}
