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
