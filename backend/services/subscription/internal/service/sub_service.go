package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/akhilbabu26/jinnx/services/subscription/internal/repository"
)

type SubscriptionService struct {
	repo              *repository.SubscriptionRepository
	razorpayKeyID     string
	razorpayKeySecret string
	razorpayPlanID    string
	webhookSecret     string
}

func New(
	repo *repository.SubscriptionRepository,
	keyID, keySecret, planID, webhookSecret string,
) *SubscriptionService {
	return &SubscriptionService{
		repo:              repo,
		razorpayKeyID:     keyID,
		razorpayKeySecret: keySecret,
		razorpayPlanID:    planID,
		webhookSecret:     webhookSecret,
	}
}

type SubscriptionStatus struct {
	Sub      *repository.Subscription
	IsActive bool
}

func (s *SubscriptionService) GetSubscription(ctx context.Context, userID uint) (*SubscriptionStatus, error) {
	sub, err := s.repo.FindByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &SubscriptionStatus{
				Sub:      &repository.Subscription{Status: "trial"},
				IsActive: false,
			}, nil
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	now := time.Now()
	// Auto-expire trial
	if sub.Status == "trial" && sub.CurrentPeriodEnd.Valid && now.After(sub.CurrentPeriodEnd.Time) {
		sub.Status = "cancelled"
		_ = s.repo.UpdateStatus(ctx, sub.ID, "cancelled")
	}

	isActive := false
	switch sub.Status {
	case "active":
		isActive = true
	case "trial", "past_due", "cancelled":
		if sub.CurrentPeriodEnd.Valid && now.Before(sub.CurrentPeriodEnd.Time) {
			isActive = true
		}
	}

	return &SubscriptionStatus{Sub: sub, IsActive: isActive}, nil
}

type RazorpayCheckout struct {
	SubscriptionID string
	KeyID          string
}

func (s *SubscriptionService) CreateRazorpaySubscription(ctx context.Context, userID uint) (*RazorpayCheckout, error) {
	sub, err := s.repo.FindByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			trialEnd := time.Now().AddDate(0, 0, 7)
			if _, err := s.repo.Create(ctx, userID, "trial", trialEnd); err != nil {
				return nil, fmt.Errorf("failed to initialize subscription: %w", err)
			}
			sub = &repository.Subscription{
				Status:           "trial",
				CurrentPeriodEnd: sql.NullTime{Time: trialEnd, Valid: true},
			}
		} else {
			return nil, fmt.Errorf("database error: %w", err)
		}
	}

	requestData := map[string]interface{}{
		"plan_id":         s.razorpayPlanID,
		"total_count":     12,
		"quantity":        1,
		"customer_notify": 1,
	}

	bodyBytes, err := json.Marshal(requestData)
	if err != nil {
		return nil, fmt.Errorf("marshal failed: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.razorpay.com/v1/subscriptions", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("request creation failed: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.SetBasicAuth(s.razorpayKeyID, s.razorpayKeySecret)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("razorpay call failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("razorpay returned code %d: %s", resp.StatusCode, string(respBytes))
	}

	var razorpayResp struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&razorpayResp); err != nil {
		return nil, fmt.Errorf("decode failed: %w", err)
	}

	if err := s.repo.UpdateRazorpaySubID(ctx, userID, razorpayResp.ID, sub.Status); err != nil {
		return nil, fmt.Errorf("failed to update subscription ID: %w", err)
	}

	return &RazorpayCheckout{
		SubscriptionID: razorpayResp.ID,
		KeyID:          s.razorpayKeyID,
	}, nil
}

func (s *SubscriptionService) HandleWebhook(ctx context.Context, payload []byte, signature string) error {
	if !s.verifySignature(payload, signature) {
		return errors.New("invalid webhook signature")
	}

	var webhookBody struct {
		Event   string                 `json:"event"`
		Payload map[string]interface{} `json:"payload"`
	}
	if err := json.Unmarshal(payload, &webhookBody); err != nil {
		return fmt.Errorf("failed to decode payload: %w", err)
	}

	var targetStatus string
	switch webhookBody.Event {
	case "subscription.charged":
		targetStatus = "active"
	case "subscription.cancelled":
		targetStatus = "cancelled"
	case "subscription.halted":
		targetStatus = "past_due"
	default:
		return nil // unhandled event — OK
	}

	subMap, ok := webhookBody.Payload["subscription"].(map[string]interface{})
	if !ok {
		return errors.New("missing subscription key in payload")
	}
	entityMap, ok := subMap["entity"].(map[string]interface{})
	if !ok {
		return errors.New("missing entity key in payload")
	}
	razorpaySubID, ok := entityMap["id"].(string)
	if !ok || razorpaySubID == "" {
		return errors.New("missing subscription id in payload")
	}

	periodEnd := time.Now().AddDate(0, 0, 30)
	if v, ok := entityMap["current_end"].(float64); ok {
		periodEnd = time.Unix(int64(v), 0)
	}

	return s.repo.UpdateByRazorpaySubID(ctx, razorpaySubID, targetStatus, periodEnd)
}

func (s *SubscriptionService) verifySignature(payload []byte, signature string) bool {
	h := hmac.New(sha256.New, []byte(s.webhookSecret))
	h.Write(payload)
	expected := hex.EncodeToString(h.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}
