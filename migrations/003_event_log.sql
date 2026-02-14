-- ============================================================================
-- Migration 003: Event Log (Phase 2 — Task 2.8)
--
-- Creates the event_log table for recording all alert events with full
-- context (platform, event type, user, amount, message). Supports
-- filtering by type/platform, date-range queries, and auto-pruning
-- of records older than 7 days.
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_log (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL DEFAULT 'internal',
  event_type    TEXT NOT NULL,
  username      TEXT NOT NULL,
  display_name  TEXT,
  amount        REAL DEFAULT NULL,
  message       TEXT DEFAULT NULL,
  metadata      TEXT DEFAULT '{}',
  alert_fired   INTEGER DEFAULT 0,
  timestamp     TEXT NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_event_log_event_type  ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_platform    ON event_log(platform);
CREATE INDEX IF NOT EXISTS idx_event_log_timestamp   ON event_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_log_alert_fired ON event_log(alert_fired);
CREATE INDEX IF NOT EXISTS idx_event_log_username    ON event_log(username);
