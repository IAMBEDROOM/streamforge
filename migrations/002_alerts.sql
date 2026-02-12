-- ============================================================================
-- Migration 002: Alert System (Phase 2)
--
-- Expands the alerts table with full customisation fields (animations, sound,
-- styling, etc.) and creates the alert_variations table for conditional
-- alert variants (e.g. different alerts per sub tier or bit threshold).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Expand alerts table with new columns
-- ---------------------------------------------------------------------------

ALTER TABLE alerts ADD COLUMN animation_in TEXT DEFAULT 'fadeIn';
ALTER TABLE alerts ADD COLUMN animation_out TEXT DEFAULT 'fadeOut';
ALTER TABLE alerts ADD COLUMN sound_path TEXT DEFAULT NULL;
ALTER TABLE alerts ADD COLUMN sound_volume REAL DEFAULT 0.8;
ALTER TABLE alerts ADD COLUMN image_path TEXT DEFAULT NULL;
ALTER TABLE alerts ADD COLUMN font_family TEXT DEFAULT 'Arial';
ALTER TABLE alerts ADD COLUMN font_size INTEGER DEFAULT 24;
ALTER TABLE alerts ADD COLUMN text_color TEXT DEFAULT '#FFFFFF';
ALTER TABLE alerts ADD COLUMN bg_color TEXT DEFAULT NULL;
ALTER TABLE alerts ADD COLUMN custom_css TEXT DEFAULT NULL;
ALTER TABLE alerts ADD COLUMN min_amount INTEGER DEFAULT NULL;
ALTER TABLE alerts ADD COLUMN tts_enabled INTEGER DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Create alert_variations table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS alert_variations (
  id TEXT PRIMARY KEY,
  parent_alert_id TEXT NOT NULL,
  name TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  condition_value TEXT NOT NULL,
  message_template TEXT DEFAULT NULL,
  sound_path TEXT DEFAULT NULL,
  sound_volume REAL DEFAULT NULL,
  image_path TEXT DEFAULT NULL,
  animation_in TEXT DEFAULT NULL,
  animation_out TEXT DEFAULT NULL,
  custom_css TEXT DEFAULT NULL,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Indexes for frequently queried fields
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_enabled ON alerts(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_variations_parent_id ON alert_variations(parent_alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_variations_enabled ON alert_variations(enabled);

-- ---------------------------------------------------------------------------
-- Update existing follow alert with new column defaults
-- ---------------------------------------------------------------------------

UPDATE alerts SET
  animation_in = 'fadeIn',
  animation_out = 'fadeOut',
  sound_volume = 0.8,
  font_family = 'Arial',
  font_size = 24,
  text_color = '#FFFFFF',
  tts_enabled = 0
WHERE type = 'follow';

-- ---------------------------------------------------------------------------
-- Seed default alerts for remaining types (follow already exists from 001)
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO alerts (
  id, type, name, enabled, message_template, duration_ms,
  animation_in, animation_out, sound_volume, font_family, font_size,
  text_color, tts_enabled, created_at, updated_at
) VALUES
  -- Follow alert (may already exist from Phase 1 seed — OR IGNORE handles that)
  (
    'default-follow-alert', 'follow', 'New Follower Alert', 1,
    '{username} just followed!', 5000,
    'fadeIn', 'fadeOut', 0.8, 'Arial', 24,
    '#FFFFFF', 0,
    datetime('now'), datetime('now')
  ),
  -- Subscribe alert
  (
    'default-subscribe-alert', 'subscribe', 'New Subscriber Alert', 1,
    '{username} just subscribed!', 5000,
    'fadeIn', 'fadeOut', 0.8, 'Arial', 24,
    '#FFFFFF', 0,
    datetime('now'), datetime('now')
  ),
  -- Cheer alert
  (
    'default-cheer-alert', 'cheer', 'New Cheer Alert', 1,
    '{username} cheered {amount} bits!', 5000,
    'fadeIn', 'fadeOut', 0.8, 'Arial', 24,
    '#FFFFFF', 0,
    datetime('now'), datetime('now')
  ),
  -- Raid alert
  (
    'default-raid-alert', 'raid', 'Raid Alert', 1,
    '{username} is raiding with {amount} viewers!', 5000,
    'fadeIn', 'fadeOut', 0.8, 'Arial', 24,
    '#FFFFFF', 0,
    datetime('now'), datetime('now')
  );
