package routes

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"

	chatv1 "github.com/akhilbabu26/jinnx/proto/chat/v1"
	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	"github.com/akhilbabu26/jinnx/gateway/internal/hub"
	"github.com/akhilbabu26/jinnx/gateway/internal/middleware"
	"github.com/akhilbabu26/jinnx/shared/cache"
)

// wsFrame is the shape of messages sent FROM the browser over WebSocket.
// e.g. {"action":"chat","message":"How many reps should I do?"}
type wsFrame struct {
	Action  string `json:"action"`
	Message string `json:"message"`
}

// wsReply is sent back to the browser.
type wsReply struct {
	Type           string `json:"type"`
	Reply          string `json:"reply,omitempty"`
	RemainingLimit int32  `json:"remaining_limit,omitempty"`
	Error          string `json:"error,omitempty"`
}

// RegisterWSRoutes sets up the WebSocket upgrade endpoint at /ws
// Connection URL: ws://host/ws?token=<jwt>
func RegisterWSRoutes(
	app *fiber.App,
	h *hub.Hub,
	jwtSecret string,
	authClient authv1.AuthServiceClient,
	chatClient chatv1.ChatServiceClient,
	redisClient *cache.RedisClient,
) {
	// Step 1: Validate JWT token from query param before upgrading.
	// Browser WebSocket API cannot set custom headers,
	// so the token is passed as: ws://host/ws?token=<jwt>
	app.Use("/ws", func(c *fiber.Ctx) error {
		token := c.Query("token")
		if token == "" {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"message": "missing token query param",
			})
		}
		// Inject into Authorization header so JWTMiddleware can read it normally
		c.Request().Header.Set("Authorization", "Bearer "+token)
		return c.Next()
	})

	// Step 2: Run JWT + profile resolution middleware
	app.Use("/ws", middleware.JWTMiddleware(jwtSecret, authClient, redisClient))

	// Step 3: WebSocket upgrade handler
	app.Get("/ws", websocket.New(func(c *websocket.Conn) {
		userID  := c.Locals("userID").(uint)
		role    := c.Locals("role").(string)
		isAdmin := role == "admin"

		// Register connection in the hub
		h.Register(userID, isAdmin, c)
		defer h.Unregister(userID, isAdmin, c)

		log.Printf("[ws] client connected: userID=%d isAdmin=%v", userID, isAdmin)

		// Read loop — handles incoming frames from browser
		for {
			_, raw, err := c.ReadMessage()
			if err != nil {
				log.Printf("[ws] client disconnected: userID=%d err=%v", userID, err)
				break
			}

			var frame wsFrame
			if err := json.Unmarshal(raw, &frame); err != nil {
				// Not a JSON frame (e.g. ping) — ignore silently
				continue
			}

			switch frame.Action {

			case "chat":
				// Forward to Claude via gRPC, send reply back over same WS connection
				if chatClient == nil {
					sendWSReply(c, wsReply{Type: "chat_error", Error: "chat service unavailable"})
					continue
				}
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				res, err := chatClient.SendMessage(ctx, &chatv1.SendMessageRequest{
					UserId:  uint32(userID),
					Message: frame.Message,
				})
				if err != nil {
					cancel()
					sendWSReply(c, wsReply{Type: "chat_error", Error: err.Error()})
					continue
				}
				cancel()
				sendWSReply(c, wsReply{
					Type:           "chat_reply",
					Reply:          res.Reply,
					RemainingLimit: res.RemainingLimit,
				})

			default:
				// Unknown action — ignore
			}
		}
	}))
}

func sendWSReply(c *websocket.Conn, reply wsReply) {
	b, _ := json.Marshal(reply)
	if err := c.WriteMessage(websocket.TextMessage, b); err != nil {
		log.Printf("[ws] write error: %v", err)
	}
}