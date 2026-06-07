package handler

import (
	"context"
	"fmt"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	chatv1 "github.com/akhilbabu26/jinnx/proto/chat/v1"
	"github.com/akhilbabu26/jinnx/services/chat/internal/service"
)

type ChatHandler struct {
	chatv1.UnimplementedChatServiceServer
	svc *service.ChatService
}

func New(svc *service.ChatService) *ChatHandler {
	return &ChatHandler{svc: svc}
}

func (h *ChatHandler) GetChatHistory(ctx context.Context, req *chatv1.GetChatHistoryRequest) (*chatv1.GetChatHistoryResponse, error) {
	result, err := h.svc.GetChatHistory(ctx, uint(req.UserId))
	if err != nil {
		return nil, status.Errorf(codes.Internal, err.Error())
	}

	var proto []*chatv1.ChatMessage
	for _, m := range result.Messages {
		proto = append(proto, &chatv1.ChatMessage{
			Id:        uint32(m.ID),
			Role:      m.Role,
			Content:   m.Content,
			CreatedAt: m.CreatedAt.Format(time.RFC3339),
		})
	}

	return &chatv1.GetChatHistoryResponse{
		Messages:       proto,
		RemainingLimit: int32(result.RemainingLimit),
	}, nil
}

func (h *ChatHandler) SendMessage(ctx context.Context, req *chatv1.SendMessageRequest) (*chatv1.SendMessageResponse, error) {
	result, err := h.svc.SendMessage(ctx, uint(req.UserId), req.Message)
	if err != nil {
		if strings.Contains(err.Error(), "daily limit") {
			return nil, status.Errorf(codes.ResourceExhausted, err.Error())
		}
		if strings.Contains(err.Error(), fmt.Sprintf("%d", codes.Internal)) {
			return nil, status.Errorf(codes.Internal, err.Error())
		}
		return nil, status.Errorf(codes.Internal, err.Error())
	}

	return &chatv1.SendMessageResponse{
		Reply:          result.Reply,
		RemainingLimit: int32(result.RemainingLimit),
	}, nil
}
