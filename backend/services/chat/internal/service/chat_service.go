package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	workoutv1 "github.com/akhilbabu26/jinnx/proto/workout/v1"
	"github.com/akhilbabu26/jinnx/services/chat/internal/repository"
)

type ChatService struct {
	repo          *repository.ChatRepository
	workoutClient workoutv1.WorkoutServiceClient
	anthropicKey  string
	dailyLimit    int
	maxHistory    int
}

func New(
	repo *repository.ChatRepository,
	workoutClient workoutv1.WorkoutServiceClient,
	anthropicKey string,
	dailyLimit, maxHistory int,
) *ChatService {
	if dailyLimit <= 0 {
		dailyLimit = 20
	}
	if maxHistory <= 0 {
		maxHistory = 10
	}
	return &ChatService{
		repo:          repo,
		workoutClient: workoutClient,
		anthropicKey:  anthropicKey,
		dailyLimit:    dailyLimit,
		maxHistory:    maxHistory,
	}
}

type ChatHistoryResult struct {
	Messages       []repository.ChatMessage
	RemainingLimit int
}

func (s *ChatService) GetChatHistory(ctx context.Context, userID uint) (*ChatHistoryResult, error) {
	msgs, err := s.repo.GetRecentMessages(ctx, userID, 50)
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Reverse to chronological order
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}

	dailyCount, _ := s.repo.CountTodayUserMessages(ctx, userID)
	remaining := s.dailyLimit - dailyCount
	if remaining < 0 {
		remaining = 0
	}

	return &ChatHistoryResult{Messages: msgs, RemainingLimit: remaining}, nil
}

type SendMessageResult struct {
	Reply          string
	RemainingLimit int
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
}

func (s *ChatService) SendMessage(ctx context.Context, userID uint, message string) (*SendMessageResult, error) {
	dailyCount, err := s.repo.CountTodayUserMessages(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("database error counting messages: %w", err)
	}

	if dailyCount >= s.dailyLimit {
		return nil, fmt.Errorf("daily limit of %d messages reached", s.dailyLimit)
	}

	// Build system prompt from enrolled course context
	systemPrompt := "You are a professional fitness coach for JINNX FITWEB. Answer training and nutritional questions professionally."
	if s.workoutClient != nil {
		enrollRes, err := s.workoutClient.GetEnrolledCourse(ctx, &workoutv1.GetEnrolledCourseRequest{
			UserId: uint32(userID),
		})
		if err == nil && enrollRes.IsEnrolled {
			systemPrompt = fmt.Sprintf(
				"You are a professional fitness coach for JINNX FITWEB. The client is currently enrolled in the %s program (%s). "+
					"Align all training advice, exercise alternatives, and nutritional guidance with this specific program profile.",
				enrollRes.Name, enrollRes.Slug,
			)
		}
	}

	// Fetch recent message history for context
	dbHistory, _ := s.repo.GetRecentMessages(ctx, userID, s.maxHistory)
	for i, j := 0, len(dbHistory)-1; i < j; i, j = i+1, j-1 {
		dbHistory[i], dbHistory[j] = dbHistory[j], dbHistory[i]
	}

	var anthMessages []anthropicMessage
	for _, m := range dbHistory {
		anthMessages = append(anthMessages, anthropicMessage{Role: m.Role, Content: m.Content})
	}
	anthMessages = append(anthMessages, anthropicMessage{Role: "user", Content: message})

	// Persist user message
	_ = s.repo.SaveMessage(ctx, userID, "user", message)

	// Call Anthropic Claude API
	reqPayload := anthropicRequest{
		Model:     "claude-3-5-sonnet-20241022",
		MaxTokens: 1024,
		System:    systemPrompt,
		Messages:  anthMessages,
	}
	reqBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, fmt.Errorf("marshal failed: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.anthropic.com/v1/messages", bytes.NewBuffer(reqBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", s.anthropicKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("claude API call failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("claude API returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var anthResp anthropicResponse
	if err := json.Unmarshal(respBytes, &anthResp); err != nil {
		return nil, fmt.Errorf("unmarshal failed: %w", err)
	}
	if len(anthResp.Content) == 0 {
		return nil, errors.New("claude returned empty content")
	}

	reply := anthResp.Content[0].Text
	_ = s.repo.SaveMessage(ctx, userID, "assistant", reply)

	remaining := s.dailyLimit - (dailyCount + 1)
	if remaining < 0 {
		remaining = 0
	}

	return &SendMessageResult{Reply: reply, RemainingLimit: remaining}, nil
}
