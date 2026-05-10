import type { Client, Payment, Trip } from "./types";

/** In-memory fallback when `DATABASE_URL` is unset — empty by default. */
export const trips: Trip[] = [];
export const clients: Client[] = [];
export const payments: Payment[] = [];
