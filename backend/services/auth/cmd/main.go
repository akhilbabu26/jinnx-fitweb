package main

import (
	"context"
	"log"
	"net"

	"google.golang.org/grpc"

	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/shared/config"
	"github.com/akhilbabu26/jinnx/shared/database"
	"github.com/akhilbabu26/jinnx/shared/mailer"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	"github.com/akhilbabu26/jinnx/services/auth/internal/handler"
	"github.com/akhilbabu26/jinnx/services/auth/internal/migrations"
	"github.com/akhilbabu26/jinnx/services/auth/internal/repository"
	"github.com/akhilbabu26/jinnx/services/auth/internal/service"
)

func main() {
	cfg := config.Load()

	// ── Redis (for active cache invalidation on status changes) ───────────────
	redisClient := cache.NewRedisClient(cfg.RedisAddr)
	if err := redisClient.Ping(context.Background()); err != nil {
		log.Printf("auth: warning — Redis not reachable at %s: %v (active invalidation disabled)\n", cfg.RedisAddr, err)
		redisClient = nil
	} else {
		log.Printf("auth: Redis connected at %s\n", cfg.RedisAddr)
	}

	// ── Wire dependencies ─────────────────────────────────────────────────────
	gormDB := database.NewGORM(cfg)
	sqlxDB := database.NewSQLX(gormDB)
	database.RunMigrations(sqlxDB, migrations.SQL)
	repo   := repository.New(sqlxDB)
	m      := mailer.NewMailer(cfg)
	svc    := service.New(repo, m, cfg.JWTSecret, redisClient, cfg.JWTExpiry(), cfg.RefreshTokenExpiry())
	h      := handler.New(svc)

	// ── Start gRPC server ─────────────────────────────────────────────────────
	listener, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("auth: failed to listen on port 50051: %v", err)
	}

	grpcServer := grpc.NewServer()
	authv1.RegisterAuthServiceServer(grpcServer, h)

	log.Println("Auth Service is running on :50051")
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("auth: failed to serve: %v", err)
	}
}
