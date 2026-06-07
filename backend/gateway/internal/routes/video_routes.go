package routes

import (
	"github.com/gofiber/fiber/v2"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	subv1 "github.com/akhilbabu26/jinnx/proto/subscription/v1"
	videov1 "github.com/akhilbabu26/jinnx/proto/video/v1"
	apperr "github.com/akhilbabu26/jinnx/shared/errors"
	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/gateway/internal/middleware"
)

func RegisterVideoRoutes(
	api fiber.Router,
	videoClient videov1.VideoServiceClient,
	authClient authv1.AuthServiceClient,
	subClient subv1.SubscriptionServiceClient,
	jwtSecret string,
	redisClient *cache.RedisClient,
) {
	g := api.Group("/video",
		middleware.JWTMiddleware(jwtSecret, authClient, redisClient),
		middleware.RequireApproved(),
		middleware.RequireActiveSubscription(subClient),
	)

	g.Post("/token", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		var req struct {
			RoomName string `json:"room_name"`
		}
		_ = c.BodyParser(&req)

		res, err := videoClient.CreateSessionToken(c.Context(), &videov1.CreateSessionTokenRequest{
			UserId:   uint32(userID),
			RoomName: req.RoomName,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "video session token generated",
			"data": fiber.Map{
				"token":       res.Token,
				"livekit_url": res.LivekitUrl,
			},
		})
	})

	g.Get("/sessions", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		res, err := videoClient.GetSessionList(c.Context(), &videov1.GetSessionListRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "session list retrieved",
			"data":    res.Sessions,
		})
	})
}
