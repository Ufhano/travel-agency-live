-- Run in the Neon SQL editor (or psql) once per branch.
-- To clear all rows: npm run db:wipe (requires DATABASE_URL; see frontend/.env.example).

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL,
  accommodation_note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  package_price INTEGER NOT NULL,
  balance_due_date DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_trip ON clients (trip_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  method TEXT NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_client ON payments (client_id);
CREATE INDEX IF NOT EXISTS idx_payments_trip ON payments (trip_id);
