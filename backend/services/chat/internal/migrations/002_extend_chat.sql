-- Phase 1: Chat Service Schema Extensions
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS session_id TEXT NOT NULL DEFAULT '';
