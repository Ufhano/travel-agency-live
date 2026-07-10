-- Public booking one-pager + Yoco checkout pipeline.
-- Apply: npm run db:migrate -- backend/neon/migrations/007_public_booking.sql

ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS public_package_price INTEGER;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS gallery_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS booking_status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS yoco_checkout_id TEXT;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS external_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_external_ref
  ON payments (external_ref)
  WHERE external_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_yoco_checkout_id
  ON clients (yoco_checkout_id)
  WHERE yoco_checkout_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS yoco_webhook_events (
  id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
