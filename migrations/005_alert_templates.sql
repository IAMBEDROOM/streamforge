-- 005_alert_templates.sql
-- Create the alert_templates table for reusable alert configurations.
-- Templates can be built-in (shipped with StreamForge) or user-created.

CREATE TABLE IF NOT EXISTS alert_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  author TEXT,
  template_data TEXT NOT NULL,
  is_builtin INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for separating built-in vs user templates quickly
CREATE INDEX idx_alert_templates_builtin ON alert_templates(is_builtin);

-- ---------------------------------------------------------------------------
-- Built-in templates — professional starting points that ship with StreamForge
-- ---------------------------------------------------------------------------

INSERT INTO alert_templates (id, name, description, author, template_data, is_builtin, created_at, updated_at) VALUES
(
  'builtin_follow_minimal',
  'Minimal Follow',
  'Simple, clean follower alert with fade animation',
  'StreamForge',
  '{"type":"follow","name":"New Follower","message_template":"{username} just followed!","duration_ms":4000,"animation_in":"fadeIn","animation_out":"fadeOut","sound_path":null,"sound_volume":0.8,"image_path":null,"font_family":"Poppins","font_size":42,"text_color":"#FFFFFF","bg_color":"rgba(0,0,0,0.85)","custom_css":"","min_amount":0,"tts_enabled":0}',
  1,
  datetime('now'),
  datetime('now')
),
(
  'builtin_sub_premium',
  'Premium Subscribe',
  'Bouncy, eye-catching subscription alert with purple theme',
  'StreamForge',
  '{"type":"subscribe","name":"New Subscriber","message_template":"Thanks for subscribing, {username}!","duration_ms":6000,"animation_in":"bounceIn","animation_out":"bounceOut","sound_path":null,"sound_volume":0.9,"image_path":null,"font_family":"Poppins","font_size":48,"text_color":"#FFFFFF","bg_color":"#6441A5","custom_css":"border: 3px solid #fff; box-shadow: 0 0 20px rgba(100,65,165,0.8);","min_amount":0,"tts_enabled":0}',
  1,
  datetime('now'),
  datetime('now')
),
(
  'builtin_cheer_gold',
  'Golden Cheer',
  'Shiny gold-themed alert for bit cheers',
  'StreamForge',
  '{"type":"cheer","name":"Bits Cheer","message_template":"{username} cheered {amount} bits!","duration_ms":5000,"animation_in":"popIn","animation_out":"popOut","sound_path":null,"sound_volume":0.85,"image_path":null,"font_family":"Poppins","font_size":44,"text_color":"#FFD700","bg_color":"rgba(0,0,0,0.9)","custom_css":"text-shadow: 0 0 10px #FFD700;","min_amount":0,"tts_enabled":0}',
  1,
  datetime('now'),
  datetime('now')
);
