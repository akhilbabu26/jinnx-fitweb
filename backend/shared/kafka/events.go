package kafka

import (
	"time"
)

const TopicEvents = "jinnx.events"

type EventType string

const (
	EventDayCompleted EventType = "day_completed"
	EventPlanUpdated EventType = "plan_updated"
	EventTrialExpiring EventType = "trial_expiring"
	EventSignupPending EventType = "signup_pending"
	EventSubscriptionCharged EventType = "subscription_charged"
	EventSubscriptionCancelled EventType = "subscription_cancelled"
)

type Event struct{
	Type EventType `json:"type"`
	ActorID uint `json:"actor_id"`
	TargetID uint `json:"target_id,omitempty"`
	Payload map[string]any `json:"payload"`
	Timestamp time.Time `json:"timestamp"`
}