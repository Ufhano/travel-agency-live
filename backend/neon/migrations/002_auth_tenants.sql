-- Run after schema.sql in Neon SQL editor (idempotent).

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

ALTER TABLE trips ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants (id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants (id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trips_tenant ON trips (tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments (tenant_id);
