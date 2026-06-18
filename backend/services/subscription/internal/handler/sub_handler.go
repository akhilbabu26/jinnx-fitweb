package handler

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	subv1 "github.com/akhilbabu26/jinnx/proto/subscription/v1"
	"github.com/akhilbabu26/jinnx/services/subscription/internal/service"
)

type SubscriptionHandler struct {
	subv1.UnimplementedSubscriptionServiceServer
	svc *service.SubscriptionService
}

func New(svc *service.SubscriptionService) *SubscriptionHandler {
	return &SubscriptionHandler{svc: svc}
}

func (h *SubscriptionHandler) GetSubscription(ctx context.Context, req *subv1.GetSubscriptionRequest) (*subv1.GetSubscriptionResponse, error) {
	result, err := h.svc.GetSubscription(ctx, uint(req.UserId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var pbPeriodEnd *timestamppb.Timestamp
	if result.Sub.CurrentPeriodEnd.Valid {
		pbPeriodEnd = timestamppb.New(result.Sub.CurrentPeriodEnd.Time)
	}

	return &subv1.GetSubscriptionResponse{
		Status:           string(result.Sub.Status),
		CurrentPeriodEnd: pbPeriodEnd,
		RazorpaySubId:    result.Sub.RazorpaySubID,
		IsActive:         result.IsActive,
	}, nil
}

func (h *SubscriptionHandler) CreateRazorpaySubscription(ctx context.Context, req *subv1.CreateRazorpaySubscriptionRequest) (*subv1.CreateRazorpaySubscriptionResponse, error) {
	checkout, err := h.svc.CreateRazorpaySubscription(ctx, uint(req.UserId))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &subv1.CreateRazorpaySubscriptionResponse{
		SubscriptionId: checkout.SubscriptionID,
		KeyId:          checkout.KeyID,
	}, nil
}

func (h *SubscriptionHandler) HandleWebhook(ctx context.Context, req *subv1.HandleWebhookRequest) (*subv1.HandleWebhookResponse, error) {
	if err := h.svc.HandleWebhook(ctx, req.Payload, req.Signature); err != nil {
		if err.Error() == "invalid webhook signature" {
			return nil, status.Error(codes.Unauthenticated, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &subv1.HandleWebhookResponse{Success: true}, nil
}
