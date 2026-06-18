package routes

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	apperr "github.com/akhilbabu26/jinnx/shared/errors"
	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/shared/jwt"
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

	// ── POST /auth/register ──────────────────────────────────────────────────
	g.Post("/register", func(c *fiber.Ctx) error {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
			Name     string `json:"name"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

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

	// ── POST /auth/verify-otp ────────────────────────────────────────────────
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

	// ── POST /auth/resend-otp ────────────────────────────────────────────────
	g.Post("/resend-otp", func(c *fiber.Ctx) error {
		var req struct {
			Email string `json:"email"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

		req.Email = strings.TrimSpace(req.Email)
		if req.Email == "" || !strings.Contains(req.Email, "@") {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "a valid email address is required"})
		}

		res, err := authClient.ResendOTP(c.Context(), &authv1.ResendOTPRequest{
			Email: req.Email,
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

	// ── POST /auth/login ─────────────────────────────────────────────────────
	// Sets the refresh token as an HttpOnly cookie (never accessible from JS).
	// Returns access_token + minimal user object in the JSON body.
	g.Post("/login", func(c *fiber.Ctx) error {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

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

		// Store refresh token in HttpOnly cookie — never exposed to client JS
		c.Cookie(&fiber.Cookie{
			Name:     "refresh_token",
			Value:    res.RefreshToken,
			HTTPOnly: true,
			Secure:   false, // Set to true in production (HTTPS)
			SameSite: "Lax",
			MaxAge:   60 * 60 * 24 * 30, // 30 days
			Path:     "/",
		})

		return c.JSON(fiber.Map{
			"success": true,
			"message": "login successful",
			"data": fiber.Map{
				"access_token": res.AccessToken,
				"user": fiber.Map{
					"id":   res.UserId,
					"role": res.Role,
				},
			},
		})
	})

	// ── POST /auth/refresh ───────────────────────────────────────────────────
	// Validates the HttpOnly refresh_token cookie.
	// Issues a fresh short-lived access token and returns the full user profile.
	// Called by the axios 401 interceptor and by checkAuth on every app load.
	g.Post("/refresh", func(c *fiber.Ctx) error {
		refreshToken := c.Cookies("refresh_token")
		if refreshToken == "" {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "no refresh token present"})
		}

		// Validate the refresh token JWT signature + expiry
		claims, err := jwt.ValidateToken(refreshToken, jwtSecret)
		if err != nil {
			// Clear stale / expired cookie
			c.Cookie(&fiber.Cookie{
				Name:     "refresh_token",
				Value:    "",
				HTTPOnly: true,
				MaxAge:   -1,
				Path:     "/",
			})
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "refresh token expired or invalid"})
		}

		// Fetch the latest profile — status may have changed since token was issued
		profile, err := authClient.GetUserProfile(c.Context(), &authv1.GetUserProfileRequest{
			UserId: uint32(claims.UserID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		// Issue a new 15-minute access token
		newAccessToken, err := jwt.GenerateAccessToken(
			claims.UserID,
			claims.Email,
			profile.Role,
			jwtSecret,
			15*time.Minute,
		)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "failed to issue new token"})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "token refreshed",
			"data": fiber.Map{
				"access_token": newAccessToken,
				"user": fiber.Map{
					"id":     profile.Id,
					"role":   profile.Role,
					"name":   profile.Name,
					"email":  profile.Email,
					"status": profile.Status,
				},
			},
		})
	})

	// ── POST /auth/logout ────────────────────────────────────────────────────
	// Clears the refresh token cookie server-side. Access token expires naturally.
	g.Post("/logout", func(c *fiber.Ctx) error {
		c.Cookie(&fiber.Cookie{
			Name:     "refresh_token",
			Value:    "",
			HTTPOnly: true,
			Secure:   false,
			SameSite: "Lax",
			MaxAge:   -1,
			Path:     "/",
		})
		return c.JSON(fiber.Map{"success": true, "message": "logged out successfully"})
	})

	// ── POST /auth/forgot-password ───────────────────────────────────────────
	g.Post("/forgot-password", func(c *fiber.Ctx) error {
		var req struct {
			Email string `json:"email"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

		req.Email = strings.TrimSpace(req.Email)
		if req.Email == "" || !strings.Contains(req.Email, "@") {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "a valid email address is required"})
		}

		res, err := authClient.ForgotPassword(c.Context(), &authv1.ForgotPasswordRequest{
			Email: req.Email,
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

	// ── POST /auth/reset-password ────────────────────────────────────────────
	g.Post("/reset-password", func(c *fiber.Ctx) error {
		var req struct {
			Email           string `json:"email"`
			Code            string `json:"code"`
			NewPassword     string `json:"new_password"`
			ConfirmPassword string `json:"confirm_password"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

		req.Email = strings.TrimSpace(req.Email)
		req.Code = strings.TrimSpace(req.Code)
		if req.Email == "" || req.Code == "" {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "email and verification code are required"})
		}

		if len(req.NewPassword) < 8 {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "new password must be at least 8 characters"})
		}

		if req.NewPassword != req.ConfirmPassword {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "passwords do not match"})
		}

		res, err := authClient.ResetPassword(c.Context(), &authv1.ResetPasswordRequest{
			Email:       req.Email,
			Code:        req.Code,
			NewPassword: req.NewPassword,
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

	// ── GET /auth/me ─────────────────────────────────────────────────────────
	// Returns the authenticated user's full profile.
	// Also reachable at GET /users/me — registered in RegisterUserRoutes below.
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

// RegisterUserRoutes adds /users/* routes that mirror /auth/* for frontend compatibility.
// The frontend calls GET /users/me — this wires it to the same GetUserProfile handler.
func RegisterUserRoutes(api fiber.Router, authClient authv1.AuthServiceClient, jwtSecret string, redisClient *cache.RedisClient) {
	g := api.Group("/users", middleware.JWTMiddleware(jwtSecret, authClient, redisClient))

	// GET /users/me — exact path expected by userApi.getProfile() on the frontend
	g.Get("/me", func(c *fiber.Ctx) error {
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
