package middleware

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	subv1 "github.com/akhilbabu26/jinnx/proto/subscription/v1"
	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/shared/jwt"
)

// cachedProfile is the shape stored in Redis for each user.
// Kept small — only what the gateway needs to gate requests.
type cachedProfile struct {
	ID     uint32 `json:"id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Status string `json:"status"`
}

// profileCacheTTL is the maximum age of a cached profile.
// Active invalidation (via cache.Delete) means stale entries are rare;
// this TTL acts as a safety net for Redis restarts or missed invalidations.
const profileCacheTTL = 5 * time.Minute

// JWTMiddleware validates the Bearer token and loads user claims into locals.
// On a cache miss it calls the auth service and caches the result.
// Pass a nil redisClient to disable caching (useful in tests).
func JWTMiddleware(jwtSecret string, authClient authv1.AuthServiceClient, redisClient *cache.RedisClient) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "missing authorization header"})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "invalid authorization header format"})
		}

		claims, err := jwt.ValidateToken(parts[1], jwtSecret)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "invalid or expired token"})
		}

		profile, err := resolveProfile(c.Context(), claims.UserID, authClient, redisClient)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		c.Locals("userID", uint(profile.ID))
		c.Locals("email", profile.Email)
		c.Locals("role", profile.Role)
		c.Locals("status", profile.Status)

		return c.Next()
	}
}

// resolveProfile returns the user profile from Redis cache, falling back to
// the auth gRPC service on a cache miss. The result is cached for profileCacheTTL.
func resolveProfile(ctx context.Context, userID uint, authClient authv1.AuthServiceClient, redisClient *cache.RedisClient) (*cachedProfile, error) {
	key := cache.UserProfileKey(uint32(userID))

	// ── Cache HIT ────────────────────────────────────────────────────────────
	if redisClient != nil {
		var p cachedProfile
		if err := redisClient.GetJSON(ctx, key, &p); err == nil {
			return &p, nil
		} else if !errors.Is(err, cache.ErrCacheMiss) {
			// Redis error (connection issue etc.) — log and fall through to gRPC
			fmt.Printf("[cache] warning: GetJSON %q: %v\n", key, err)
		}
	}

	// ── Cache MISS → call auth service ───────────────────────────────────────
	res, err := authClient.GetUserProfile(ctx, &authv1.GetUserProfileRequest{
		UserId: uint32(userID),
	})
	if err != nil {
		return nil, fmt.Errorf("auth service unavailable: %w", err)
	}

	p := &cachedProfile{
		ID:     res.Id,
		Email:  res.Email,
		Role:   res.Role,
		Status: res.Status,
	}

	// Store in cache (best-effort — don't fail the request on a cache write error)
	if redisClient != nil {
		if err := redisClient.SetJSON(ctx, key, p, profileCacheTTL); err != nil {
			fmt.Printf("[cache] warning: SetJSON %q: %v\n", key, err)
		}
	}

	return p, nil
}

// RequireApproved blocks access until the trainer has approved the account.
func RequireApproved() fiber.Handler {
	return func(c *fiber.Ctx) error {
		status, ok := c.Locals("status").(string)
		if !ok || status != "approved" {
			return c.Status(403).JSON(fiber.Map{
				"success": false,
				"message": "your account is pending trainer approval",
				"code":    "PENDING_APPROVAL",
			})
		}
		return c.Next()
	}
}

// RequireActiveSubscription checks that the user has an active or trial subscription.
func RequireActiveSubscription(subClient subv1.SubscriptionServiceClient) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		res, err := subClient.GetSubscription(c.Context(), &subv1.GetSubscriptionRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "failed to verify subscription"})
		}

		if !res.IsActive {
			return c.Status(403).JSON(fiber.Map{
				"success": false,
				"message": "an active subscription is required to access this content",
				"code":    "SUBSCRIPTION_REQUIRED",
			})
		}

		return c.Next()
	}
}
