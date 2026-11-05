-- Cloudflare D1 schema. Apply to a private D1 database; do not commit patient data.
CREATE TABLE IF NOT EXISTS appointments (
 id TEXT PRIMARY KEY,
 appointment_date TEXT NOT NULL,
 appointment_time TEXT NOT NULL,
 full_name TEXT NOT NULL,
 phone TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_slot ON appointments(appointment_date,appointment_time) WHERE status IN ('pending','confirmed');
CREATE INDEX IF NOT EXISTS idx_appointment_date ON appointments(appointment_date);

-- Admin authentication: only SHA-256 hashes of session tokens and IPs are stored.
-- These tables are also created automatically on the first admin login.
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_login_attempts (
 ip_hash TEXT PRIMARY KEY,
 failures INTEGER NOT NULL,
 window_start INTEGER NOT NULL,
 blocked_until INTEGER NOT NULL DEFAULT 0
);

-- Public booking tracking: a rate-limit counter, not patient information.
-- The tracking endpoint also creates this table on its first request.
CREATE TABLE IF NOT EXISTS tracking_attempts (
 ip_hash TEXT PRIMARY KEY,
 window_start INTEGER NOT NULL,
 attempts INTEGER NOT NULL
);
