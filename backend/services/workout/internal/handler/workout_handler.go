package handler

import (
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	workoutv1 "github.com/akhilbabu26/jinnx/proto/workout/v1"
	"github.com/akhilbabu26/jinnx/services/workout/internal/service"
)

type WorkoutHandler struct {
	workoutv1.UnimplementedWorkoutServiceServer
	svc *service.WorkoutService
}

func New(svc *service.WorkoutService) *WorkoutHandler {
	return &WorkoutHandler{svc: svc}
}

func (h *WorkoutHandler) GetCourses(ctx context.Context, req *workoutv1.GetCoursesRequest) (*workoutv1.GetCoursesResponse, error) {
	courses, err := h.svc.GetCourses(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var proto []*workoutv1.Course
	for _, c := range courses {
		proto = append(proto, &workoutv1.Course{
			Id:          uint32(c.ID),
			Name:        c.Name,
			Slug:        c.Slug,
			Description: c.Description,
		})
	}
	return &workoutv1.GetCoursesResponse{Courses: proto}, nil
}

func (h *WorkoutHandler) GetEnrolledCourse(ctx context.Context, req *workoutv1.GetEnrolledCourseRequest) (*workoutv1.GetEnrolledCourseResponse, error) {
	result, err := h.svc.GetEnrolledCourse(ctx, uint(req.UserId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !result.IsEnrolled {
		return &workoutv1.GetEnrolledCourseResponse{IsEnrolled: false}, nil
	}
	
	trialEnds := ""
	if result.UserCourse.TrialEndsAt.Valid {
		trialEnds = result.UserCourse.TrialEndsAt.Time.Format("2006-01-02T15:04:05Z07:00")
	}

	return &workoutv1.GetEnrolledCourseResponse{
		Id:                 uint32(result.Course.ID),
		Name:               result.Course.Name,
		Description:        result.Course.Description,
		Slug:               result.Course.Slug,
		IsEnrolled:         true,
		Level:              string(result.UserCourse.Level),
		Equipment:          string(result.UserCourse.Equipment),
		TrialEndsAt:        trialEnds,
		VideoAccessEnabled: result.UserCourse.VideoAccessEnabled,
		Goals:              result.UserCourse.Goals,
		Age:                int32(result.UserCourse.Age.Int64),
		Gender:             result.UserCourse.Gender.String,
		Injuries:           result.UserCourse.Injuries,
	}, nil
}

func (h *WorkoutHandler) Enroll(ctx context.Context, req *workoutv1.EnrollRequest) (*workoutv1.EnrollResponse, error) {
	err := h.svc.Enroll(ctx, uint(req.UserId), uint(req.CourseId), req.OnboardingDataJson)
	if err != nil {
		switch err.Error() {
		case "you are already enrolled in a course":
			return nil, status.Error(codes.AlreadyExists, err.Error())
		case "course not found":
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}
	return &workoutv1.EnrollResponse{Success: true, Message: "Enrolled successfully"}, nil
}

func (h *WorkoutHandler) CancelEnrollment(ctx context.Context, req *workoutv1.CancelEnrollmentRequest) (*workoutv1.CancelEnrollmentResponse, error) {
	if err := h.svc.CancelEnrollment(ctx, uint(req.UserId)); err != nil {
		if err.Error() == "active enrollment not found" {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &workoutv1.CancelEnrollmentResponse{Success: true}, nil
}

func (h *WorkoutHandler) GetTodayWorkout(ctx context.Context, req *workoutv1.GetTodayWorkoutRequest) (*workoutv1.GetTodayWorkoutResponse, error) {
	result, err := h.svc.GetTodayWorkout(ctx, uint(req.UserId))
	if err != nil {
		switch err.Error() {
		case "you are not enrolled in any course":
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		case "no program setup yet by the admin", "no workout days defined for this week":
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	var protoExercises []*workoutv1.Exercise
	for _, e := range result.Exercises {
		protoExercises = append(protoExercises, &workoutv1.Exercise{
			Name:         e.Name,
			Sets:         e.Sets,
			Reps:         e.Reps,
			Weight:       e.Weight,
			Instructions: e.Video,
		})
	}

	return &workoutv1.GetTodayWorkoutResponse{
		Id:        uint32(result.Day.ID),
		Title:     result.Day.Title,
		DayNumber: int32(result.Day.DayNumber),
		IsRestDay: result.Day.IsRestDay,
		Exercises: protoExercises,
	}, nil
}

func (h *WorkoutHandler) GetWorkoutHistory(ctx context.Context, req *workoutv1.GetWorkoutHistoryRequest) (*workoutv1.GetWorkoutHistoryResponse, error) {
	rows, err := h.svc.GetWorkoutHistory(ctx, uint(req.UserId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var logs []*workoutv1.WorkoutLog
	for _, r := range rows {
		logs = append(logs, &workoutv1.WorkoutLog{
			Id:           uint32(r.ID),
			WorkoutTitle: r.Title,
			CompletedAt:  r.CompletedAt.Format(time.RFC3339),
		})
	}
	return &workoutv1.GetWorkoutHistoryResponse{Logs: logs}, nil
}

func (h *WorkoutHandler) CompleteWorkoutDay(ctx context.Context, req *workoutv1.CompleteWorkoutDayRequest) (*workoutv1.CompleteWorkoutDayResponse, error) {
	if err := h.svc.CompleteWorkoutDay(ctx, uint(req.UserId), uint(req.DayId)); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &workoutv1.CompleteWorkoutDayResponse{Success: true}, nil
}

// --- Admin Custom Plan Handlers ---

func (h *WorkoutHandler) CreateUserWeek(ctx context.Context, req *workoutv1.CreateUserWeekRequest) (*workoutv1.CreateUserWeekResponse, error) {
	id, err := h.svc.CreateUserWeek(ctx, uint(req.UserId), uint(req.CourseId), int(req.WeekNumber), req.Title)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &workoutv1.CreateUserWeekResponse{AssignedWeekId: uint32(id), Success: true}, nil
}

func (h *WorkoutHandler) CreateUserDay(ctx context.Context, req *workoutv1.CreateUserDayRequest) (*workoutv1.CreateUserDayResponse, error) {
	id, err := h.svc.CreateUserDay(ctx, uint(req.AssignedWeekId), int(req.DayNumber), req.Title, req.IsRestDay, req.AdminNotes)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &workoutv1.CreateUserDayResponse{AssignedDayId: uint32(id), Success: true}, nil
}

func (h *WorkoutHandler) CreateUserExercise(ctx context.Context, req *workoutv1.CreateUserExerciseRequest) (*workoutv1.CreateUserExerciseResponse, error) {
	ex := req.Exercise
	id, err := h.svc.CreateUserExercise(ctx, uint(req.AssignedDayId), ex.Name, ex.Sets, ex.Reps, ex.Weight, ex.VideoUrl, ex.Target, ex.EquipmentNeeded, ex.OrderIndex)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &workoutv1.CreateUserExerciseResponse{ExerciseId: uint32(id), Success: true}, nil
}

func (h *WorkoutHandler) UpdateUserExercise(ctx context.Context, req *workoutv1.UpdateUserExerciseRequest) (*workoutv1.UpdateUserExerciseResponse, error) {
	ex := req.Exercise
	err := h.svc.UpdateUserExercise(ctx, uint(req.ExerciseId), ex.Name, ex.Sets, ex.Reps, ex.Weight, ex.VideoUrl, ex.Target, ex.EquipmentNeeded, ex.OrderIndex)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &workoutv1.UpdateUserExerciseResponse{Success: true}, nil
}

func (h *WorkoutHandler) DeleteUserExercise(ctx context.Context, req *workoutv1.DeleteUserExerciseRequest) (*workoutv1.DeleteUserExerciseResponse, error) {
	err := h.svc.DeleteUserExercise(ctx, uint(req.ExerciseId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &workoutv1.DeleteUserExerciseResponse{Success: true}, nil
}

func (h *WorkoutHandler) AddDayFeedback(ctx context.Context, req *workoutv1.AddDayFeedbackRequest) (*workoutv1.AddDayFeedbackResponse, error) {
	err := h.svc.AddDayFeedback(ctx, uint(req.UserId), uint(req.AssignedDayId), req.FeedbackText)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &workoutv1.AddDayFeedbackResponse{Success: true}, nil
}

func (h *WorkoutHandler) GetUserPlan(ctx context.Context, req *workoutv1.GetUserPlanRequest) (*workoutv1.GetUserPlanResponse, error) {
	weeks, err := h.svc.GetUserPlan(ctx, uint(req.UserId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var protoWeeks []*workoutv1.UserPlanWeek
	for _, w := range weeks {
		var protoDays []*workoutv1.UserPlanDay
		for _, d := range w.Days {
			var protoExs []*workoutv1.UserPlanExercise
			for _, e := range d.Exercises {
				protoExs = append(protoExs, &workoutv1.UserPlanExercise{
					Id:              uint32(e.ID),
					Name:            e.Name,
					Sets:            e.Sets,
					Reps:            e.Reps,
					Weight:          e.Weight,
					VideoUrl:        e.VideoURL,
					Target:          e.Target,
					EquipmentNeeded: e.EquipmentNeeded,
					OrderIndex:      e.OrderIndex,
				})
			}
			protoDays = append(protoDays, &workoutv1.UserPlanDay{
				Id:            uint32(d.ID),
				DayNumber:     int32(d.DayNumber),
				Title:         d.Title,
				IsRestDay:     d.IsRestDay,
				AdminNotes:    d.AdminNotes,
				Exercises:     protoExs,
				AdminFeedback: d.AdminFeedback,
			})
		}
		protoWeeks = append(protoWeeks, &workoutv1.UserPlanWeek{
			Id:         uint32(w.ID),
			WeekNumber: int32(w.WeekNumber),
			Title:      w.Title,
			Days:       protoDays,
		})
	}
	return &workoutv1.GetUserPlanResponse{Weeks: protoWeeks}, nil
}

func (h *WorkoutHandler) ToggleUserVideoAccess(ctx context.Context, req *workoutv1.ToggleUserVideoAccessRequest) (*workoutv1.ToggleUserVideoAccessResponse, error) {
	err := h.svc.ToggleUserVideoAccess(ctx, uint(req.UserId), req.Enabled)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &workoutv1.ToggleUserVideoAccessResponse{Success: true}, nil
}

func (h *WorkoutHandler) ListTrialExpiringUsers(ctx context.Context, req *workoutv1.ListTrialExpiringUsersRequest) (*workoutv1.ListTrialExpiringUsersResponse, error) {
	users, err := h.svc.ListTrialExpiringUsers(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var protoUsers []*workoutv1.ExpiringUser
	for _, u := range users {
		protoUsers = append(protoUsers, &workoutv1.ExpiringUser{
			UserId:      uint32(u.UserID),
			Email:       u.Email,
			Name:        u.Name,
			TrialEndsAt: u.TrialEndsAt.Format(time.RFC3339),
		})
	}
	return &workoutv1.ListTrialExpiringUsersResponse{Users: protoUsers}, nil
}

func (h *WorkoutHandler) SetUserLevel(ctx context.Context, req *workoutv1.SetUserLevelRequest) (*workoutv1.SetUserLevelResponse, error) {
	err := h.svc.SetUserLevel(ctx, uint(req.UserId), req.Level)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &workoutv1.SetUserLevelResponse{Success: true}, nil
}

