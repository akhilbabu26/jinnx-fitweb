-- Phase 1: Subscription Service Schema Extensions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_plan_id TEXT DEFAULT '';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT DEFAULT '';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
