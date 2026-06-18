package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/akhilbabu26/jinnx/shared/kafka"
	"github.com/akhilbabu26/jinnx/services/workout/internal/repository"
)

type WorkoutService struct {
	repo  *repository.WorkoutRepository
	kafka *kafka.Producer // nil if Kafka unavailable
}

func New(repo *repository.WorkoutRepository, kafkaProducer *kafka.Producer) *WorkoutService {
	return &WorkoutService{repo: repo, kafka: kafkaProducer}
}

func (s *WorkoutService) GetCourses(ctx context.Context) ([]repository.Course, error) {
	return s.repo.GetAllCourses(ctx)
}

type EnrolledCourse struct {
	Course     repository.Course
	UserCourse repository.UserCourse
	IsEnrolled bool
}

func (s *WorkoutService) GetEnrolledCourse(ctx context.Context, userID uint) (*EnrolledCourse, error) {
	uc, err := s.repo.FindActiveUserCourse(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &EnrolledCourse{IsEnrolled: false}, nil
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	course, err := s.repo.FindCourseByID(ctx, uc.CourseID)
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}

	return &EnrolledCourse{Course: *course, UserCourse: *uc, IsEnrolled: true}, nil
}

func (s *WorkoutService) Enroll(ctx context.Context, userID, courseID uint, onboardingDataJSON string) error {
	count, err := s.repo.CountActiveEnrollments(ctx, userID)
	if err == nil && count > 0 {
		return errors.New("you are already enrolled in a course")
	}

	course, err := s.repo.FindCourseByID(ctx, courseID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("course not found")
		}
		return fmt.Errorf("database error: %w", err)
	}
	_ = course

	var onboarding map[string]interface{}
	_ = json.Unmarshal([]byte(onboardingDataJSON), &onboarding)

	level := repository.LevelBeginner
	var equipmentJSON []byte
	var goals string
	var age int
	var gender string
	var injuries string

	trialEndsAt := time.Now().AddDate(0, 0, 7) // 7-day trial

	if onboarding != nil {
		if lvl, ok := onboarding["experience_level"].(string); ok {
			if lvl == "beginner" || lvl == "Beginner" {
				level = repository.LevelBeginner
			} else if lvl == "intermediate" || lvl == "Intermediate" {
				level = repository.LevelIntermediate
			} else if lvl == "advanced" || lvl == "Advanced" {
				level = repository.LevelAdvanced
			}
		}
		if equip, ok := onboarding["equipment"]; ok {
			equipmentJSON, _ = json.Marshal(equip)
		}
		if g, ok := onboarding["goals"].(string); ok {
			goals = g
		}
		if a, ok := onboarding["age"].(float64); ok {
			age = int(a)
		}
		if gen, ok := onboarding["gender"].(string); ok {
			gender = gen
		}
		if inj, ok := onboarding["injuries"].(string); ok {
			injuries = inj
		}
	}

	if len(equipmentJSON) == 0 {
		equipmentJSON = []byte("[]")
	}

	if err := s.repo.CreateEnrollment(ctx, userID, courseID, []byte(onboardingDataJSON), level, equipmentJSON, trialEndsAt, goals, age, gender, injuries); err != nil {
		return fmt.Errorf("failed to enroll: %w", err)
	}

	_ = s.repo.UpsertTrialSubscription(ctx, userID, trialEndsAt)

	return nil
}

func (s *WorkoutService) CancelEnrollment(ctx context.Context, userID uint) error {
	rows, err := s.repo.CancelEnrollment(ctx, userID)
	if err != nil {
		return fmt.Errorf("database error: %w", err)
	}
	if rows == 0 {
		return errors.New("active enrollment not found")
	}
	return nil
}

type TodayWorkout struct {
	Day       repository.WeekDay
	Exercises []repository.Exercise
}

