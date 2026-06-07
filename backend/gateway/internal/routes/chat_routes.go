package routes

import (
	"github.com/gofiber/fiber/v2"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	chatv1 "github.com/akhilbabu26/jinnx/proto/chat/v1"
	subv1 "github.com/akhilbabu26/jinnx/proto/subscription/v1"
	apperr "github.com/akhilbabu26/jinnx/shared/errors"
	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/gateway/internal/middleware"
)

func RegisterChatRoutes(
	api fiber.Router,
	chatClient chatv1.ChatServiceClient,
	authClient authv1.AuthServiceClient,
	subClient subv1.SubscriptionServiceClient,
	jwtSecret string,
	redisClient *cache.RedisClient,
) {
	g := api.Group("/chat",
		middleware.JWTMiddleware(jwtSecret, authClient, redisClient),
		middleware.RequireApproved(),
		middleware.RequireActiveSubscription(subClient),
	)

	g.Get("/history", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		res, err := chatClient.GetChatHistory(c.Context(), &chatv1.GetChatHistoryRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "chat history retrieved",
			"data": fiber.Map{
				"messages":        res.Messages,
				"remaining_limit": res.RemainingLimit,
			},
		})
	})

	g.Post("/message", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		var req struct {
			Message string `json:"message"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

		res, err := chatClient.SendMessage(c.Context(), &chatv1.SendMessageRequest{
			UserId:  uint32(userID),
			Message: req.Message,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "message sent successfully",
			"data": fiber.Map{
				"reply":           res.Reply,
				"remaining_limit": res.RemainingLimit,
			},
		})
	})
}
