-- Group fare split: bulk payment split across passengers for one trip.
-- Run in the Neon SQL editor after schema.sql (and prior migrations).

CREATE TABLE IF NOT EXISTS group_bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  total_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
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
