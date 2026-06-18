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
	"github.com/akhilbabu26/jinnx/shared/kafka"
	"github.com/akhilbabu26/jinnx/shared/mailer"

	"github.com/akhilbabu26/jinnx/services/auth/internal/repository"
)

type AuthService struct {
	repo          *repository.AuthRepository
	mailer        *mailer.Mailer
	secret        string
	redisClient   *cache.RedisClient
	kafka         *kafka.Producer // nil if Kafka unavailable
	jwtExpiry     time.Duration
	refreshExpiry time.Duration
}

// New creates an AuthService. Pass nil redisClient or kafkaProducer to run without them.
func New(
	repo *repository.AuthRepository,
	m *mailer.Mailer,
	jwtSecret string,
	redisClient *cache.RedisClient,
	kafkaProducer *kafka.Producer,
	jwtExpiry, refreshExpiry time.Duration,
) *AuthService {
	return &AuthService{
		repo:          repo,
		mailer:        m,
		secret:        jwtSecret,
		redisClient:   redisClient,
		kafka:         kafkaProducer,
		jwtExpiry:     jwtExpiry,
		refreshExpiry: refreshExpiry,
	}
}

type RegisterResult struct {
	UserID  uint
	Status  repository.UserStatus
	Message string
}

func (s *AuthService) Register(ctx context.Context, email, name, password string) (*RegisterResult, error) {
	existing, err := s.repo.FindUserByEmail(ctx, email)
	if err == nil {
		if existing.Status == repository.StatusPendingOTP {
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
	if s.redisClient != nil {
		hashedCode := hash.Token(code)
		if err := s.redisClient.SetOTP(ctx, email, hashedCode); err != nil {
			return nil, fmt.Errorf("failed to store OTP in cache: %w", err)
		}
	} else {
		return nil, errors.New("OTP service unavailable")
	}

	log.Printf("[Register] OTP code %s generated for %s\n", code, email)
	if err := s.mailer.SendOTP(ctx, email, code); err != nil {
		log.Printf("[Register] error sending OTP to %s: %v\n", email, err)
	}

	return &RegisterResult{
		UserID:  userID,
		Status:  repository.StatusPendingOTP,
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

	if user.Status != repository.StatusApproved {
		switch user.Status {
		case repository.StatusPendingOTP:
			return nil, errors.New("please verify your email first")
		case repository.StatusPendingApproval:
			return nil, errors.New("your account is pending trainer approval")
		case repository.StatusRejected:
			return nil, errors.New("your account has been rejected, contact the trainer")
		case repository.StatusBlocked:
			return nil, errors.New("your account has been suspended, contact the trainer")
		}
	}

	if !hash.CheckPassword(password, user.Password) {
		return nil, errors.New("invalid credentials")
	}

	tokenPair, err := jwt.GenerateTokenPair(user.ID, user.Email, string(user.Role), s.secret, s.jwtExpiry, s.refreshExpiry)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// Revoke all previous refresh tokens before issuing a new one (single-session semantics)
	if err := s.repo.RevokeAllRefreshTokensForUser(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("failed to revoke old tokens: %w", err)
	}

	tokenHash := hash.Token(tokenPair.RefreshToken)
	if err := s.repo.CreateRefreshToken(ctx, user.ID, tokenHash, time.Now().Add(s.refreshExpiry)); err != nil {
		return nil, fmt.Errorf("failed to save refresh token: %w", err)
	}

	return &LoginResult{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		UserID:       user.ID,
		Role:         string(user.Role),
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
func (s *AuthService) UpdateUserStatus(ctx context.Context, userID uint, status repository.UserStatus) error {
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

func (s *AuthService) VerifyOTP(ctx context.Context, email, code string) (bool, error) {
	if s.redisClient == nil {
		return false, errors.New("OTP service unavailable")
	}

	storedHash, err := s.redisClient.GetOTP(ctx, email)
	if err != nil {
		if errors.Is(err, cache.ErrCacheMiss) {
			return false, errors.New("OTP expired or not found")
		}
		return false, fmt.Errorf("failed to retrieve OTP: %w", err)
	}

	if !hash.CheckToken(code, storedHash) {
		return false, errors.New("invalid OTP")
	}

	// Consume OTP immediately
	_ = s.redisClient.DeleteOTP(ctx, email)

	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		return false, fmt.Errorf("user not found: %w", err)
	}

	if user.Status != repository.StatusPendingOTP {
		return false, errors.New("user is already verified or not pending verification")
	}

	if err := s.UpdateUserStatus(ctx, user.ID, repository.StatusPendingApproval); err != nil {
		return false, fmt.Errorf("failed to update user status: %w", err)
	}

	// Notify the trainer/admin of the new registration pending approval
	if err := s.mailer.SendAdminNotification(ctx, user.Name, user.Email); err != nil {
		log.Printf("[VerifyOTP] warning: failed to send admin approval notification for %s (%s): %v\n", user.Name, user.Email, err)
	} else {
		log.Printf("[VerifyOTP] Admin approval notification sent for %s (%s)\n", user.Name, user.Email)
	}

	// Publish real-time event → admin WebSocket gets notified instantly
	if s.kafka != nil {
		_ = s.kafka.Publish(ctx, kafka.Event{
			Type:    kafka.EventSignupPending,
			ActorID: user.ID,
			Payload: map[string]any{
				"name":  user.Name,
				"email": user.Email,
			},
		})
	}

	return true, nil
}

func (s *AuthService) ForgotPassword(ctx context.Context, email string) error {
	_, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("user not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	code := generateOTP()
	if s.redisClient != nil {
		hashedCode := hash.Token(code)
		if err := s.redisClient.SetResetOTP(ctx, email, hashedCode); err != nil {
			return fmt.Errorf("failed to store reset OTP in cache: %w", err)
		}
	} else {
		return errors.New("OTP service unavailable")
	}

	log.Printf("[ForgotPassword] Reset OTP code %s generated for %s\n", code, email)
	if err := s.mailer.SendResetPasswordOTP(ctx, email, code); err != nil {
		log.Printf("[ForgotPassword] warning: failed to send reset OTP email to %s: %v\n", email, err)
	}

	return nil
}

func (s *AuthService) ResetPassword(ctx context.Context, email, code, newPassword string) error {
	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("user not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	if s.redisClient == nil {
		return errors.New("OTP service unavailable")
	}

	storedHash, err := s.redisClient.GetResetOTP(ctx, email)
	if err != nil {
		if errors.Is(err, cache.ErrCacheMiss) {
			return errors.New("reset OTP expired or not found")
		}
		return fmt.Errorf("failed to retrieve reset OTP: %w", err)
	}

	if !hash.CheckToken(code, storedHash) {
		return errors.New("invalid reset OTP")
	}

	// Consume reset OTP immediately
	_ = s.redisClient.DeleteResetOTP(ctx, email)

	hashedPassword, err := hash.Password(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	if err := s.repo.UpdateUserPassword(ctx, user.ID, hashedPassword); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	log.Printf("[ResetPassword] Password successfully reset for user %s\n", email)
	return nil
}

// ── Admin methods ─────────────────────────────────────────────────────────────

func (s *AuthService) validateAdminAction(ctx context.Context, adminID, targetUserID uint) (*repository.User, error) {
	if adminID == targetUserID {
		return nil, errors.New("admin cannot perform this action on themselves")
	}

	targetUser, err := s.repo.FindUserByID(ctx, targetUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch target user: %w", err)
	}

	if targetUser.Role == repository.RoleAdmin {
		return nil, errors.New("admin cannot perform this action on another admin")
	}

	return targetUser, nil
}

func (s *AuthService) ListPendingUsers(ctx context.Context) ([]repository.User, error) {
	users, err := s.repo.ListPendingUsers(ctx)
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	return users, nil
}

func (s *AuthService) ListAllUsers(ctx context.Context) ([]repository.User, error) {
	users, err := s.repo.ListAllUsers(ctx)
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	return users, nil
}

func (s *AuthService) ApproveUser(ctx context.Context, adminID, userID uint) error {
	user, err := s.validateAdminAction(ctx, adminID, userID)
	if err != nil {
		return err
	}

	if err := s.UpdateUserStatus(ctx, userID, repository.StatusApproved); err != nil {
		return err
	}

	if err := s.mailer.SendApprovalNotification(ctx, user.Email, user.Name); err != nil {
		log.Printf("[Admin] warning: failed to send approval email to %s: %v\n", user.Email, err)
	} else {
		log.Printf("[Admin] Approval email sent to %s (%s)\n", user.Name, user.Email)
	}

	log.Printf("[Admin] User %d approved by admin %d\n", userID, adminID)
	return nil
}

func (s *AuthService) RejectUser(ctx context.Context, adminID, userID uint) error {
	user, err := s.validateAdminAction(ctx, adminID, userID)
	if err != nil {
		return err
	}

	if err := s.UpdateUserStatus(ctx, userID, repository.StatusRejected); err != nil {
		return err
	}

	if err := s.mailer.SendRejectionNotification(ctx, user.Email, user.Name); err != nil {
		log.Printf("[Admin] warning: failed to send rejection email to %s: %v\n", user.Email, err)
	} else {
		log.Printf("[Admin] Rejection email sent to %s (%s)\n", user.Name, user.Email)
	}

	log.Printf("[Admin] User %d rejected by admin %d\n", userID, adminID)
	return nil
}

func (s *AuthService) ReApproveUser(ctx context.Context, adminID, userID uint) error {
	_, err := s.validateAdminAction(ctx, adminID, userID)
	if err != nil {
		return err
	}

	if err := s.UpdateUserStatus(ctx, userID, repository.StatusPendingApproval); err != nil {
		return err
	}

	log.Printf("[Admin] User %d reset to pending_approval by admin %d\n", userID, adminID)
	return nil
}


func (s *AuthService) BlockUser(ctx context.Context, adminID, userID uint) error {
	_, err := s.validateAdminAction(ctx, adminID, userID)
	if err != nil {
		return err
	}

	if err := s.UpdateUserStatus(ctx, userID, repository.StatusBlocked); err != nil {
		return err
	}

	// Revoke all refresh tokens so the user is forced out immediately
	if err := s.repo.RevokeAllRefreshTokensForUser(ctx, userID); err != nil {
		log.Printf("[Admin] warning: failed to revoke tokens for blocked user %d: %v\n", userID, err)
	}

	log.Printf("[Admin] User %d blocked by admin %d\n", userID, adminID)
	return nil
}

func (s *AuthService) UnblockUser(ctx context.Context, adminID, userID uint) error {
	_, err := s.validateAdminAction(ctx, adminID, userID)
	if err != nil {
		return err
	}

	// Unblocking restores them to approved status
	if err := s.UpdateUserStatus(ctx, userID, repository.StatusApproved); err != nil {
		return err
	}

	log.Printf("[Admin] User %d unblocked by admin %d\n", userID, adminID)
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

func (s *AuthService) AssignTask(ctx context.Context, adminID, userID uint, title, description string, dueDateStr string) (uint, error) {
	var dueDate time.Time
	var err error
	if dueDateStr != "" {
		dueDate, err = time.Parse(time.RFC3339, dueDateStr)
		if err != nil {
			return 0, fmt.Errorf("invalid due date format: %w", err)
		}
	}
	return s.repo.CreateTask(ctx, adminID, userID, title, description, dueDate)
}

func (s *AuthService) DeleteTask(ctx context.Context, taskID uint) error {
	rows, err := s.repo.DeleteTask(ctx, taskID)
	if err != nil {
		return fmt.Errorf("database error: %w", err)
	}
	if rows == 0 {
		return errors.New("task not found")
	}
	return nil
}

func (s *AuthService) ResendOTP(ctx context.Context, email string) error {
	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("user not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	if user.Status != repository.StatusPendingOTP {
		return errors.New("user is already verified or not pending verification")
	}

	if s.redisClient == nil {
		return errors.New("OTP service unavailable")
	}

	// Delete previously sent OTP from Redis
	if err := s.redisClient.DeleteOTP(ctx, email); err != nil {
		// Log the error but don't block the resend flow, just in case it wasn't set or already expired
		log.Printf("[ResendOTP] warning: failed to delete old OTP for %s: %v\n", email, err)
	} else {
		log.Printf("[ResendOTP] Deleted old OTP from Redis for %s\n", email)
	}

	// Generate and send new OTP
	code := generateOTP()
	hashedCode := hash.Token(code)
	if err := s.redisClient.SetOTP(ctx, email, hashedCode); err != nil {
		return fmt.Errorf("failed to store new OTP in cache: %w", err)
	}

	log.Printf("[ResendOTP] New OTP code %s generated for %s\n", code, email)
	if err := s.mailer.SendOTP(ctx, email, code); err != nil {
		log.Printf("[ResendOTP] error sending new OTP to %s: %v\n", email, err)
	}

	return nil
}