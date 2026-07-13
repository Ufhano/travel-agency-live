-- Group split: per-person package price, cumulative amount_paid, follow-up payments.
-- Run after 007_public_booking.sql.

ALTER TABLE group_booking_passengers
  ADD COLUMN IF NOT EXISTS package_price INTEGER;

ALTER TABLE group_booking_passengers
  ADD COLUMN IF NOT EXISTS amount_paid INTEGER NOT NULL DEFAULT 0;

-- Backfill: package defaults to allocation; amount_paid = initial share + follow-ups.
UPDATE group_booking_passengers gbp
SET
  package_price = COALESCE(gbp.package_price, gbp.amount),
  amount_paid = gbp.amount + COALESCE((
    SELECT SUM(p.amount)::int
    FROM group_booking_passenger_payments p
    WHERE p.passenger_id = gbp.id
  ), 0);

UPDATE group_bookings gb
SET status = CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM group_booking_passengers gbp
    WHERE gbp.group_booking_id = gb.id
  ) THEN 'Pending'
  WHEN NOT EXISTS (
    SELECT 1 FROM group_booking_passengers gbp
    WHERE gbp.group_booking_id = gb.id
      AND COALESCE(gbp.package_price, gbp.amount) > COALESCE(gbp.amount_paid, 0)
  ) THEN 'Complete'
  WHEN EXISTS (
    SELECT 1 FROM group_booking_passengers gbp
    WHERE gbp.group_booking_id = gb.id
      AND COALESCE(gbp.amount_paid, 0) > 0
  ) THEN 'Partial'
  ELSE 'Pending'
END;

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
