-- Phase 1: Workout Service Schema Redesign

-- Seed 3 courses
INSERT INTO courses (name, slug, description) VALUES
  ('Hypertrophy', 'hypertrophy', 'Build maximum muscle mass through progressive volume training'),
  ('Strength',    'strength',    'Develop raw strength and power with compound movements'),
  ('Endurance',   'endurance',   'Improve cardiovascular fitness and muscular endurance')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Extend user_courses table
ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '[]';
ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS video_access_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS goals TEXT DEFAULT '';
ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS injuries TEXT DEFAULT '';

-- Create user_assigned_weeks table
CREATE TABLE IF NOT EXISTS user_assigned_weeks (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    course_id   INTEGER NOT NULL REFERENCES courses(id),
    week_number INTEGER NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, course_id, week_number)
);

-- Create user_assigned_days table
CREATE TABLE IF NOT EXISTS user_assigned_days (
    id           SERIAL PRIMARY KEY,
    assigned_week_id INTEGER NOT NULL REFERENCES user_assigned_weeks(id) ON DELETE CASCADE,
    day_number   INTEGER NOT NULL,
    title        TEXT NOT NULL DEFAULT '',
    is_rest_day  BOOLEAN NOT NULL DEFAULT FALSE,
    admin_notes  TEXT NOT NULL DEFAULT '',
    UNIQUE (assigned_week_id, day_number)
);

-- Create user_assigned_exercises table
CREATE TABLE IF NOT EXISTS user_assigned_exercises (
    id              SERIAL PRIMARY KEY,
    assigned_day_id INTEGER NOT NULL REFERENCES user_assigned_days(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    sets            INTEGER NOT NULL DEFAULT 3,
    reps            TEXT NOT NULL DEFAULT '10',
    weight          TEXT NOT NULL DEFAULT 'bodyweight',
    video_url       TEXT NOT NULL DEFAULT '',
    target          TEXT NOT NULL DEFAULT '',
    equipment_needed TEXT NOT NULL DEFAULT 'bodyweight',
    order_index     INTEGER NOT NULL DEFAULT 0
);

-- Create user_day_feedback table
CREATE TABLE IF NOT EXISTS user_day_feedback (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL,
    assigned_day_id INTEGER NOT NULL REFERENCES user_assigned_days(id) ON DELETE CASCADE,
    admin_feedback  TEXT NOT NULL DEFAULT '',
    user_notes      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, assigned_day_id)
);

-- Add equipment_needed field to shared exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment_needed TEXT NOT NULL DEFAULT 'bodyweight';

-- Alter user_day_progress to allow custom assigned day tracking
ALTER TABLE user_day_progress ADD COLUMN IF NOT EXISTS assigned_day_id INTEGER REFERENCES user_assigned_days(id) ON DELETE CASCADE;
ALTER TABLE user_day_progress ALTER COLUMN week_day_id DROP NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_day_progress_user_id_assigned_day_id_key') THEN
        ALTER TABLE user_day_progress ADD CONSTRAINT user_day_progress_user_id_assigned_day_id_key UNIQUE (user_id, assigned_day_id);
    END IF;
END;
$$;


