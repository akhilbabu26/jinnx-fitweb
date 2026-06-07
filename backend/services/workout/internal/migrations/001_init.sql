-- Workout Service Schema

CREATE TABLE IF NOT EXISTS courses (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS user_courses (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL,
    course_id       INTEGER NOT NULL REFERENCES courses(id),
    onboarding_data JSONB,
    level           TEXT NOT NULL DEFAULT 'beginner',
    status          TEXT NOT NULL DEFAULT 'active',
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS weeks (
    id          SERIAL PRIMARY KEY,
    course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    level       TEXT NOT NULL DEFAULT 'beginner',
    week_number INTEGER NOT NULL,
    title       TEXT NOT NULL,
    UNIQUE (course_id, level, week_number)
);

CREATE TABLE IF NOT EXISTS week_days (
    id         SERIAL PRIMARY KEY,
    week_id    INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    title      TEXT NOT NULL,
    is_rest_day BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (week_id, day_number)
);

CREATE TABLE IF NOT EXISTS exercises (
    id          SERIAL PRIMARY KEY,
    week_day_id INTEGER NOT NULL REFERENCES week_days(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    sets        INTEGER NOT NULL DEFAULT 3,
    reps        TEXT NOT NULL DEFAULT '10',
    weight      TEXT NOT NULL DEFAULT 'bodyweight',
    video       TEXT NOT NULL DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_day_progress (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL,
    week_day_id  INTEGER NOT NULL REFERENCES week_days(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, week_day_id)
);
