package routes

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	workoutv1 "github.com/akhilbabu26/jinnx/proto/workout/v1"
	apperr "github.com/akhilbabu26/jinnx/shared/errors"
	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/gateway/internal/middleware"
)

// RegisterAdminRoutes mounts all admin-only endpoints under /api/admin.
// Every route requires a valid JWT with role="admin".
func RegisterAdminRoutes(
	api fiber.Router,
	authClient authv1.AuthServiceClient,
	workoutClient workoutv1.WorkoutServiceClient,
	jwtSecret string,
	redisClient *cache.RedisClient,
) {
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

	// POST /api/admin/users/:id/plan/week — create custom week for user
	admin.Post("/users/:id/plan/week", func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
		}

		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		var req struct {
			CourseID   uint32 `json:"course_id"`
			WeekNumber int32  `json:"week_number"`
			Title      string `json:"title"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid body"})
		}

		res, err := workoutClient.CreateUserWeek(c.Context(), &workoutv1.CreateUserWeekRequest{
			AdminId:    uint32(adminID),
			UserId:     uint32(id),
			CourseId:   req.CourseID,
			WeekNumber: req.WeekNumber,
			Title:      req.Title,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success":          true,
			"assigned_week_id": res.AssignedWeekId,
		})
	})

	// POST /api/admin/users/plan/day — create custom day for assigned week
	admin.Post("/users/plan/day", func(c *fiber.Ctx) error {
		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		var req struct {
			AssignedWeekID uint32 `json:"assigned_week_id"`
			DayNumber      int32  `json:"day_number"`
			Title          string `json:"title"`
			IsRestDay      bool   `json:"is_rest_day"`
			AdminNotes     string `json:"admin_notes"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid body"})
		}

		res, err := workoutClient.CreateUserDay(c.Context(), &workoutv1.CreateUserDayRequest{
			AdminId:        uint32(adminID),
			AssignedWeekId: req.AssignedWeekID,
			DayNumber:      req.DayNumber,
			Title:          req.Title,
			IsRestDay:      req.IsRestDay,
			AdminNotes:     req.AdminNotes,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success":         true,
			"assigned_day_id": res.AssignedDayId,
		})
	})

	// POST /api/admin/users/plan/exercise — create custom exercise for assigned day
	admin.Post("/users/plan/exercise", func(c *fiber.Ctx) error {
		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		var req struct {
			AssignedDayID uint32 `json:"assigned_day_id"`
			Exercise      struct {
				Name            string `json:"name"`
				Sets            int32  `json:"sets"`
				Reps            string `json:"reps"`
				Weight          string `json:"weight"`
				VideoUrl        string `json:"video_url"`
				Target          string `json:"target"`
				EquipmentNeeded string `json:"equipment_needed"`
				OrderIndex      int32  `json:"order_index"`
			} `json:"exercise"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid body"})
		}

		res, err := workoutClient.CreateUserExercise(c.Context(), &workoutv1.CreateUserExerciseRequest{
			AdminId:       uint32(adminID),
			AssignedDayId: req.AssignedDayID,
			Exercise: &workoutv1.AdminExercise{
				Name:            req.Exercise.Name,
				Sets:            req.Exercise.Sets,
				Reps:            req.Exercise.Reps,
				Weight:          req.Exercise.Weight,
				VideoUrl:        req.Exercise.VideoUrl,
				Target:          req.Exercise.Target,
				EquipmentNeeded: req.Exercise.EquipmentNeeded,
				OrderIndex:      req.Exercise.OrderIndex,
			},
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success":     true,
			"exercise_id": res.ExerciseId,
		})
	})

	// PUT /api/admin/users/plan/exercise/:exerciseID — update custom exercise
	admin.Put("/users/plan/exercise/:exerciseID", func(c *fiber.Ctx) error {
		exIDStr := c.Params("exerciseID")
		exerciseID, err := strconv.ParseUint(exIDStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid exercise id"})
		}

		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		var req struct {
			Exercise struct {
				Name            string `json:"name"`
				Sets            int32  `json:"sets"`
				Reps            string `json:"reps"`
				Weight          string `json:"weight"`
				VideoUrl        string `json:"video_url"`
				Target          string `json:"target"`
				EquipmentNeeded string `json:"equipment_needed"`
				OrderIndex      int32  `json:"order_index"`
			} `json:"exercise"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid body"})
		}

		_, err = workoutClient.UpdateUserExercise(c.Context(), &workoutv1.UpdateUserExerciseRequest{
			AdminId:    uint32(adminID),
			ExerciseId: uint32(exerciseID),
			Exercise: &workoutv1.AdminExercise{
				Name:            req.Exercise.Name,
				Sets:            req.Exercise.Sets,
				Reps:            req.Exercise.Reps,
				Weight:          req.Exercise.Weight,
				VideoUrl:        req.Exercise.VideoUrl,
				Target:          req.Exercise.Target,
				EquipmentNeeded: req.Exercise.EquipmentNeeded,
				OrderIndex:      req.Exercise.OrderIndex,
			},
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{"success": true, "message": "exercise updated"})
	})

	// DELETE /api/admin/users/plan/exercise/:exerciseID — delete custom exercise
	admin.Delete("/users/plan/exercise/:exerciseID", func(c *fiber.Ctx) error {
		exIDStr := c.Params("exerciseID")
		exerciseID, err := strconv.ParseUint(exIDStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid exercise id"})
		}

		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		_, err = workoutClient.DeleteUserExercise(c.Context(), &workoutv1.DeleteUserExerciseRequest{
			AdminId:    uint32(adminID),
			ExerciseId: uint32(exerciseID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{"success": true, "message": "exercise deleted"})
	})

	// POST /api/admin/users/:id/plan/day/:dayID/feedback — add feedback
	admin.Post("/users/:id/plan/day/:dayID/feedback", func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
		}

		dayIDStr := c.Params("dayID")
		dayID, err := strconv.ParseUint(dayIDStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid day id"})
		}

		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		var req struct {
			FeedbackText string `json:"feedback_text"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid body"})
		}

		_, err = workoutClient.AddDayFeedback(c.Context(), &workoutv1.AddDayFeedbackRequest{
			AdminId:        uint32(adminID),
			UserId:         uint32(id),
			AssignedDayId:  uint32(dayID),
			FeedbackText:   req.FeedbackText,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{"success": true, "message": "feedback added"})
	})

	// GET /api/admin/users/:id/plan — get custom user plan
	admin.Get("/users/:id/plan", func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
		}

		res, err := workoutClient.GetUserPlan(c.Context(), &workoutv1.GetUserPlanRequest{
			UserId: uint32(id),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"data":    res.Weeks,
		})
	})

	// PUT /api/admin/users/:id/video-access — toggle video access per user
	admin.Put("/users/:id/video-access", func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
		}

		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		var req struct {
			Enabled bool `json:"enabled"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid body"})
		}

		_, err = workoutClient.ToggleUserVideoAccess(c.Context(), &workoutv1.ToggleUserVideoAccessRequest{
			AdminId: uint32(adminID),
			UserId:  uint32(id),
			Enabled: req.Enabled,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{"success": true, "message": "video access toggled successfully"})
	})

	// GET /api/admin/users/trial-expiring — list trial expiring users
	admin.Get("/users/trial-expiring", func(c *fiber.Ctx) error {
		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		res, err := workoutClient.ListTrialExpiringUsers(c.Context(), &workoutv1.ListTrialExpiringUsersRequest{
			AdminId: uint32(adminID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"data":    res.Users,
		})
	})

	// GET /api/admin/users/:id/enrollment — get user's enrolled course and onboarding details
	admin.Get("/users/:id/enrollment", func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
		}

		res, err := workoutClient.GetEnrolledCourse(c.Context(), &workoutv1.GetEnrolledCourseRequest{
			UserId: uint32(id),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"data":    res,
		})
	})

	// POST /api/v1/admin/tasks — assign task to a user
	admin.Post("/tasks", func(c *fiber.Ctx) error {
		adminID := c.Locals("userID").(uint)
		var req struct {
			UserID      uint32 `json:"user_id"`
			Title       string `json:"title"`
			Description string `json:"description"`
			DueDate     string `json:"due_date"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

		res, err := authClient.AssignTask(c.Context(), &authv1.AssignTaskRequest{
			AdminId:     uint32(adminID),
			UserId:      req.UserID,
			Title:       req.Title,
			Description: req.Description,
			DueDate:     req.DueDate,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"task_id": res.TaskId,
			},
		})
	})

	// DELETE /api/v1/admin/tasks/:id — delete an assigned task
	admin.Delete("/tasks/:id", func(c *fiber.Ctx) error {
		adminID := c.Locals("userID").(uint)
		idStr := c.Params("id")
		taskID, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid task id"})
		}

		_, err = authClient.DeleteTask(c.Context(), &authv1.DeleteTaskRequest{
			AdminId: uint32(adminID),
			TaskId:  uint32(taskID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "task deleted successfully",
		})
	})

	// GET /api/v1/admin/users/:id/tasks — list tasks for a specific user (admin view)
	admin.Get("/users/:id/tasks", func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		userID, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
		}

		res, err := authClient.GetTrainerTasks(c.Context(), &authv1.GetTrainerTasksRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		tasks := make([]fiber.Map, 0, len(res.Tasks))
		for _, t := range res.Tasks {
			tasks = append(tasks, fiber.Map{
				"id":          t.Id,
				"title":       t.Title,
				"description": t.Description,
				"status":      t.Status,
				"due_date":    t.DueDate,
			})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"data":    tasks,
		})
	})

	// GET /api/v1/admin/users/:id/workouts/pdf — generate a mock workout PDF report
	admin.Get("/users/:id/workouts/pdf", func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		_, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
		}

		// Placeholder report layout
		mockPDFURL := "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
		
		return c.JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"pdf_url": mockPDFURL,
			},
		})
	})

	// PATCH /api/admin/users/:id/level — set user's workout level
	admin.Patch("/users/:id/level", func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid user id"})
		}

		adminID, ok := c.Locals("userID").(uint)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "unauthorized"})
		}

		var req struct {
			Level string `json:"level"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid body"})
		}

		res, err := workoutClient.SetUserLevel(c.Context(), &workoutv1.SetUserLevelRequest{
			AdminId: uint32(adminID),
			UserId:  uint32(id),
			Level:   req.Level,
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		return c.JSON(fiber.Map{
			"success": res.Success,
		})
	})

	// PATCH /api/admin/users/:id/re-approve — re-approve a user
	admin.Patch("/users/:id/re-approve", func(c *fiber.Ctx) error {
		return updateStatus(c, authClient, "pending_approval")
	})

	// GET /api/admin/users/rejected — list all rejected users
	// Reuses ListAllUsers and filters client-side (no extra gRPC required)
	admin.Get("/users/rejected", func(c *fiber.Ctx) error {
		res, err := authClient.ListAllUsers(c.Context(), &authv1.ListAllUsersRequest{})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		users := make([]fiber.Map, 0)
		for _, u := range res.Users {
			if u.Status == "rejected" {
				users = append(users, fiber.Map{
					"id":         u.Id,
					"email":      u.Email,
					"name":       u.Name,
					"role":       u.Role,
					"status":     u.Status,
					"created_at": u.CreatedAt,
				})
			}
		}

		return c.JSON(fiber.Map{"success": true, "data": users})
	})

	// GET /api/admin/tasks — all assigned tasks across all users
	// Re-uses GetTrainerTasks with userID=0 sentinel; the frontend uses this
	// on the admin dashboard "Tasks" panel to see all outstanding tasks.
	// Since the current gRPC only supports per-user fetch, we call ListAllUsers
	// first then aggregate — OR we return a simple proxy to the auth client.
	// For now we forward to GetTrainerTasks with adminID as a placeholder until
	// a dedicated ListAllTasks RPC is added.
	admin.Get("/tasks", func(c *fiber.Ctx) error {
		adminID := c.Locals("userID").(uint)
		// Fetch tasks assigned by this admin (user_id = admin's own ID is a
		// convention workaround until a ListAllTasks RPC exists)
		res, err := authClient.GetTrainerTasks(c.Context(), &authv1.GetTrainerTasksRequest{
			UserId: uint32(adminID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}

		tasks := make([]fiber.Map, 0, len(res.Tasks))
		for _, t := range res.Tasks {
			tasks = append(tasks, fiber.Map{
				"id":          t.Id,
				"title":       t.Title,
				"description": t.Description,
				"status":      t.Status,
				"due_date":    t.DueDate,
			})
		}

		return c.JSON(fiber.Map{"success": true, "data": tasks})
	})

	// GET /api/admin/courses — list all courses (same as user-facing but admin-scoped)
	admin.Get("/courses", func(c *fiber.Ctx) error {
		res, err := workoutClient.GetCourses(c.Context(), &workoutv1.GetCoursesRequest{})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{"success": true, "data": res.Courses})
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