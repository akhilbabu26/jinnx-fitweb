package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/akhilbabu26/jinnx/services/workout/internal/repository"
)

type WorkoutService struct {
	repo *repository.WorkoutRepository
}

func New(repo *repository.WorkoutRepository) *WorkoutService {
	return &WorkoutService{repo: repo}
}

func (s *WorkoutService) GetCourses(ctx context.Context) ([]repository.Course, error) {
	return s.repo.GetAllCourses(ctx)
}

type EnrolledCourse struct {
	Course     repository.Course
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

	return &EnrolledCourse{Course: *course, IsEnrolled: true}, nil
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

	level := "beginner"
	if onboarding != nil {
		if lvl, ok := onboarding["experience_level"].(string); ok {
			if lvl == "Intermediate" || lvl == "Advanced" || lvl == "beginner" {
				level = lvl
			}
		}
	}

	if err := s.repo.CreateEnrollment(ctx, userID, courseID, []byte(onboardingDataJSON), level); err != nil {
		return fmt.Errorf("failed to enroll: %w", err)
	}

	trialEnd := time.Now().AddDate(0, 0, 7)
	_ = s.repo.UpsertTrialSubscription(ctx, userID, trialEnd)

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

	completedCount, err := s.repo.CountCompletedDays(ctx, userID, uc.CourseID)
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

	var targetDay *repository.WeekDay
	for i := range days {
		if days[i].DayNumber == targetDayNum {
			targetDay = &days[i]
			break
		}
	}
	if targetDay == nil {
		if len(days) > 0 {
			targetDay = &days[0]
		} else {
			return nil, errors.New("no workout days defined for this week")
		}
	}

	exercises, err := s.repo.GetExercisesByDayID(ctx, targetDay.ID)
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}

	return &TodayWorkout{Day: *targetDay, Exercises: exercises}, nil
}

func (s *WorkoutService) GetWorkoutHistory(ctx context.Context, userID uint) ([]repository.HistoryRow, error) {
	return s.repo.GetWorkoutHistory(ctx, userID)
}

func (s *WorkoutService) CompleteWorkoutDay(ctx context.Context, userID, dayID uint) error {
	return s.repo.RecordDayCompletion(ctx, userID, dayID)
}
