-- Migration 004: Add TTS configuration fields to alerts table
-- Phase 2, Task 2.9: Text-to-speech for donation/tip messages

ALTER TABLE alerts ADD COLUMN tts_voice TEXT DEFAULT NULL;
ALTER TABLE alerts ADD COLUMN tts_rate REAL DEFAULT 1.0;
ALTER TABLE alerts ADD COLUMN tts_pitch REAL DEFAULT 1.0;
ALTER TABLE alerts ADD COLUMN tts_volume REAL DEFAULT 1.0;
