-- Video Service Schema

CREATE TABLE IF NOT EXISTS video_sessions (
    id           SERIAL PRIMARY KEY,
    admin_id     INTEGER NOT NULL DEFAULT 1,
    user_id      INTEGER NOT NULL,
    livekit_room TEXT NOT NULL,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_video_sessions_user
    ON video_sessions (user_id, started_at DESC);
