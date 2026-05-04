import type { Client, Payment, Trip } from "./types";

export type AppData = {
  trips: Trip[];
  clients: Client[];
  payments: Payment[];
};
