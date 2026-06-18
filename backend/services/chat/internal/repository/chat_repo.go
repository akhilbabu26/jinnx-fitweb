package repository

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
)

type ChatRole string

const (
	RoleUser      ChatRole = "user"
	RoleAssistant ChatRole = "assistant"
	RoleSystem    ChatRole = "system"
)

type ChatMessage struct {
	ID        uint      `db:"id"`
	UserID    uint      `db:"user_id"`
	Role      ChatRole  `db:"role"`
	Content   string    `db:"content"`
	CreatedAt time.Time `db:"created_at"`
}

type ChatRepository struct {
	db *sqlx.DB
}

func New(db *sqlx.DB) *ChatRepository {
	return &ChatRepository{db: db}
}

func (r *ChatRepository) GetRecentMessages(ctx context.Context, userID uint, limit int) ([]ChatMessage, error) {
	var msgs []ChatMessage
	err := r.db.SelectContext(ctx, &msgs,
		"SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
		userID, limit,
	)
	return msgs, err
}

func (r *ChatRepository) CountTodayUserMessages(ctx context.Context, userID uint) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(*) FROM chat_messages
		WHERE user_id = $1 AND role = $2 AND created_at >= CURRENT_DATE`,
		userID, string(RoleUser),
	)
	return count, err
}

func (r *ChatRepository) SaveMessage(ctx context.Context, userID uint, role ChatRole, content string) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO chat_messages (user_id, role, content) VALUES ($1, $2, $3)",
		userID, string(role), content,
	)
	return err
}
