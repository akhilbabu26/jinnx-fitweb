package routes

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	subv1 "github.com/akhilbabu26/jinnx/proto/subscription/v1"
	workoutv1 "github.com/akhilbabu26/jinnx/proto/workout/v1"
	apperr "github.com/akhilbabu26/jinnx/shared/errors"
	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/gateway/internal/middleware"
)

func RegisterWorkoutRoutes(
	api fiber.Router,
	workoutClient workoutv1.WorkoutServiceClient,
	authClient authv1.AuthServiceClient,
	subClient subv1.SubscriptionServiceClient,
	jwtSecret string,
	redisClient *cache.RedisClient,
) {
	g := api.Group("/workouts",
		middleware.JWTMiddleware(jwtSecret, authClient, redisClient),
		middleware.RequireApproved(),
	)

	g.Get("/courses", func(c *fiber.Ctx) error {
		res, err := workoutClient.GetCourses(c.Context(), &workoutv1.GetCoursesRequest{})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{"success": true, "message": "courses retrieved", "data": res.Courses})
	})

	g.Get("/course/enrolled", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		res, err := workoutClient.GetEnrolledCourse(c.Context(), &workoutv1.GetEnrolledCourseRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		if !res.IsEnrolled {
			return c.JSON(fiber.Map{"success": true, "data": nil})
		}
		return c.JSON(fiber.Map{"success": true, "message": "enrolled course retrieved", "data": res})
	})

	g.Post("/course/:courseID/enroll", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		courseID, err := c.ParamsInt("courseID")
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid course ID"})
		}

		var req struct {
			OnboardingData map[string]interface{} `json:"onboarding_data"`
		}
		_ = c.BodyParser(&req)
		onboardingJSON, _ := json.Marshal(req.OnboardingData)

		res, err := workoutClient.Enroll(c.Context(), &workoutv1.EnrollRequest{
			UserId:             uint32(userID),
			CourseId:           uint32(courseID),
			OnboardingDataJson: string(onboardingJSON),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{"success": true, "message": res.Message})
	})

	g.Post("/course/cancel", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		_, err := workoutClient.CancelEnrollment(c.Context(), &workoutv1.CancelEnrollmentRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{"success": true, "message": "program cancelled"})
	})

	g.Get("/today", middleware.RequireActiveSubscription(subClient), func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		res, err := workoutClient.GetTodayWorkout(c.Context(), &workoutv1.GetTodayWorkoutRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{"success": true, "message": "today's workout retrieved", "data": res})
	})

	g.Get("/history", middleware.RequireActiveSubscription(subClient), func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		res, err := workoutClient.GetWorkoutHistory(c.Context(), &workoutv1.GetWorkoutHistoryRequest{
			UserId: uint32(userID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{"success": true, "message": "workout history retrieved", "data": res.Logs})
	})

	g.Post("/day/:dayID/complete", middleware.RequireActiveSubscription(subClient), func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(uint)
		dayID, err := c.ParamsInt("dayID")
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid day ID"})
		}
		_, err = workoutClient.CompleteWorkoutDay(c.Context(), &workoutv1.CompleteWorkoutDayRequest{
			UserId: uint32(userID),
			DayId:  uint32(dayID),
		})
		if err != nil {
			appErr := apperr.FromGRPCError(err)
			return c.Status(appErr.Code).JSON(fiber.Map{"success": false, "message": appErr.Message})
		}
		return c.JSON(fiber.Map{"success": true, "message": "day completed successfully"})
	})
}
