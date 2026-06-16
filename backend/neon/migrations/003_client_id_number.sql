-- Run in the Neon SQL editor (idempotent).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_number TEXT;
