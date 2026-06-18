-- Phase 1: Video Service Schema Extensions
ALTER TABLE video_sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
