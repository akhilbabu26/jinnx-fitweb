package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"
)

type Subscription struct {
	ID               uint         `db:"id"`
	UserID           uint         `db:"user_id"`
	RazorpaySubID    string       `db:"razorpay_sub_id"`
	Status           string       `db:"status"`
	CurrentPeriodEnd sql.NullTime `db:"current_period_end"`
	CreatedAt        time.Time    `db:"created_at"`
	UpdatedAt        time.Time    `db:"updated_at"`
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

func (r *SubscriptionRepository) Create(ctx context.Context, userID uint, status string, periodEnd time.Time) (uint, error) {
	var id uint
	query := `INSERT INTO subscriptions (user_id, status, current_period_end)
	          VALUES ($1, $2, $3) RETURNING id`
	err := r.db.QueryRowContext(ctx, query, userID, status, periodEnd).Scan(&id)
	return id, err
}

func (r *SubscriptionRepository) UpdateStatus(ctx context.Context, id uint, status string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2",
		status, id,
	)
	return err
}

func (r *SubscriptionRepository) UpdateRazorpaySubID(ctx context.Context, userID uint, razorpaySubID, status string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE subscriptions SET razorpay_sub_id = $1, status = $2, updated_at = NOW() WHERE user_id = $3",
		razorpaySubID, status, userID,
	)
	return err
}

func (r *SubscriptionRepository) UpdateByRazorpaySubID(ctx context.Context, razorpaySubID, status string, periodEnd time.Time) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE subscriptions SET status = $1, current_period_end = $2, updated_at = NOW() WHERE razorpay_sub_id = $3",
		status, periodEnd, razorpaySubID,
	)
	return err
}
