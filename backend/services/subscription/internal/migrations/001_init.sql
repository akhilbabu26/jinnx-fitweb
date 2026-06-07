-- Subscription Service Schema

CREATE TABLE IF NOT EXISTS subscriptions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL UNIQUE,
    razorpay_sub_id     TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'trial',
    current_period_end  TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
