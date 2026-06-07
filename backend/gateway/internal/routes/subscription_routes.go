package routes

import (
	"time"

	"github.com/gofiber/fiber/v2"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	subv1 "github.com/akhilbabu26/jinnx/proto/subscription/v1"
	apperr "github.com/akhilbabu26/jinnx/shared/errors"
	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/gateway/internal/middleware"
)

func RegisterSubscriptionRoutes(api fiber.Router, subClient subv1.SubscriptionServiceClient, authClient authv1.AuthServiceClient, jwtSecret string, redisClient *cache.RedisClient) {
	g := api.Group("/subscription",
		middleware.JWTMiddleware(jwtSecret, authClient, redisClient),
		middleware.RequireApproved(),
	)

	g.Get("/", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		res, err := subClient.GetSubscription(c.Context(), &subv1.GetSubscriptionRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		var periodEnd *time.Time
		if res.CurrentPeriodEnd != nil {
			t := res.CurrentPeriodEnd.AsTime()
			periodEnd = &t
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "subscription status retrieved",
			"data": fiber.Map{
				"status":             res.Status,
				"current_period_end": periodEnd,
				"razorpay_sub_id":    res.RazorpaySubId,
				"is_active":          res.IsActive,
			},
		})
	})

	g.Post("/razorpay", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		res, err := subClient.CreateRazorpaySubscription(c.Context(), &subv1.CreateRazorpaySubscriptionRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "razorpay checkout session created",
			"data": fiber.Map{
				"subscription_id": res.SubscriptionId,
				"key_id":          res.KeyId,
			},
		})
	})

	// Webhook is unauthenticated — registered on root api group
	api.Post("/subscription/webhook", func(c *fiber.Ctx) error {
		signature := c.Get("X-Razorpay-Signature")
		payload := c.Body()

		_, err := subClient.HandleWebhook(c.Context(), &subv1.HandleWebhookRequest{
			Signature: signature,
			Payload:   payload,
		})
		if err != nil {
			return c.SendStatus(400)
		}
		return c.SendStatus(200)
	})
}
