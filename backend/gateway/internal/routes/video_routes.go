package routes

import (
	"strconv"

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

	// POST /api/v1/video/token — generate token (legacy, left for backwards compatibility)
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

	// GET /api/v1/video/token/:room — generate token for a specific room name
	g.Get("/token/:room", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		role := c.Locals("role").(string)
		roomName := c.Params("room")

		isAdmin := (role == "admin")

		res, err := videoClient.GenerateToken(c.Context(), &videov1.GenerateTokenRequest{
			UserId:   uint32(userID),
			RoomName: roomName,
			IsAdmin:  isAdmin,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "token generated",
			"data": fiber.Map{
				"token":       res.Token,
				"livekit_url": res.LivekitUrl,
			},
		})
	})

	// GET /api/v1/video/sessions — list history of sessions
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

	// POST /api/v1/video/room/create — admin only, start consultation room
	g.Post("/room/create", middleware.RequireAdmin(), func(c *fiber.Ctx) error {
		adminID := c.Locals("userID").(uint)
		var req struct {
			UserID uint32 `json:"user_id"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid body"})
		}

		res, err := videoClient.CreateRoom(c.Context(), &videov1.CreateRoomRequest{
			AdminId: uint32(adminID),
			UserId:  req.UserID,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success":    true,
			"room_name":  res.RoomName,
			"session_id": res.SessionId,
		})
	})

	// POST /api/v1/video/room/:id/end — admin only, end consultation room
	g.Post("/room/:id/end", middleware.RequireAdmin(), func(c *fiber.Ctx) error {
		adminID := c.Locals("userID").(uint)
		idStr := c.Params("id")
		sessionID, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid session id"})
		}

		_, err = videoClient.EndSession(c.Context(), &videov1.EndSessionRequest{
			AdminId:   uint32(adminID),
			SessionId: uint32(sessionID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{"success": true, "message": "video session ended"})
	})
}
