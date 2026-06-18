package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"
)

type SessionStatus string

const (
	SessionStatusActive SessionStatus = "active"
	SessionStatusEnded  SessionStatus = "ended"
)

type VideoSession struct {
	ID          uint          `db:"id"`
	AdminID     uint          `db:"admin_id"`
	UserID      uint          `db:"user_id"`
	LivekitRoom string        `db:"livekit_room"`
	Status      SessionStatus `db:"status"`
	StartedAt   time.Time     `db:"started_at"`
	EndedAt     sql.NullTime  `db:"ended_at"`
}

type VideoRepository struct {
	db *sqlx.DB
}

func New(db *sqlx.DB) *VideoRepository {
	return &VideoRepository{db: db}
}

func (r *VideoRepository) FindActiveSession(ctx context.Context, userID uint) (*VideoSession, error) {
	var s VideoSession
	err := r.db.GetContext(ctx, &s,
		"SELECT * FROM video_sessions WHERE user_id = $1 AND status = $2 AND ended_at IS NULL LIMIT 1", userID, string(SessionStatusActive))
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *VideoRepository) CreateSession(ctx context.Context, userID uint, roomName string) (uint, error) {
	var id uint
	err := r.db.QueryRowContext(ctx,
		"INSERT INTO video_sessions (admin_id, user_id, livekit_room, status, started_at) VALUES (1, $1, $2, $3, NOW()) RETURNING id",
		userID, roomName, string(SessionStatusActive),
	).Scan(&id)
	return id, err
}

func (r *VideoRepository) EndSession(ctx context.Context, sessionID uint) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE video_sessions SET status = $1, ended_at = NOW() WHERE id = $2",
		string(SessionStatusEnded), sessionID,
	)
	return err
}

func (r *VideoRepository) GetSessionsByUserID(ctx context.Context, userID uint) ([]VideoSession, error) {
	var sessions []VideoSession
	err := r.db.SelectContext(ctx, &sessions,
		"SELECT * FROM video_sessions WHERE user_id = $1 ORDER BY started_at DESC", userID)
	return sessions, err
}
