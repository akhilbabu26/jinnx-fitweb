package routes

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	apperr "github.com/akhilbabu26/jinnx/shared/errors"
	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/gateway/internal/middleware"
)

// RegisterAdminRoutes mounts all admin-only endpoints under /api/admin.
// Every route requires a valid JWT with role="admin".
func RegisterAdminRoutes(api fiber.Router, authClient authv1.AuthServiceClient, jwtSecret string, redisClient *cache.RedisClient) {
	admin := api.Group("/admin",
		middleware.JWTMiddleware(jwtSecret, authClient, redisClient),
		middleware.RequireAdmin(),
	)

	// GET /api/admin/users/pending — list all users waiting for approval
	admin.Get("/users/pending", func(c *fiber.Ctx) error {
		res, err := authClient.ListPendingUsers(c.Context(), &authv1.ListPendingUsersRequest{})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		users := make([]fiber.Map, 0, len(res.Users))
		for _, u := range res.Users {
			users = append(users, fiber.Map{
				"id":         u.Id,
				"email":      u.Email,
				"name":       u.Name,
				"role":       u.Role,
				"status":     u.Status,
				"created_at": u.CreatedAt,
			})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"data":    users,
		})
	})

	// PUT /api/admin/users/:id/approve — approve a pending user
	admin.Put("/users/:id/approve", func(c *fiber.Ctx) error {
		return updateStatus(c, authClient, "approved")
	})

	// PUT /api/admin/users/:id/reject — reject a pending user
	admin.Put("/users/:id/reject", func(c *fiber.Ctx) error {
		return updateStatus(c, authClient, "rejected")
	})

	// GET /api/admin/users — list all users
	admin.Get("/users", func(c *fiber.Ctx) error {
		res, err := authClient.ListAllUsers(c.Context(), &authv1.ListAllUsersRequest{})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		users := make([]fiber.Map, 0, len(res.Users))
		for _, u := range res.Users {
			users = append(users, fiber.Map{
				"id":         u.Id,
				"email":      u.Email,
				"name":       u.Name,
				"role":       u.Role,
				"status":     u.Status,
				"created_at": u.CreatedAt,
			})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"data":    users,
		})
	})

	// PUT /api/admin/users/:id/block — block a user
	admin.Put("/users/:id/block", func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
		}

		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		res, err := authClient.BlockUser(c.Context(), &authv1.BlockUserRequest{
			AdminId: uint32(adminID),
			UserId:  uint32(id),
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

	// PUT /api/admin/users/:id/unblock — unblock a user
	admin.Put("/users/:id/unblock", func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
		}

		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		res, err := authClient.UnblockUser(c.Context(), &authv1.UnblockUserRequest{
			AdminId: uint32(adminID),
			UserId:  uint32(id),
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
}

func updateStatus(c *fiber.Ctx, authClient authv1.AuthServiceClient, newStatus string) error {
	idStr := c.Params("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
	}

	adminID, ok := c.Locals("userID").(uint)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
	}

	res, err := authClient.UpdateUserStatus(c.Context(), &authv1.UpdateUserStatusRequest{
		UserId:  uint32(id),
		Status:  newStatus,
		AdminId: uint32(adminID),
	})
	if err != nil {
		appErr := apperr.FromGRPCError(err)
		return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
	}

	return c.JSON(fiber.Map{
		"success": res.Success,
		"message": res.Message,
	})
}

