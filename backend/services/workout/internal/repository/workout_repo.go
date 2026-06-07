package repository

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
)

// --- Domain Models ---

type Course struct {
	ID          uint   `db:"id"`
	Name        string `db:"name"`
	Slug        string `db:"slug"`
	Description string `db:"description"`
}

type UserCourse struct {
	ID             uint      `db:"id"`
	UserID         uint      `db:"user_id"`
	CourseID       uint      `db:"course_id"`
	OnboardingData []byte    `db:"onboarding_data"`
	Level          string    `db:"level"`
	Status         string    `db:"status"`
	EnrolledAt     time.Time `db:"enrolled_at"`
}

type Week struct {
	ID         uint   `db:"id"`
	CourseID   uint   `db:"course_id"`
	Level      string `db:"level"`
	WeekNumber int    `db:"week_number"`
	Title      string `db:"title"`
}

type WeekDay struct {
	ID        uint   `db:"id"`
	WeekID    uint   `db:"week_id"`
	DayNumber int    `db:"day_number"`
	Title     string `db:"title"`
	IsRestDay bool   `db:"is_rest_day"`
}

type Exercise struct {
	ID         uint   `db:"id"`
	WeekDayID  uint   `db:"week_day_id"`
	Name       string `db:"name"`
	Sets       int32  `db:"sets"`
	Reps       string `db:"reps"`
	Weight     string `db:"weight"`
	Video      string `db:"video"`
	OrderIndex int32  `db:"order_index"`
}

type UserDayProgress struct {
	ID          uint      `db:"id"`
	UserID      uint      `db:"user_id"`
	WeekDayID   uint      `db:"week_day_id"`
	CompletedAt time.Time `db:"completed_at"`
}

type HistoryRow struct {
	ID          uint      `db:"id"`
	Title       string    `db:"title"`
	CompletedAt time.Time `db:"completed_at"`
}

// --- Repository ---

type WorkoutRepository struct {
	db *sqlx.DB
}

func New(db *sqlx.DB) *WorkoutRepository {
	return &WorkoutRepository{db: db}
}

func (r *WorkoutRepository) GetAllCourses(ctx context.Context) ([]Course, error) {
	var courses []Course
	err := r.db.SelectContext(ctx, &courses, "SELECT * FROM courses ORDER BY id ASC")
	return courses, err
}

func (r *WorkoutRepository) FindCourseByID(ctx context.Context, courseID uint) (*Course, error) {
	var c Course
	err := r.db.GetContext(ctx, &c, "SELECT * FROM courses WHERE id = $1 LIMIT 1", courseID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *WorkoutRepository) FindActiveUserCourse(ctx context.Context, userID uint) (*UserCourse, error) {
	var uc UserCourse
	err := r.db.GetContext(ctx, &uc,
		"SELECT * FROM user_courses WHERE user_id = $1 AND status = 'active' LIMIT 1", userID)
	if err != nil {
		return nil, err
	}
	return &uc, nil
}

func (r *WorkoutRepository) CountActiveEnrollments(ctx context.Context, userID uint) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		"SELECT COUNT(*) FROM user_courses WHERE user_id = $1 AND status = 'active'", userID)
	return count, err
}

func (r *WorkoutRepository) CreateEnrollment(ctx context.Context, userID, courseID uint, onboardingJSON []byte, level string) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO user_courses (user_id, course_id, onboarding_data, level, status) VALUES ($1, $2, $3, $4, 'active')",
		userID, courseID, onboardingJSON, level,
	)
	return err
}

func (r *WorkoutRepository) CancelEnrollment(ctx context.Context, userID uint) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		"UPDATE user_courses SET status = 'cancelled', cancelled_at = NOW() WHERE user_id = $1 AND status = 'active'", userID)
	if err != nil {
		return 0, err
	}
	rows, _ := res.RowsAffected()
	return rows, nil
}

func (r *WorkoutRepository) UpsertTrialSubscription(ctx context.Context, userID uint, trialEnd time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO subscriptions (user_id, status, current_period_end)
		VALUES ($1, 'trial', $2)
		ON CONFLICT (user_id) DO UPDATE SET status = 'trial', current_period_end = $2, updated_at = NOW()`,
		userID, trialEnd,
	)
	return err
}

func (r *WorkoutRepository) CountCompletedDays(ctx context.Context, userID, courseID uint) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(udp.id)
		FROM user_day_progress udp
		JOIN week_days wd ON udp.week_day_id = wd.id
		JOIN weeks w ON wd.week_id = w.id
		WHERE udp.user_id = $1 AND w.course_id = $2`,
		userID, courseID,
	)
	return count, err
}

func (r *WorkoutRepository) FindWeekByCourseAndLevel(ctx context.Context, courseID uint, level string, weekNum int) (*Week, error) {
	var w Week
	err := r.db.GetContext(ctx, &w,
		"SELECT * FROM weeks WHERE course_id = $1 AND level = $2 AND week_number = $3 LIMIT 1",
		courseID, level, weekNum,
	)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *WorkoutRepository) GetDaysByWeekID(ctx context.Context, weekID uint) ([]WeekDay, error) {
	var days []WeekDay
	err := r.db.SelectContext(ctx, &days,
		"SELECT * FROM week_days WHERE week_id = $1 ORDER BY day_number ASC", weekID)
	return days, err
}

func (r *WorkoutRepository) GetExercisesByDayID(ctx context.Context, dayID uint) ([]Exercise, error) {
	var exercises []Exercise
	err := r.db.SelectContext(ctx, &exercises,
		"SELECT * FROM exercises WHERE week_day_id = $1 ORDER BY order_index ASC", dayID)
	return exercises, err
}

func (r *WorkoutRepository) GetWorkoutHistory(ctx context.Context, userID uint) ([]HistoryRow, error) {
	var rows []HistoryRow
	err := r.db.SelectContext(ctx, &rows, `
		SELECT udp.id, wd.title, udp.completed_at
		FROM user_day_progress udp
		JOIN week_days wd ON udp.week_day_id = wd.id
		WHERE udp.user_id = $1
		ORDER BY udp.completed_at DESC`, userID)
	return rows, err
}

func (r *WorkoutRepository) RecordDayCompletion(ctx context.Context, userID, dayID uint) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO user_day_progress (user_id, week_day_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id, week_day_id) DO NOTHING`,
		userID, dayID,
	)
	return err
}
