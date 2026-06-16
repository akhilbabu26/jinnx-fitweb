
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
