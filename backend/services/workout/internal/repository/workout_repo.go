package repository

import (
	"context"
	"database/sql"
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

type UserCourseStatus string
type WorkoutLevel string
type SubscriptionStatus string

const (
	CourseStatusActive    UserCourseStatus = "active"
	CourseStatusCancelled UserCourseStatus = "cancelled"
)

const (
	LevelBeginner     WorkoutLevel = "beginner"
	LevelIntermediate WorkoutLevel = "intermediate"
	LevelAdvanced     WorkoutLevel = "advanced"
)

const (
	StatusTrial SubscriptionStatus = "trial"
)

type UserCourse struct {
	ID                 uint             `db:"id"`
	UserID             uint             `db:"user_id"`
	CourseID           uint             `db:"course_id"`
	OnboardingData     []byte           `db:"onboarding_data"`
	Level              WorkoutLevel     `db:"level"`
	Status             UserCourseStatus `db:"status"`
	EnrolledAt         time.Time        `db:"enrolled_at"`
	Equipment          []byte           `db:"equipment"`
	TrialEndsAt        sql.NullTime     `db:"trial_ends_at"`
	VideoAccessEnabled bool             `db:"video_access_enabled"`
	Goals              string           `db:"goals"`
	Age                sql.NullInt64    `db:"age"`
	Gender             sql.NullString   `db:"gender"`
	Injuries           string           `db:"injuries"`
}

type Week struct {
	ID         uint         `db:"id"`
	CourseID   uint         `db:"course_id"`
	Level      WorkoutLevel `db:"level"`
	WeekNumber int          `db:"week_number"`
	Title      string       `db:"title"`
}

type WeekDay struct {
	ID        uint   `db:"id"`
	WeekID    uint   `db:"week_id"`
	DayNumber int    `db:"day_number"`
	Title     string `db:"title"`
	IsRestDay bool   `db:"is_rest_day"`
}

type Exercise struct {
	ID              uint   `db:"id"`
	WeekDayID       uint   `db:"week_day_id"`
	Name            string `db:"name"`
	Sets            int32  `db:"sets"`
	Reps            string `db:"reps"`
	Weight          string `db:"weight"`
	Video           string `db:"video"`
	OrderIndex      int32  `db:"order_index"`
	EquipmentNeeded string `db:"equipment_needed"`
}

type UserDayProgress struct {
	ID            uint          `db:"id"`
	UserID        uint          `db:"user_id"`
	WeekDayID     sql.NullInt64 `db:"week_day_id"`
	AssignedDayID sql.NullInt64 `db:"assigned_day_id"`
	CompletedAt   time.Time     `db:"completed_at"`
}

type UserAssignedWeek struct {
	ID         uint      `db:"id"`
	UserID     uint      `db:"user_id"`
	CourseID   uint      `db:"course_id"`
	WeekNumber int       `db:"week_number"`
	Title      string    `db:"title"`
	CreatedAt  time.Time `db:"created_at"`
}

type UserAssignedDay struct {
	ID             uint   `db:"id"`
	AssignedWeekID uint   `db:"assigned_week_id"`
	DayNumber      int    `db:"day_number"`
	Title          string `db:"title"`
	IsRestDay      bool   `db:"is_rest_day"`
	AdminNotes     string `db:"admin_notes"`
}

type UserAssignedExercise struct {
	ID              uint   `db:"id"`
	AssignedDayID   uint   `db:"assigned_day_id"`
	Name            string `db:"name"`
	Sets            int32  `db:"sets"`
	Reps            string `db:"reps"`
	Weight          string `db:"weight"`
	VideoURL        string `db:"video_url"`
	Target          string `db:"target"`
	EquipmentNeeded string `db:"equipment_needed"`
	OrderIndex      int32  `db:"order_index"`
}

type UserDayFeedback struct {
	ID            uint      `db:"id"`
	UserID        uint      `db:"user_id"`
	AssignedDayID uint      `db:"assigned_day_id"`
	AdminFeedback string    `db:"admin_feedback"`
	UserNotes     string    `db:"user_notes"`
	CreatedAt     time.Time `db:"created_at"`
}

type TrialExpiringUser struct {
	UserID      uint      `db:"user_id"`
	Email       string    `db:"email"`
	Name        string    `db:"name"`
	TrialEndsAt time.Time `db:"trial_ends_at"`
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
		"SELECT * FROM user_courses WHERE user_id = $1 AND status = $2 LIMIT 1", userID, string(CourseStatusActive))
	if err != nil {
		return nil, err
	}
	return &uc, nil
}

func (r *WorkoutRepository) CountActiveEnrollments(ctx context.Context, userID uint) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		"SELECT COUNT(*) FROM user_courses WHERE user_id = $1 AND status = $2", userID, string(CourseStatusActive))
	return count, err
}

