
package handler

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	videov1 "github.com/akhilbabu26/jinnx/proto/video/v1"
	"github.com/akhilbabu26/jinnx/services/video/internal/service"
)

type VideoHandler struct {
	videov1.UnimplementedVideoServiceServer
	svc *service.VideoService
}

func New(svc *service.VideoService) *VideoHandler {
	return &VideoHandler{svc: svc}
}

func (h *VideoHandler) CreateSessionToken(ctx context.Context, req *videov1.CreateSessionTokenRequest) (*videov1.CreateSessionTokenResponse, error) {
	result, err := h.svc.CreateSessionToken(ctx, uint(req.UserId), req.RoomName)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &videov1.CreateSessionTokenResponse{
		Token:      result.Token,
		LivekitUrl: result.LivekitURL,
	}, nil
}

func (h *VideoHandler) GetSessionList(ctx context.Context, req *videov1.GetSessionListRequest) (*videov1.GetSessionListResponse, error) {
	sessions, err := h.svc.GetSessionList(ctx, uint(req.UserId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var protoSessions []*videov1.VideoSession
	for _, s := range sessions {
		protoSessions = append(protoSessions, &videov1.VideoSession{
			Id:          uint32(s.ID),
			RoomName:    s.LivekitRoom,
			Title:       fmt.Sprintf("Consultation Session - Room %s", s.LivekitRoom),
			ScheduledAt: s.StartedAt.Format(time.RFC3339),
		})
	}

	return &videov1.GetSessionListResponse{Sessions: protoSessions}, nil
}

func (h *VideoHandler) CreateRoom(ctx context.Context, req *videov1.CreateRoomRequest) (*videov1.CreateRoomResponse, error) {
	roomName, sessionID, err := h.svc.CreateRoom(ctx, uint(req.AdminId), uint(req.UserId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &videov1.CreateRoomResponse{
		RoomName:  roomName,
		SessionId: uint32(sessionID),
		Success:   true,
	}, nil
}

func (h *VideoHandler) GenerateToken(ctx context.Context, req *videov1.GenerateTokenRequest) (*videov1.GenerateTokenResponse, error) {
	token, err := h.svc.GenerateToken(ctx, uint(req.UserId), req.RoomName, req.IsAdmin)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &videov1.GenerateTokenResponse{
		Token:      token,
		LivekitUrl: h.svc.GetLivekitHost(),
	}, nil
}

func (h *VideoHandler) EndSession(ctx context.Context, req *videov1.EndSessionRequest) (*videov1.EndSessionResponse, error) {
	err := h.svc.EndSession(ctx, uint(req.AdminId), uint(req.SessionId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &videov1.EndSessionResponse{Success: true}, nil
}
