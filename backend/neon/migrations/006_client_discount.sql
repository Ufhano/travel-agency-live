-- Manual per-client discount (ZAR) subtracted from the package price.
-- Run in the Neon SQL editor after 005_group_booking_proof.sql.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS discount INTEGER NOT NULL DEFAULT 0;
