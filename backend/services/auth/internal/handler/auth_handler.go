package handler

import (
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	"github.com/akhilbabu26/jinnx/services/auth/internal/service"
)

// AuthHandler implements the gRPC AuthServiceServer interface.
// It translates gRPC requests into service calls and maps errors to gRPC status codes.
type AuthHandler struct {
	authv1.UnimplementedAuthServiceServer
	svc *service.AuthService
}

func New(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) Register(ctx context.Context, req *authv1.RegisterRequest) (*authv1.RegisterResponse, error) {
	result, err := h.svc.Register(ctx, req.Email, req.Name, req.Password)
	if err != nil {
		switch err.Error() {
		case "email already registered":
			return nil, status.Error(codes.AlreadyExists, err.Error())
		default:
			return nil, status.Errorf(codes.Internal, err.Error())
		}
	}

	return &authv1.RegisterResponse{
		UserId:  uint32(result.UserID),
		Status:  result.Status,
		Message: result.Message,
	}, nil
}

func (h *AuthHandler) Login(ctx context.Context, req *authv1.LoginRequest) (*authv1.LoginResponse, error) {
	result, err := h.svc.Login(ctx, req.Email, req.Password)
	if err != nil {
		msg := err.Error()
		switch msg {
		case "invalid credentials":
			return nil, status.Error(codes.Unauthenticated, msg)
		case "please verify your email first":
			return nil, status.Error(codes.FailedPrecondition, msg)
		case "your account is pending trainer approval", "your account has been rejected, contact the trainer":
			return nil, status.Error(codes.PermissionDenied, msg)
		default:
			return nil, status.Errorf(codes.Internal, msg)
		}
	}

	return &authv1.LoginResponse{
		AccessToken:  result.AccessToken,
		RefreshToken: result.RefreshToken,
		UserId:       uint32(result.UserID),
		Role:         result.Role,
	}, nil
}

func (h *AuthHandler) GetUserProfile(ctx context.Context, req *authv1.GetUserProfileRequest) (*authv1.GetUserProfileResponse, error) {
	user, err := h.svc.GetUserProfile(ctx, uint(req.UserId))
	if err != nil {
		if err.Error() == "user not found" {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Errorf(codes.Internal, err.Error())
	}

	return &authv1.GetUserProfileResponse{
		Id:     uint32(user.ID),
		Name:   user.Name,
		Email:  user.Email,
		Role:   user.Role,
		Status: user.Status,
	}, nil
}

func (h *AuthHandler) GetTrainerTasks(ctx context.Context, req *authv1.GetTrainerTasksRequest) (*authv1.GetTrainerTasksResponse, error) {
	tasks, err := h.svc.GetTrainerTasks(ctx, uint(req.UserId))
	if err != nil {
		return nil, status.Errorf(codes.Internal, err.Error())
	}

	var protoTasks []*authv1.Task
	for _, t := range tasks {
		dueStr := ""
		if t.DueDate.Valid {
			dueStr = t.DueDate.Time.Format(time.RFC3339)
		}
		protoTasks = append(protoTasks, &authv1.Task{
			Id:          uint32(t.ID),
			Title:       t.Title,
			Description: t.Description,
			Status:      t.Status,
			DueDate:     dueStr,
		})
	}

	return &authv1.GetTrainerTasksResponse{Tasks: protoTasks}, nil
}

func (h *AuthHandler) MarkTaskCompleted(ctx context.Context, req *authv1.MarkTaskCompletedRequest) (*authv1.MarkTaskCompletedResponse, error) {
	err := h.svc.MarkTaskCompleted(ctx, uint(req.TaskId), uint(req.UserId))
	if err != nil {
		if err.Error() == "task not found or does not belong to user" {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Errorf(codes.Internal, err.Error())
	}

	return &authv1.MarkTaskCompletedResponse{
		Success: true,
		Message: "Task marked as completed",
	}, nil
}


