-- Group booking proof of payment + paid date; remove currency column.
-- Run in the Neon SQL editor after 004_group_bookings.sql.

ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS paid_at DATE;

UPDATE group_bookings
SET paid_at = (created_at AT TIME ZONE 'UTC')::date
WHERE paid_at IS NULL;

ALTER TABLE group_bookings DROP COLUMN IF EXISTS currency;

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
