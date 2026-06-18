package main

import (
	"context"
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/akhilbabu26/jinnx/gateway/internal/hub"
	"github.com/akhilbabu26/jinnx/gateway/internal/routes"
	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/shared/config"
	"github.com/akhilbabu26/jinnx/shared/kafka"

	authv1    "github.com/akhilbabu26/jinnx/proto/auth/v1"
	chatv1    "github.com/akhilbabu26/jinnx/proto/chat/v1"
	subv1     "github.com/akhilbabu26/jinnx/proto/subscription/v1"
	videov1   "github.com/akhilbabu26/jinnx/proto/video/v1"
	workoutv1 "github.com/akhilbabu26/jinnx/proto/workout/v1"
)

func main() {
	cfg := config.Load()

	// ── Redis ──────────────────────────────────────────────────────────────────
	redisClient := cache.NewRedisClient(cfg.RedisAddr)
	if err := redisClient.Ping(context.Background()); err != nil {
		log.Printf("gateway: warning — Redis not reachable: %v (caching disabled)\n", err)
		redisClient = nil
	} else {
		log.Printf("gateway: Redis connected at %s\n", cfg.RedisAddr)
	}

	// ── WebSocket Hub ──────────────────────────────────────────────────────────
	wsHub := hub.New()

	// ── Kafka Consumer ─────────────────────────────────────────────────────────
	kafkaBrokers := strings.Split(getEnv("KAFKA_BROKERS", "localhost:9092"), ",")
	kafkaConsumer, err := kafka.NewConsumer(kafkaBrokers, "gateway", wsHub.HandleKafkaEvent)
	if err != nil {
		log.Printf("gateway: warning — Kafka consumer init failed: %v (real-time events disabled)\n", err)
	} else {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		go kafkaConsumer.Start(ctx)
		log.Printf("gateway: Kafka consumer started, brokers=%v\n", kafkaBrokers)
	}

	// ── gRPC Service Addresses ─────────────────────────────────────────────────
	authAddr    := getEnv("AUTH_SERVICE_ADDR",         "localhost:50051")
	subAddr     := getEnv("SUBSCRIPTION_SERVICE_ADDR", "localhost:50052")
	workoutAddr := getEnv("WORKOUT_SERVICE_ADDR",      "localhost:50053")
	chatAddr    := getEnv("CHAT_SERVICE_ADDR",         "localhost:50054")
	videoAddr   := getEnv("VIDEO_SERVICE_ADDR",        "localhost:50055")

	// ── Dial gRPC Services ─────────────────────────────────────────────────────
	authConn,    _ := mustDial(authAddr)
	subConn,     _ := mustDial(subAddr)
	workoutConn, _ := mustDial(workoutAddr)
	chatConn,    _ := mustDial(chatAddr)
	videoConn,   _ := mustDial(videoAddr)

	authClient    := authv1.NewAuthServiceClient(authConn)
	subClient     := subv1.NewSubscriptionServiceClient(subConn)
	workoutClient := workoutv1.NewWorkoutServiceClient(workoutConn)
	chatClient    := chatv1.NewChatServiceClient(chatConn)
	videoClient   := videov1.NewVideoServiceClient(videoConn)

	// ── Fiber App ──────────────────────────────────────────────────────────────
	app := fiber.New(fiber.Config{AppName: "JinnxFit API Gateway"})
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:5173,http://localhost:3000",
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Authorization",
		AllowCredentials: true, // Required for HttpOnly cookie to be sent/received
	}))


	// ── REST API Routes ────────────────────────────────────────────────────────
	api := app.Group("/api/v1")
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"success": true, "message": "gateway is healthy"})
	})

	routes.RegisterAuthRoutes(api, authClient, cfg.JWTSecret, redisClient)
	routes.RegisterUserRoutes(api, authClient, cfg.JWTSecret, redisClient)
	routes.RegisterAdminRoutes(api, authClient, workoutClient, cfg.JWTSecret, redisClient)
	routes.RegisterSubscriptionRoutes(api, subClient, authClient, cfg.JWTSecret, redisClient)
	routes.RegisterWorkoutRoutes(api, workoutClient, authClient, subClient, cfg.JWTSecret, redisClient)
	routes.RegisterChatRoutes(api, chatClient, authClient, subClient, cfg.JWTSecret, redisClient)
	routes.RegisterVideoRoutes(api, videoClient, authClient, subClient, cfg.JWTSecret, redisClient)

	// ── WebSocket Route ────────────────────────────────────────────────────────
	// ws://host/ws?token=<jwt>
	// Supports: server-push notifications (Kafka events) + action:"chat" frames
	routes.RegisterWSRoutes(app, wsHub, cfg.JWTSecret, authClient, chatClient, redisClient)

	log.Printf("API Gateway running on :%s\n", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("gateway: failed to start: %v", err)
	}
}

func mustDial(addr string) (*grpc.ClientConn, error) {
	conn, err := grpc.Dial(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Printf("gateway: warning — failed to dial %s: %v\n", addr, err)
	}
	return conn, err
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