func (r *WorkoutRepository) CreateEnrollment(
	ctx context.Context,
	userID, courseID uint,
	onboardingJSON []byte,
	level WorkoutLevel,
	equipmentJSON []byte,
	trialEndsAt time.Time,
	goals string,
	age int,
	gender string,
	injuries string,
) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO user_courses (
			user_id, course_id, onboarding_data, level, status,
			equipment, trial_ends_at, video_access_enabled, goals, age, gender, injuries
		) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $9, $10, $11)`,
		userID, courseID, onboardingJSON, string(level), string(CourseStatusActive),
		equipmentJSON, trialEndsAt, goals, age, gender, injuries,
	)
	return err
}

func (r *WorkoutRepository) CancelEnrollment(ctx context.Context, userID uint) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		"UPDATE user_courses SET status = $1, cancelled_at = NOW() WHERE user_id = $2 AND status = $3",
		string(CourseStatusCancelled), userID, string(CourseStatusActive))
	if err != nil {
		return 0, err
	}
	rows, _ := res.RowsAffected()
	return rows, nil
}

func (r *WorkoutRepository) UpsertTrialSubscription(ctx context.Context, userID uint, trialEnd time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO subscriptions (user_id, status, current_period_end)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET status = $2, current_period_end = $3, updated_at = NOW()`,
		userID, string(StatusTrial), trialEnd,
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

func (r *WorkoutRepository) CountCompletedAssignedDays(ctx context.Context, userID, courseID uint) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(udp.id)
		FROM user_day_progress udp
		JOIN user_assigned_days uad ON udp.assigned_day_id = uad.id
		JOIN user_assigned_weeks uaw ON uad.assigned_week_id = uaw.id
		WHERE udp.user_id = $1 AND uaw.course_id = $2`,
		userID, courseID,
	)
	return count, err
}

func (r *WorkoutRepository) FindWeekByCourseAndLevel(ctx context.Context, courseID uint, level WorkoutLevel, weekNum int) (*Week, error) {
	var w Week
	err := r.db.GetContext(ctx, &w,
		"SELECT * FROM weeks WHERE course_id = $1 AND level = $2 AND week_number = $3 LIMIT 1",
		courseID, string(level), weekNum,
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

func (r *WorkoutRepository) RecordAssignedDayCompletion(ctx context.Context, userID, assignedDayID uint) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO user_day_progress (user_id, assigned_day_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id, assigned_day_id) DO NOTHING`,
		userID, assignedDayID,
	)
	return err
}

func (r *WorkoutRepository) IsAssignedDay(ctx context.Context, dayID uint) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists, "SELECT EXISTS(SELECT 1 FROM user_assigned_days WHERE id = $1)", dayID)
	return exists, err
}

// --- Admin APIs & Per-User Customization CRUD ---

func (r *WorkoutRepository) CreateUserAssignedWeek(ctx context.Context, userID, courseID uint, weekNum int, title string) (uint, error) {
	var id uint
	query := `INSERT INTO user_assigned_weeks (user_id, course_id, week_number, title)
	          VALUES ($1, $2, $3, $4)
	          ON CONFLICT (user_id, course_id, week_number) DO UPDATE SET title = EXCLUDED.title
	          RETURNING id`
	err := r.db.QueryRowContext(ctx, query, userID, courseID, weekNum, title).Scan(&id)
	return id, err
}

func (r *WorkoutRepository) CreateUserAssignedDay(ctx context.Context, weekID uint, dayNum int, title string, isRestDay bool, adminNotes string) (uint, error) {
	var id uint
	query := `INSERT INTO user_assigned_days (assigned_week_id, day_number, title, is_rest_day, admin_notes)
	          VALUES ($1, $2, $3, $4, $5)
	          ON CONFLICT (assigned_week_id, day_number) DO UPDATE SET
	              title = EXCLUDED.title,
	              is_rest_day = EXCLUDED.is_rest_day,
	              admin_notes = EXCLUDED.admin_notes
	          RETURNING id`
	err := r.db.QueryRowContext(ctx, query, weekID, dayNum, title, isRestDay, adminNotes).Scan(&id)
	return id, err
}

func (r *WorkoutRepository) CreateUserAssignedExercise(ctx context.Context, dayID uint, name string, sets int32, reps, weight, videoURL, target, equipmentNeeded string, orderIndex int32) (uint, error) {
	var id uint
	query := `INSERT INTO user_assigned_exercises (assigned_day_id, name, sets, reps, weight, video_url, target, equipment_needed, order_index)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`
	err := r.db.QueryRowContext(ctx, query, dayID, name, sets, reps, weight, videoURL, target, equipmentNeeded, orderIndex).Scan(&id)
	return id, err
}

