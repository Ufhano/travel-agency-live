export type TripStatus =
  | "Draft"
  | "Open"
  | "Filling Fast"
  | "Under-filled"
  | "Confirmed"
  | "Closed";

export type ClientPaymentStatus =
  | "Deposit Paid"
  | "Partial Payment"
  | "Paid in Full"
  | "Overdue";

export interface Trip {
  id: string;
  name: string;
  destination: string;
  departureDate: string;
  capacity: number;
  /** Base workflow status from operations (some badges are computed separately). */
  status: TripStatus;
  accommodationNote: string;
}

export interface Client {
  id: string;
  tripId: string;
  fullName: string;
  phone: string;
  email: string;
  packagePrice: number;
  /** ISO date — balance considered overdue after this if not paid in full. */
  balanceDueDate: string;
}

/** One payment = one immutable invoice record (INV-…). */
export interface Payment {
  id: string;
  invoiceNumber: string;
  clientId: string;
  tripId: string;
  amount: number;
  paidAt: string;
  method: string;
  note?: string;
}

export interface ClientWithTrip extends Client {
  trip: Trip;
}

export interface PaymentWithContext extends Payment {
  client: Client;
  trip: Trip;
  totalPaidAfter: number;
  balanceAfter: number;
}

export interface TripAggregate {
  trip: Trip;
  clients: Client[];
  confirmedCount: number;
  totalExpectedRevenue: number;
  totalPaid: number;
  outstanding: number;
  fillRatio: number;
  transportSuggestion: string;
  planningHeadline: string;
}

export interface DashboardInsight {
  tripId: string;
  type: "under-filled" | "overdue-balance" | "near-capacity";
  label: string;
}

/** Display row for the dashboard “Key Operational Insights” strip (max 4). */
export interface KeyOperationalInsight {
  id: string;
  tripId: string;
  tripName: string;
  message: string;
  tone: "amber" | "red" | "green";
}
