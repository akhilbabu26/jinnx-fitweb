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
	return &workoutv1.GetEnrolledCourseResponse{
		Id:          uint32(result.Course.ID),
		Name:        result.Course.Name,
		Description: result.Course.Description,
		Slug:        result.Course.Slug,
		IsEnrolled:  true,
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
