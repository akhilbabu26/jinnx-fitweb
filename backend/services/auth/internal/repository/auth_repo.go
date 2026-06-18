package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"
)

type UserRole string

const (
	RoleAdmin UserRole = "admin"
	RoleUser  UserRole = "user"
)

type UserStatus string

const (
	StatusPendingOTP      UserStatus = "pending_otp"
	StatusPendingApproval UserStatus = "pending_approval"
	StatusApproved        UserStatus = "approved"
	StatusRejected        UserStatus = "rejected"
	StatusBlocked         UserStatus = "blocked"
)

type User struct {
	ID        uint       `db:"id"`
	Email     string     `db:"email"`
	Name      string     `db:"name"`
	Password  string     `db:"password"`
	Role      UserRole   `db:"role"`
	Status    UserStatus `db:"status"`
	CreatedAt time.Time  `db:"created_at"`
	UpdatedAt time.Time  `db:"updated_at"`
}

type RefreshToken struct {
	ID        uint      `db:"id"`
	UserID    uint      `db:"user_id"`
	TokenHash string    `db:"token_hash"`
	ExpiresAt time.Time `db:"expires_at"`
	Revoked   bool      `db:"revoked"`
	CreatedAt time.Time `db:"created_at"`
}


type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusCompleted TaskStatus = "completed"
)

type AssignedTask struct {
	ID          uint         `db:"id"`
	AdminID     uint         `db:"admin_id"`
	UserID      uint         `db:"user_id"`
	Title       string       `db:"title"`
	Description string       `db:"description"`
	DueDate     sql.NullTime `db:"due_date"`
	Status      TaskStatus   `db:"status"`
	CreatedAt   time.Time    `db:"created_at"`
	UpdatedAt   time.Time    `db:"updated_at"`
}

// --- Repository ---

type AuthRepository struct {
	db *sqlx.DB
}

func New(db *sqlx.DB) *AuthRepository {
	return &AuthRepository{db: db}
}

func (r *AuthRepository) FindUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := r.db.GetContext(ctx, &u, "SELECT * FROM users WHERE email = $1 LIMIT 1", email)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *AuthRepository) FindUserByID(ctx context.Context, id uint) (*User, error) {
	var u User
	err := r.db.GetContext(ctx, &u, "SELECT * FROM users WHERE id = $1 LIMIT 1", id)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *AuthRepository) CreateUser(ctx context.Context, email, name, hashedPassword string) (uint, error) {
	var id uint
	query := `INSERT INTO users (email, name, password, role, status)
	          VALUES ($1, $2, $3, $4, $5) RETURNING id`
	err := r.db.QueryRowContext(ctx, query, email, name, hashedPassword, string(RoleUser), string(StatusPendingOTP)).Scan(&id)
	return id, err
}

func (r *AuthRepository) DeleteUserByID(ctx context.Context, id uint) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM users WHERE id = $1", id)
	return err
}

func (r *AuthRepository) UpdateUserStatus(ctx context.Context, id uint, status UserStatus) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2", string(status), id)
	return err
}


func (r *AuthRepository) CreateRefreshToken(ctx context.Context, userID uint, tokenHash string, expiresAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
		userID, tokenHash, expiresAt,
	)
	return err
}

// RevokeAllRefreshTokensForUser marks all active refresh tokens for a user as revoked.
// Call this before issuing a new token to enforce single-session semantics.
func (r *AuthRepository) RevokeAllRefreshTokensForUser(ctx context.Context, userID uint) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false",
		userID,
	)
	return err
}

func (r *AuthRepository) DeleteExpiredOrRevokedTokens(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true")
	return err
}

func (r *AuthRepository) GetTasksByUserID(ctx context.Context, userID uint) ([]AssignedTask, error) {
	var tasks []AssignedTask
	err := r.db.SelectContext(ctx, &tasks,
		"SELECT * FROM assigned_tasks WHERE user_id = $1 ORDER BY created_at DESC", userID)
	return tasks, err
}

func (r *AuthRepository) MarkTaskCompleted(ctx context.Context, taskID, userID uint) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		"UPDATE assigned_tasks SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
		string(TaskStatusCompleted), taskID, userID,
	)
	if err != nil {
		return 0, err
	}
	rows, _ := res.RowsAffected()
	return rows, nil
}

func (r *AuthRepository) UpdateUserPassword(ctx context.Context, id uint, hashedPassword string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2", hashedPassword, id)
	return err
}

func (r *AuthRepository) ListPendingUsers(ctx context.Context) ([]User, error) {
	var users []User
	err := r.db.SelectContext(ctx, &users,
		"SELECT * FROM users WHERE status = $1 ORDER BY created_at ASC", string(StatusPendingApproval))
	return users, err
}

func (r *AuthRepository) ListAllUsers(ctx context.Context) ([]User, error) {
	var users []User
	err := r.db.SelectContext(ctx, &users,
		"SELECT * FROM users WHERE role != $1 ORDER BY created_at ASC", string(RoleAdmin))
	return users, err
}

func (r *AuthRepository) CreateTask(ctx context.Context, adminID, userID uint, title, description string, dueDate time.Time) (uint, error) {
	var id uint
	var err error
	if !dueDate.IsZero() {
		err = r.db.QueryRowContext(ctx,
			"INSERT INTO assigned_tasks (admin_id, user_id, title, description, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING id",
			adminID, userID, title, description, dueDate,
		).Scan(&id)
	} else {
		err = r.db.QueryRowContext(ctx,
			"INSERT INTO assigned_tasks (admin_id, user_id, title, description, due_date) VALUES ($1, $2, $3, $4, NULL) RETURNING id",
			adminID, userID, title, description,
		).Scan(&id)
	}
	return id, err
}

func (r *AuthRepository) DeleteTask(ctx context.Context, taskID uint) (int64, error) {
	res, err := r.db.ExecContext(ctx, "DELETE FROM assigned_tasks WHERE id = $1", taskID)
	if err != nil {
		return 0, err
	}
	rows, _ := res.RowsAffected()
	return rows, nil
}

