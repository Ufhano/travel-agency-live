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
  /** Last day of the trip. Null when the departure is a single day. */
  returnDate: string | null;
  capacity: number;
  /** Base workflow status from operations (some badges are computed separately). */
  status: TripStatus;
  accommodationNote: string;
  /**
   * Default package price in ZAR for this departure.
   * Used as a hint when adding travellers / group splits, and for public booking.
   */
  packagePrice: number | null;
}

export interface Client {
  id: string;
  tripId: string;
  fullName: string;
  phone: string;
  email: string;
  /** National ID / passport number — optional, entered manually. */
  idNumber: string | null;
  packagePrice: number;
  /** Manual discount in ZAR subtracted from the package price (defaults to 0). */
  discount: number;
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

export type GroupBookingStatus = "Pending" | "Partial" | "Complete";

/** @deprecated Use amountPaid vs packagePrice instead. */
export type PassengerPaidStatus = "unpaid" | "paid";

export interface GroupBooking {
  id: string;
  referenceNumber: string;
  tripId: string;
  totalAmount: number;
  /** ISO date — when the group payment was received. */
  paidAt: string;
  status: GroupBookingStatus;
  createdAt: string;
  /** Original filename of uploaded proof PDF. */
  proofFileName?: string;
}

export interface GroupBookingPassenger {
  id: string;
  groupBookingId: string;
  passengerName: string;
  passengerEmail: string;
  /** Share of the group lump-sum payment credited to this passenger. */
  allocatedAmount: number;
  /** Full trip package price for this passenger. */
  packagePrice: number;
  /** Cumulative amount paid (includes initial allocation). */
  amountPaid: number;
  createdAt: string;
}

export interface GroupBookingPassengerPayment {
  id: string;
  passengerId: string;
  amount: number;
  paidAt: string;
  note?: string;
  createdAt: string;
  proofFileName?: string;
}

export interface GroupBookingWithPassengers extends GroupBooking {
  tripName: string;
  tripDestination: string;
  passengers: GroupBookingPassenger[];
}

export interface GroupBookingListItem extends GroupBooking {
  tripName: string;
  passengerCount: number;
  /** Package per person × passenger count (expected group total). */
  totalExpected: number;
  /** Sum of passenger amountPaid. */
  totalPaid: number;
}

/** Group-split passenger shown on a trip departure page. */
export interface TripGroupSplitPassenger {
  id: string;
  groupBookingId: string;
  referenceNumber: string;
  passengerName: string;
  passengerEmail: string;
  /** Optional contact phone. */
  passengerPhone: string;
  /** Optional national ID / passport. */
  passengerIdNumber: string | null;
  packagePrice: number;
  amountPaid: number;
}

/** Group-split passenger with trip context for the Clients directory. */
export interface TenantGroupSplitPassenger extends TripGroupSplitPassenger {
  tripId: string;
  tripName: string;
  tripDestination: string;
  departureDate: string;
}
