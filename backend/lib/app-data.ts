import type { Client, Payment, Trip } from "./types";

export type AppData = {
  trips: Trip[];
  clients: Client[];
  payments: Payment[];
  /** Per-tenant invoice "Terms and Conditions" lines (defaults applied upstream). */
  invoiceTerms: string[];
};
