-- Group split: per-person package price, cumulative amount_paid, follow-up payments.
-- Run after 007_public_booking.sql.

ALTER TABLE group_booking_passengers
  ADD COLUMN IF NOT EXISTS package_price INTEGER;

ALTER TABLE group_booking_passengers
  ADD COLUMN IF NOT EXISTS amount_paid INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows: treat allocation as paid when marked paid, else zero.
UPDATE group_booking_passengers
SET
  package_price = COALESCE(package_price, amount),
  amount_paid = CASE
    WHEN paid_status = 'paid' THEN amount
    ELSE COALESCE(NULLIF(amount_paid, 0), 0)
  END
WHERE package_price IS NULL;

UPDATE group_booking_passengers
SET package_price = amount
WHERE package_price IS NULL;

CREATE TABLE IF NOT EXISTS group_booking_passenger_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  passenger_id TEXT NOT NULL REFERENCES group_booking_passengers (id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  paid_at DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gb_passenger_payments_passenger
  ON group_booking_passenger_payments (passenger_id);

CREATE INDEX IF NOT EXISTS idx_gb_passenger_payments_tenant
  ON group_booking_passenger_payments (tenant_id);

ALTER TABLE group_booking_documents
  ADD COLUMN IF NOT EXISTS passenger_payment_id TEXT
  REFERENCES group_booking_passenger_payments (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_group_booking_documents_payment
  ON group_booking_documents (passenger_payment_id);