func (s *WorkoutService) GetTodayWorkout(ctx context.Context, userID uint) (*TodayWorkout, error) {
	uc, err := s.repo.FindActiveUserCourse(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("you are not enrolled in any course")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Determine if user has custom week plans assigned
	assignedWeeks, _ := s.repo.GetUserAssignedWeeks(ctx, userID)
	useCustom := len(assignedWeeks) > 0

	var completedCount int
	if useCustom {
		completedCount, err = s.repo.CountCompletedAssignedDays(ctx, userID, uc.CourseID)
	} else {
		completedCount, err = s.repo.CountCompletedDays(ctx, userID, uc.CourseID)
	}
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}

	var onboarding map[string]interface{}
	_ = json.Unmarshal(uc.OnboardingData, &onboarding)
	frequency := 3
	if onboarding != nil {
		if val, ok := onboarding["days_per_week"]; ok {
			if v, ok := val.(float64); ok {
				frequency = int(v)
			}
		}
	}
	if frequency <= 0 || frequency > 7 {
		frequency = 3
	}

	targetWeekNum := (completedCount / frequency) + 1
	targetDayNum := (completedCount % frequency) + 1

	var targetDay repository.WeekDay
	var exercises []repository.Exercise

	if useCustom {
		week, err := s.repo.FindAssignedWeekByCourseAndUser(ctx, userID, uc.CourseID, targetWeekNum)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				// Wrap around to week 1
				week, err = s.repo.FindAssignedWeekByCourseAndUser(ctx, userID, uc.CourseID, 1)
				if err != nil {
					return nil, errors.New("no custom program setup yet by the admin")
				}
			} else {
				return nil, fmt.Errorf("database error: %w", err)
			}
		}

		day, err := s.repo.FindAssignedDayByWeekAndNumber(ctx, week.ID, targetDayNum)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, errors.New("no custom workout days defined for this week")
			}
			return nil, fmt.Errorf("database error: %w", err)
		}

		targetDay = repository.WeekDay{
			ID:        day.ID,
			WeekID:    day.AssignedWeekID,
			DayNumber: day.DayNumber,
			Title:     day.Title,
			IsRestDay: day.IsRestDay,
		}

		assignedEx, err := s.repo.GetAssignedExercisesByDayID(ctx, day.ID)
		if err != nil {
			return nil, fmt.Errorf("database error: %w", err)
		}

		for _, e := range assignedEx {
			exercises = append(exercises, repository.Exercise{
				ID:              e.ID,
				WeekDayID:       e.AssignedDayID,
				Name:            e.Name,
				Sets:            e.Sets,
				Reps:            e.Reps,
				Weight:          e.Weight,
				Video:           e.VideoURL,
				OrderIndex:      e.OrderIndex,
				EquipmentNeeded: e.EquipmentNeeded,
			})
		}
	} else {
		week, err := s.repo.FindWeekByCourseAndLevel(ctx, uc.CourseID, uc.Level, targetWeekNum)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				// Wrap around to week 1
				week, err = s.repo.FindWeekByCourseAndLevel(ctx, uc.CourseID, uc.Level, 1)
				if err != nil {
					return nil, errors.New("no program setup yet by the admin")
				}
			} else {
				return nil, fmt.Errorf("database error: %w", err)
			}
		}

		days, err := s.repo.GetDaysByWeekID(ctx, week.ID)
		if err != nil {
			return nil, fmt.Errorf("database error: %w", err)
		}

		var selectedDay *repository.WeekDay
		for i := range days {
			if days[i].DayNumber == targetDayNum {
				selectedDay = &days[i]
				break
			}
		}
		if selectedDay == nil {
			if len(days) > 0 {
				selectedDay = &days[0]
			} else {
				return nil, errors.New("no workout days defined for this week")
			}
		}
		targetDay = *selectedDay

		exercises, err = s.repo.GetExercisesByDayID(ctx, targetDay.ID)
		if err != nil {
			return nil, fmt.Errorf("database error: %w", err)
		}
	}

	// Filter exercises by user's equipment list from user_courses.equipment
	var userEquipments []string
	if len(uc.Equipment) > 0 {
		_ = json.Unmarshal(uc.Equipment, &userEquipments)
	}

	hasEquipment := func(needed string) bool {
		if needed == "" || needed == "bodyweight" {
			return true
		}
		for _, eq := range userEquipments {
			if eq == needed {
				return true
			}
		}
		return false
	}

	var filteredExercises []repository.Exercise
	for _, e := range exercises {
		if hasEquipment(e.EquipmentNeeded) {
			filteredExercises = append(filteredExercises, e)
		}
	}

	return &TodayWorkout{Day: targetDay, Exercises: filteredExercises}, nil
}

func (s *WorkoutService) GetWorkoutHistory(ctx context.Context, userID uint) ([]repository.HistoryRow, error) {
	return s.repo.GetWorkoutHistory(ctx, userID)
}

func (s *WorkoutService) CompleteWorkoutDay(ctx context.Context, userID, dayID uint) error {
	isAssigned, err := s.repo.IsAssignedDay(ctx, dayID)
	if err != nil {
		return err
	}
	if isAssigned {
		if err := s.repo.RecordAssignedDayCompletion(ctx, userID, dayID); err != nil {
			return err
		}
	} else {
		if err := s.repo.RecordDayCompletion(ctx, userID, dayID); err != nil {
			return err
		}
	}

	// Publish event → admin WebSocket gets notified instantly
	if s.kafka != nil {
		_ = s.kafka.Publish(ctx, kafka.Event{
			Type:    kafka.EventDayCompleted,
			ActorID: userID,
			Payload: map[string]any{"day_id": dayID},
		})
	}
	return nil
}

// --- Admin Services ---

func (s *WorkoutService) CreateUserWeek(ctx context.Context, userID, courseID uint, weekNum int, title string) (uint, error) {
	return s.repo.CreateUserAssignedWeek(ctx, userID, courseID, weekNum, title)
}