func (r *WorkoutRepository) UpdateUserAssignedExercise(ctx context.Context, exerciseID uint, name string, sets int32, reps, weight, videoURL, target, equipmentNeeded string, orderIndex int32) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE user_assigned_exercises
		SET name = $1, sets = $2, reps = $3, weight = $4, video_url = $5, target = $6, equipment_needed = $7, order_index = $8
		WHERE id = $9`,
		name, sets, reps, weight, videoURL, target, equipmentNeeded, orderIndex, exerciseID,
	)
	return err
}

func (r *WorkoutRepository) DeleteUserAssignedExercise(ctx context.Context, exerciseID uint) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM user_assigned_exercises WHERE id = $1", exerciseID)
	return err
}

func (r *WorkoutRepository) AddOrUpdateDayFeedback(ctx context.Context, userID, dayID uint, adminFeedback string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO user_day_feedback (user_id, assigned_day_id, admin_feedback)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, assigned_day_id) DO UPDATE SET admin_feedback = EXCLUDED.admin_feedback`,
		userID, dayID, adminFeedback,
	)
	return err
}

func (r *WorkoutRepository) GetUserAssignedWeeks(ctx context.Context, userID uint) ([]UserAssignedWeek, error) {
	var weeks []UserAssignedWeek
	err := r.db.SelectContext(ctx, &weeks, "SELECT * FROM user_assigned_weeks WHERE user_id = $1 ORDER BY week_number ASC", userID)
	return weeks, err
}

func (r *WorkoutRepository) GetUserAssignedDays(ctx context.Context, weekID uint) ([]UserAssignedDay, error) {
	var days []UserAssignedDay
	err := r.db.SelectContext(ctx, &days, "SELECT * FROM user_assigned_days WHERE assigned_week_id = $1 ORDER BY day_number ASC", weekID)
	return days, err
}

func (r *WorkoutRepository) GetUserAssignedExercises(ctx context.Context, dayID uint) ([]UserAssignedExercise, error) {
	var exercises []UserAssignedExercise
	err := r.db.SelectContext(ctx, &exercises, "SELECT * FROM user_assigned_exercises WHERE assigned_day_id = $1 ORDER BY order_index ASC", dayID)
	return exercises, err
}

func (r *WorkoutRepository) GetDayFeedback(ctx context.Context, userID, dayID uint) (*UserDayFeedback, error) {
	var f UserDayFeedback
	err := r.db.GetContext(ctx, &f, "SELECT * FROM user_day_feedback WHERE user_id = $1 AND assigned_day_id = $2 LIMIT 1", userID, dayID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *WorkoutRepository) ToggleUserVideoAccess(ctx context.Context, userID uint, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE user_courses SET video_access_enabled = $1 WHERE user_id = $2 AND status = $3",
		enabled, userID, string(CourseStatusActive),
	)
	return err
}

func (r *WorkoutRepository) ListTrialExpiringUsers(ctx context.Context) ([]TrialExpiringUser, error) {
	var users []TrialExpiringUser
	query := `
		SELECT uc.user_id, u.email, u.name, uc.trial_ends_at
		FROM user_courses uc
		JOIN users u ON uc.user_id = u.id
		WHERE uc.status = $1
		  AND uc.trial_ends_at IS NOT NULL
		  AND uc.trial_ends_at <= NOW() + INTERVAL '48 hours'
		  AND uc.trial_ends_at > NOW()
		ORDER BY uc.trial_ends_at ASC`
	err := r.db.SelectContext(ctx, &users, query, string(CourseStatusActive))
	return users, err
}

func (r *WorkoutRepository) FindAssignedWeekByCourseAndUser(ctx context.Context, userID, courseID uint, weekNum int) (*UserAssignedWeek, error) {
	var w UserAssignedWeek
	err := r.db.GetContext(ctx, &w,
		"SELECT * FROM user_assigned_weeks WHERE user_id = $1 AND course_id = $2 AND week_number = $3 LIMIT 1",
		userID, courseID, weekNum,
	)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *WorkoutRepository) FindAssignedDayByWeekAndNumber(ctx context.Context, weekID uint, dayNum int) (*UserAssignedDay, error) {
	var d UserAssignedDay
	err := r.db.GetContext(ctx, &d,
		"SELECT * FROM user_assigned_days WHERE assigned_week_id = $1 AND day_number = $2 LIMIT 1",
		weekID, dayNum,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *WorkoutRepository) GetAssignedExercisesByDayID(ctx context.Context, dayID uint) ([]UserAssignedExercise, error) {
	var exercises []UserAssignedExercise
	err := r.db.SelectContext(ctx, &exercises, "SELECT * FROM user_assigned_exercises WHERE assigned_day_id = $1 ORDER BY order_index ASC", dayID)
	return exercises, err
}

func (r *WorkoutRepository) UpdateUserCourseLevel(ctx context.Context, userID uint, level WorkoutLevel) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE user_courses SET level = $1 WHERE user_id = $2 AND status = $3",
		string(level), userID, string(CourseStatusActive),
	)
	return err
}
