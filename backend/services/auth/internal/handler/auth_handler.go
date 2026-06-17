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
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	return &authv1.RegisterResponse{
		UserId:  uint32(result.UserID),
		Status:  string(result.Status),
		Message: result.Message,
	}, nil
}

func (h *AuthHandler) VerifyOTP(ctx context.Context, req *authv1.VerifyOTPRequest) (*authv1.VerifyOTPResponse, error) {
	success, err := h.svc.VerifyOTP(ctx, req.Email, req.Code)
	if err != nil {
		switch err.Error() {
		case "OTP expired or not found":
			return nil, status.Error(codes.DeadlineExceeded, err.Error())
		case "invalid OTP":
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case "user is already verified or not pending verification":
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		case "OTP service unavailable":
			return nil, status.Error(codes.Unavailable, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	return &authv1.VerifyOTPResponse{
		Success: success,
		Message: "Email verified successfully. Pending trainer approval.",
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
			return nil, status.Error(codes.Internal, msg)
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
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &authv1.GetUserProfileResponse{
		Id:     uint32(user.ID),
		Name:   user.Name,
		Email:  user.Email,
		Role:   user.Role,
		Status: string(user.Status),
	}, nil
}

func (h *AuthHandler) GetTrainerTasks(ctx context.Context, req *authv1.GetTrainerTasksRequest) (*authv1.GetTrainerTasksResponse, error) {
	tasks, err := h.svc.GetTrainerTasks(ctx, uint(req.UserId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
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
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &authv1.MarkTaskCompletedResponse{
		Success: true,
		Message: "Task marked as completed",
	}, nil
}

func (h *AuthHandler) ForgotPassword(ctx context.Context, req *authv1.ForgotPasswordRequest) (*authv1.ForgotPasswordResponse, error) {
	err := h.svc.ForgotPassword(ctx, req.Email)
	if err != nil {
		switch err.Error() {
		case "user not found":
			return nil, status.Error(codes.NotFound, err.Error())
		case "OTP service unavailable":
			return nil, status.Error(codes.Unavailable, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}
	return &authv1.ForgotPasswordResponse{
		Success: true,
		Message: "Password reset OTP sent successfully.",
	}, nil
}

func (h *AuthHandler) ResetPassword(ctx context.Context, req *authv1.ResetPasswordRequest) (*authv1.ResetPasswordResponse, error) {
	err := h.svc.ResetPassword(ctx, req.Email, req.Code, req.NewPassword)
	if err != nil {
		switch err.Error() {
		case "user not found":
			return nil, status.Error(codes.NotFound, err.Error())
		case "reset OTP expired or not found":
			return nil, status.Error(codes.DeadlineExceeded, err.Error())
		case "invalid reset OTP":
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case "OTP service unavailable":
			return nil, status.Error(codes.Unavailable, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}
	return &authv1.ResetPasswordResponse{
		Success: true,
		Message: "Password reset successful.",
	}, nil
}

// ── Admin handlers ────────────────────────────────────────────────────────────

func (h *AuthHandler) ListPendingUsers(ctx context.Context, _ *authv1.ListPendingUsersRequest) (*authv1.ListPendingUsersResponse, error) {
	users, err := h.svc.ListPendingUsers(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var protoUsers []*authv1.PendingUser
	for _, u := range users {
		protoUsers = append(protoUsers, &authv1.PendingUser{
			Id:        uint32(u.ID),
			Email:     u.Email,
			Name:      u.Name,
			Role:      u.Role,
			Status:    string(u.Status),
			CreatedAt: u.CreatedAt.Format(time.RFC3339),
		})
	}
	return &authv1.ListPendingUsersResponse{Users: protoUsers}, nil
}

func (h *AuthHandler) UpdateUserStatus(ctx context.Context, req *authv1.UpdateUserStatusRequest) (*authv1.UpdateUserStatusResponse, error) {
	var err error
	switch req.Status {
	case "approved":
		err = h.svc.ApproveUser(ctx, uint(req.AdminId), uint(req.UserId))
	case "rejected":
		err = h.svc.RejectUser(ctx, uint(req.AdminId), uint(req.UserId))
	default:
		return nil, status.Error(codes.InvalidArgument, "status must be 'approved' or 'rejected'")
	}

	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	msg := "User " + req.Status
	return &authv1.UpdateUserStatusResponse{Success: true, Message: msg}, nil
}

func (h *AuthHandler) BlockUser(ctx context.Context, req *authv1.BlockUserRequest) (*authv1.BlockUserResponse, error) {
	err := h.svc.BlockUser(ctx, uint(req.AdminId), uint(req.UserId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &authv1.BlockUserResponse{Success: true, Message: "User successfully blocked"}, nil
}

func (h *AuthHandler) UnblockUser(ctx context.Context, req *authv1.UnblockUserRequest) (*authv1.UnblockUserResponse, error) {
	err := h.svc.UnblockUser(ctx, uint(req.AdminId), uint(req.UserId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &authv1.UnblockUserResponse{Success: true, Message: "User successfully unblocked"}, nil
}

func (h *AuthHandler) ListAllUsers(ctx context.Context, _ *authv1.ListAllUsersRequest) (*authv1.ListAllUsersResponse, error) {
	users, err := h.svc.ListAllUsers(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var protoUsers []*authv1.PendingUser
	for _, u := range users {
		protoUsers = append(protoUsers, &authv1.PendingUser{
			Id:        uint32(u.ID),
			Email:     u.Email,
			Name:      u.Name,
			Role:      u.Role,
			Status:    string(u.Status),
			CreatedAt: u.CreatedAt.Format(time.RFC3339),
		})
	}
	return &authv1.ListAllUsersResponse{Users: protoUsers}, nil
}





