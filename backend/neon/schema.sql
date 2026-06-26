-- Run in the Neon SQL editor (or psql) once per branch.
-- To clear all rows: npm run db:wipe (requires DATABASE_URL; see frontend/.env.example).
-- For existing databases, also run: backend/neon/migrations/002_auth_tenants.sql

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_users_tenant ON app_users (tenant_id);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL,
  accommodation_note TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trips_tenant ON trips (tenant_id);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  id_number TEXT,
  package_price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  balance_due_date DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_trip ON clients (trip_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients (tenant_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments (tenant_id);

CREATE TABLE IF NOT EXISTS group_bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  total_amount INTEGER NOT NULL,
  paid_at DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_bookings_ref_tenant
  ON group_bookings (tenant_id, reference_number);

CREATE INDEX IF NOT EXISTS idx_group_bookings_tenant ON group_bookings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_group_bookings_trip ON group_bookings (trip_id);

CREATE TABLE IF NOT EXISTS group_booking_passengers (
  id TEXT PRIMARY KEY,
  group_booking_id TEXT NOT NULL REFERENCES group_bookings (id) ON DELETE CASCADE,
  passenger_name TEXT NOT NULL,
  passenger_email TEXT NOT NULL,
  amount INTEGER NOT NULL,
  paid_status TEXT NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_booking_passengers_booking
  ON group_booking_passengers (group_booking_id);

CREATE TABLE IF NOT EXISTS group_booking_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  group_booking_id TEXT NOT NULL REFERENCES group_bookings (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_data BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_booking_documents_booking
  ON group_booking_documents (group_booking_id);

CREATE INDEX IF NOT EXISTS idx_group_booking_documents_tenant
  ON group_booking_documents (tenant_id);
