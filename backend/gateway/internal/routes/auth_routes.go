package routes

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	apperr "github.com/akhilbabu26/jinnx/shared/errors"
	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/gateway/internal/middleware"
)

func RegisterAuthRoutes(api fiber.Router, authClient authv1.AuthServiceClient, jwtSecret string, redisClient *cache.RedisClient) {
	g := api.Group("/auth", limiter.New(limiter.Config{
		Max:        10,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string { return c.IP() },
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"message": "too many requests, please slow down",
				"code":    "RATE_LIMITED",
			})
		},
	}))

	g.Post("/register", func(c *fiber.Ctx) error {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
			Name     string `json:"name"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

		// Input validation
		req.Email = strings.TrimSpace(req.Email)
		req.Name = strings.TrimSpace(req.Name)
		switch {
		case req.Email == "" || !strings.Contains(req.Email, "@"):
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "a valid email address is required"})
		case len(req.Password) < 8:
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "password must be at least 8 characters"})
		case req.Name == "":
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "name is required"})
		}

		res, err := authClient.Register(c.Context(), &authv1.RegisterRequest{
			Email:    req.Email,
			Password: req.Password,
			Name:     req.Name,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": res.Message,
			"data": fiber.Map{
				"user_id": res.UserId,
				"status":  res.Status,
			},
		})
	})

	g.Post("/verify-otp", func(c *fiber.Ctx) error {
		var req struct {
			Email string `json:"email"`
			Code  string `json:"code"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

		req.Email = strings.TrimSpace(req.Email)
		req.Code = strings.TrimSpace(req.Code)
		if req.Email == "" || req.Code == "" {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "email and verification code are required"})
		}

		res, err := authClient.VerifyOTP(c.Context(), &authv1.VerifyOTPRequest{
			Email: req.Email,
			Code:  req.Code,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": res.Success,
			"message": res.Message,
		})
	})

	g.Post("/login", func(c *fiber.Ctx) error {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

		// Input validation
		if strings.TrimSpace(req.Email) == "" || strings.TrimSpace(req.Password) == "" {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "email and password are required"})
		}

		res, err := authClient.Login(c.Context(), &authv1.LoginRequest{
			Email:    req.Email,
			Password: req.Password,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "login successful",
			"data": fiber.Map{
				"access_token":  res.AccessToken,
				"refresh_token": res.RefreshToken,
				"user": fiber.Map{
					"id":   res.UserId,
					"role": res.Role,
				},
			},
		})
	})

	g.Get("/me", middleware.JWTMiddleware(jwtSecret, authClient, redisClient), func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		res, err := authClient.GetUserProfile(c.Context(), &authv1.GetUserProfileRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "user profile retrieved",
			"data": fiber.Map{
				"id":     res.Id,
				"name":   res.Name,
				"email":  res.Email,
				"role":   res.Role,
				"status": res.Status,
			},
		})
	})
}