func (s *WorkoutService) CreateUserDay(ctx context.Context, weekID uint, dayNum int, title string, isRestDay bool, adminNotes string) (uint, error) {
	return s.repo.CreateUserAssignedDay(ctx, weekID, dayNum, title, isRestDay, adminNotes)
}

func (s *WorkoutService) CreateUserExercise(ctx context.Context, dayID uint, name string, sets int32, reps, weight, videoURL, target, equipmentNeeded string, orderIndex int32) (uint, error) {
	return s.repo.CreateUserAssignedExercise(ctx, dayID, name, sets, reps, weight, videoURL, target, equipmentNeeded, orderIndex)
}

func (s *WorkoutService) UpdateUserExercise(ctx context.Context, exerciseID uint, name string, sets int32, reps, weight, videoURL, target, equipmentNeeded string, orderIndex int32) error {
	return s.repo.UpdateUserAssignedExercise(ctx, exerciseID, name, sets, reps, weight, videoURL, target, equipmentNeeded, orderIndex)
}

func (s *WorkoutService) DeleteUserExercise(ctx context.Context, exerciseID uint) error {
	return s.repo.DeleteUserAssignedExercise(ctx, exerciseID)
}

func (s *WorkoutService) AddDayFeedback(ctx context.Context, userID, dayID uint, feedbackText string) error {
	return s.repo.AddOrUpdateDayFeedback(ctx, userID, dayID, feedbackText)
}

func (s *WorkoutService) ToggleUserVideoAccess(ctx context.Context, userID uint, enabled bool) error {
	return s.repo.ToggleUserVideoAccess(ctx, userID, enabled)
}

func (s *WorkoutService) ListTrialExpiringUsers(ctx context.Context) ([]repository.TrialExpiringUser, error) {
	return s.repo.ListTrialExpiringUsers(ctx)
}

func (s *WorkoutService) SetUserLevel(ctx context.Context, userID uint, level string) error {
	var workoutLevel repository.WorkoutLevel
	switch level {
	case "beginner", "Beginner":
		workoutLevel = repository.LevelBeginner
	case "intermediate", "Intermediate":
		workoutLevel = repository.LevelIntermediate
	case "advanced", "Advanced":
		workoutLevel = repository.LevelAdvanced
	default:
		return fmt.Errorf("invalid level: %s", level)
	}
	return s.repo.UpdateUserCourseLevel(ctx, userID, workoutLevel)
}


// UserPlan models for GetUserPlan

type UserPlanExercise struct {
	ID              uint
	Name            string
	Sets            int32
	Reps            string
	Weight          string
	VideoURL        string
	Target          string
	EquipmentNeeded string
	OrderIndex      int32
}

type UserPlanDay struct {
	ID            uint
	DayNumber     int
	Title         string
	IsRestDay     bool
	AdminNotes    string
	Exercises     []UserPlanExercise
	AdminFeedback string
}

type UserPlanWeek struct {
	ID         uint
	WeekNumber int
	Title      string
	Days       []UserPlanDay
}

func (s *WorkoutService) GetUserPlan(ctx context.Context, userID uint) ([]UserPlanWeek, error) {
	weeks, err := s.repo.GetUserAssignedWeeks(ctx, userID)
	if err != nil {
		return nil, err
	}

	var planWeeks []UserPlanWeek
	for _, w := range weeks {
		days, err := s.repo.GetUserAssignedDays(ctx, w.ID)
		if err != nil {
			return nil, err
		}

		var planDays []UserPlanDay
		for _, d := range days {
			exercises, err := s.repo.GetUserAssignedExercises(ctx, d.ID)
			if err != nil {
				return nil, err
			}

			feedback, err := s.repo.GetDayFeedback(ctx, userID, d.ID)
			adminFeedback := ""
			if err == nil && feedback != nil {
				adminFeedback = feedback.AdminFeedback
			}

			var planExercises []UserPlanExercise
			for _, e := range exercises {
				planExercises = append(planExercises, UserPlanExercise{
					ID:              e.ID,
					Name:            e.Name,
					Sets:            e.Sets,
					Reps:            e.Reps,
					Weight:          e.Weight,
					VideoURL:        e.VideoURL,
					Target:          e.Target,
					EquipmentNeeded: e.EquipmentNeeded,
					OrderIndex:      e.OrderIndex,
				})
			}

			planDays = append(planDays, UserPlanDay{
				ID:            d.ID,
				DayNumber:     d.DayNumber,
				Title:         d.Title,
				IsRestDay:     d.IsRestDay,
				AdminNotes:    d.AdminNotes,
				Exercises:     planExercises,
				AdminFeedback: adminFeedback,
			})
		}

		planWeeks = append(planWeeks, UserPlanWeek{
			ID:         w.ID,
			WeekNumber: w.WeekNumber,
			Title:      w.Title,
			Days:       planDays,
		})
	}

	return planWeeks, nil
}
