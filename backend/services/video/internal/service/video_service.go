package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/livekit/protocol/auth"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	"github.com/akhilbabu26/jinnx/services/video/internal/repository"
)

type VideoService struct {
	repo             *repository.VideoRepository
	authClient       authv1.AuthServiceClient
	livekitAPIKey    string
	livekitAPISecret string
	livekitHost      string
}

func New(
	repo *repository.VideoRepository,
	authClient authv1.AuthServiceClient,
	livekitAPIKey, livekitAPISecret, livekitHost string,
) *VideoService {
	return &VideoService{
		repo:             repo,
		authClient:       authClient,
		livekitAPIKey:    livekitAPIKey,
		livekitAPISecret: livekitAPISecret,
		livekitHost:      livekitHost,
	}
}

type SessionTokenResult struct {
	Token      string
	LivekitURL string
}

func (s *VideoService) CreateSessionToken(ctx context.Context, userID uint, roomName string) (*SessionTokenResult, error) {
	// Fetch user profile via Auth service for display name
	userProfile, err := s.authClient.GetUserProfile(ctx, &authv1.GetUserProfileRequest{
		UserId: uint32(userID),
	})
	if err != nil {
		return nil, fmt.Errorf("user profile fetch failed: %w", err)
	}

	if roomName == "" {
		roomName = fmt.Sprintf("room_user_%d", userID)
	}

	// Ensure an active session record exists
	_, err = s.repo.FindActiveSession(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			if err := s.repo.CreateSession(ctx, userID, roomName); err != nil {
				return nil, fmt.Errorf("failed to create video session: %w", err)
			}
		} else {
			return nil, fmt.Errorf("database error: %w", err)
		}
	}

	identity := fmt.Sprintf("user_%d", userID)
	token, err := s.generateLivekitToken(roomName, identity, userProfile.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to generate LiveKit token: %w", err)
	}

	return &SessionTokenResult{
		Token:      token,
		LivekitURL: s.livekitHost,
	}, nil
}

func (s *VideoService) GetSessionList(ctx context.Context, userID uint) ([]repository.VideoSession, error) {
	sessions, err := s.repo.GetSessionsByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	return sessions, nil
}

func (s *VideoService) generateLivekitToken(roomName, identity, name string) (string, error) {
	if s.livekitAPIKey == "" || s.livekitAPISecret == "" {
		// Return a safe mock token in dev if LiveKit is not configured
		return "mock_livekit_token_for_" + name, nil
	}

	at := auth.NewAccessToken(s.livekitAPIKey, s.livekitAPISecret)
	grant := &auth.VideoGrant{
		RoomJoin: true,
		Room:     roomName,
	}

	at.SetVideoGrant(grant)
	at.SetIdentity(identity)
	at.SetName(name)
	at.SetValidFor(2 * time.Hour)

	return at.ToJWT()
}
