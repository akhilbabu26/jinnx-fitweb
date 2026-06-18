package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"
)

type SubscriptionStatus string

const (
	StatusTrial     SubscriptionStatus = "trial"
	StatusActive    SubscriptionStatus = "active"
	StatusCancelled SubscriptionStatus = "cancelled"
	StatusPastDue   SubscriptionStatus = "past_due"
)

type WebhookEvent string

const (
	EventCharged   WebhookEvent = "subscription.charged"
	EventCancelled WebhookEvent = "subscription.cancelled"
	EventHalted    WebhookEvent = "subscription.halted"
)

type Subscription struct {
	ID                 uint               `db:"id"`
	UserID             uint               `db:"user_id"`
	RazorpaySubID      string             `db:"razorpay_sub_id"`
	Status             SubscriptionStatus `db:"status"`
	CurrentPeriodEnd   sql.NullTime `db:"current_period_end"`
	RazorpayPlanID     string       `db:"razorpay_plan_id"`
	RazorpayCustomerID string       `db:"razorpay_customer_id"`
	CancelledAt        sql.NullTime `db:"cancelled_at"`
	CreatedAt          time.Time    `db:"created_at"`
	UpdatedAt          time.Time    `db:"updated_at"`
}

type SubscriptionRepository struct {
	db *sqlx.DB
}

func New(db *sqlx.DB) *SubscriptionRepository {
	return &SubscriptionRepository{db: db}
}

func (r *SubscriptionRepository) FindByUserID(ctx context.Context, userID uint) (*Subscription, error) {
	var sub Subscription
	err := r.db.GetContext(ctx, &sub, "SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1", userID)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *SubscriptionRepository) FindByRazorpaySubID(ctx context.Context, razorpaySubID string) (*Subscription, error) {
	var sub Subscription
	err := r.db.GetContext(ctx, &sub, "SELECT * FROM subscriptions WHERE razorpay_sub_id = $1 LIMIT 1", razorpaySubID)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *SubscriptionRepository) Create(ctx context.Context, userID uint, status SubscriptionStatus, periodEnd time.Time) (uint, error) {
	var id uint
	query := `INSERT INTO subscriptions (user_id, status, current_period_end)
	          VALUES ($1, $2, $3) RETURNING id`
	err := r.db.QueryRowContext(ctx, query, userID, string(status), periodEnd).Scan(&id)
	return id, err
}

func (r *SubscriptionRepository) UpdateStatus(ctx context.Context, id uint, status SubscriptionStatus) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2",
		string(status), id,
	)
	return err
}

func (r *SubscriptionRepository) UpdateRazorpaySubID(ctx context.Context, userID uint, razorpaySubID string, status SubscriptionStatus) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE subscriptions SET razorpay_sub_id = $1, status = $2, updated_at = NOW() WHERE user_id = $3",
		razorpaySubID, string(status), userID,
	)
	return err
}

func (r *SubscriptionRepository) UpdateByRazorpaySubID(ctx context.Context, razorpaySubID string, status SubscriptionStatus, periodEnd time.Time) error {
	var err error
	if status == StatusCancelled {
		_, err = r.db.ExecContext(ctx,
			"UPDATE subscriptions SET status = $1, current_period_end = $2, cancelled_at = NOW(), updated_at = NOW() WHERE razorpay_sub_id = $3",
			string(status), periodEnd, razorpaySubID,
		)
	} else {
		_, err = r.db.ExecContext(ctx,
			"UPDATE subscriptions SET status = $1, current_period_end = $2, updated_at = NOW() WHERE razorpay_sub_id = $3",
			string(status), periodEnd, razorpaySubID,
		)
	}
	return err
}
