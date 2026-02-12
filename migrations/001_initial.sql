-- ============================================================================
-- Migration 001: Initial Schema (Phase 1)
--
-- Retroactive migration capturing the original Phase 1 database schema.
-- Uses IF NOT EXISTS so this is safe to run against existing databases
-- that were created before the migration system was introduced.
-- ============================================================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  message_template TEXT,
  duration_ms INTEGER DEFAULT 5000,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
