import type { Client, Payment, Trip } from "./types";
import type { InvoiceTermsConfig } from "./invoice-terms";

export type AppData = {
  trips: Trip[];
  clients: Client[];
  payments: Payment[];
  /** Per-tenant invoice terms (default + trip-specific sets). */
  invoiceTermsConfig: InvoiceTermsConfig;
};
