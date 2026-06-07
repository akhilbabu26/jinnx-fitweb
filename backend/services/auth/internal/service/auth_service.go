package service

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/shared/hash"
	"github.com/akhilbabu26/jinnx/shared/jwt"
	"github.com/akhilbabu26/jinnx/shared/mailer"

	"github.com/akhilbabu26/jinnx/services/auth/internal/repository"
)

type AuthService struct {
	repo        *repository.AuthRepository
	mailer      *mailer.Mailer
	secret      string
	redisClient *cache.RedisClient // nil if Redis is not available
}

// New creates an AuthService. Pass a nil redisClient to run without caching.
func New(repo *repository.AuthRepository, m *mailer.Mailer, jwtSecret string, redisClient *cache.RedisClient) *AuthService {
	return &AuthService{repo: repo, mailer: m, secret: jwtSecret, redisClient: redisClient}
}

type RegisterResult struct {
	UserID  uint
	Status  string
	Message string
}

func (s *AuthService) Register(ctx context.Context, email, name, password string) (*RegisterResult, error) {
	existing, err := s.repo.FindUserByEmail(ctx, email)
	if err == nil {
		if existing.Status == "pending_otp" {
			_ = s.repo.DeleteUserByID(ctx, existing.ID)
		} else {
			return nil, errors.New("email already registered")
		}
	}

	hashedPassword, err := hash.Password(password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	userID, err := s.repo.CreateUser(ctx, email, name, hashedPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	code := generateOTP()
	_ = s.repo.DeleteUnusedOTPs(ctx, email)
	if err := s.repo.CreateOTP(ctx, email, code, time.Now().Add(10*time.Minute)); err != nil {
		return nil, fmt.Errorf("failed to create OTP: %w", err)
	}

	log.Printf("[Register] OTP dispatched to %s\n", email)
	_ = s.mailer.SendOTP(ctx, email, code)

	return &RegisterResult{
		UserID:  userID,
		Status:  "pending_otp",
		Message: "OTP sent to your email. Please verify to continue.",
	}, nil
}

type LoginResult struct {
	AccessToken  string
	RefreshToken string
	UserID       uint
	Role         string
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*LoginResult, error) {
	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("invalid credentials")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	if user.Status != "approved" {
		switch user.Status {
		case "pending_otp":
			return nil, errors.New("please verify your email first")
		case "pending_approval":
			return nil, errors.New("your account is pending trainer approval")
		case "rejected":
			return nil, errors.New("your account has been rejected, contact the trainer")
		}
	}

	if !hash.CheckPassword(password, user.Password) {
		return nil, errors.New("invalid credentials")
	}

	tokenPair, err := jwt.GenerateTokenPair(user.ID, user.Email, user.Role, s.secret)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// Revoke all previous refresh tokens before issuing a new one (single-session semantics)
	if err := s.repo.RevokeAllRefreshTokensForUser(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("failed to revoke old tokens: %w", err)
	}

	tokenHash := hash.Token(tokenPair.RefreshToken)
	if err := s.repo.CreateRefreshToken(ctx, user.ID, tokenHash, time.Now().Add(7*24*time.Hour)); err != nil {
		return nil, fmt.Errorf("failed to save refresh token: %w", err)
	}

	return &LoginResult{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		UserID:       user.ID,
		Role:         user.Role,
	}, nil
}

func (s *AuthService) GetUserProfile(ctx context.Context, userID uint) (*repository.User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}
	return user, nil
}

func (s *AuthService) GetTrainerTasks(ctx context.Context, userID uint) ([]repository.AssignedTask, error) {
	return s.repo.GetTasksByUserID(ctx, userID)
}

func (s *AuthService) MarkTaskCompleted(ctx context.Context, taskID, userID uint) error {
	rows, err := s.repo.MarkTaskCompleted(ctx, taskID, userID)
	if err != nil {
		return fmt.Errorf("database error: %w", err)
	}
	if rows == 0 {
		return errors.New("task not found or does not belong to user")
	}
	return nil
}

// UpdateUserStatus changes a user's status (e.g. "approved", "rejected") and
// actively invalidates their Redis cache entry so the gateway sees the change
// on the very next request rather than waiting for TTL expiry.
func (s *AuthService) UpdateUserStatus(ctx context.Context, userID uint, status string) error {
	if err := s.repo.UpdateUserStatus(ctx, userID, status); err != nil {
		return fmt.Errorf("failed to update user status: %w", err)
	}

	// Active cache invalidation — delete the gateway's cached profile for this user
	if s.redisClient != nil {
		key := cache.UserProfileKey(uint32(userID))
		if err := s.redisClient.Delete(ctx, key); err != nil {
			// Non-fatal: log the miss but don't fail the operation.
			// The 5-min TTL will expire the stale entry automatically.
			log.Printf("[cache] warning: failed to invalidate profile for user %d: %v\n", userID, err)
		} else {
			log.Printf("[cache] invalidated profile cache for user %d (status → %s)\n", userID, status)
		}
	}

	return nil
}

func generateOTP() string {
	max := big.NewInt(1000000)
	num, err := rand.Int(rand.Reader, max)
	if err != nil {
		return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}
	return fmt.Sprintf("%06d", num.Uint64())
}
