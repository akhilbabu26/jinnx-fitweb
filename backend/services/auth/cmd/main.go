package main

import (
	"context"
	"log"
	"net"
	"os"
	"strings"
	"time"

	"google.golang.org/grpc"

	"github.com/akhilbabu26/jinnx/shared/cache"
	"github.com/akhilbabu26/jinnx/shared/config"
	"github.com/akhilbabu26/jinnx/shared/database"
	"github.com/akhilbabu26/jinnx/shared/kafka"
	"github.com/akhilbabu26/jinnx/shared/mailer"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	"github.com/akhilbabu26/jinnx/services/auth/internal/handler"
	"github.com/akhilbabu26/jinnx/services/auth/internal/migrations"
	"github.com/akhilbabu26/jinnx/services/auth/internal/repository"
	"github.com/akhilbabu26/jinnx/services/auth/internal/service"
)

func main() {
	cfg := config.Load()

	// ── Redis ──────────────────────────────────────────────────────────────────
	redisClient := cache.NewRedisClient(cfg.RedisAddr)
	if err := redisClient.Ping(context.Background()); err != nil {
		log.Printf("auth: warning — Redis not reachable: %v (OTP disabled)\n", err)
		redisClient = nil
	} else {
		log.Printf("auth: Redis connected at %s\n", cfg.RedisAddr)
	}

	// ── Kafka Producer ─────────────────────────────────────────────────────────
	brokers := strings.Split(getEnv("KAFKA_BROKERS", "localhost:9092"), ",")
	kafkaProducer, err := kafka.NewProducer(brokers)
	if err != nil {
		log.Printf("auth: warning — Kafka producer init failed: %v (events disabled)\n", err)
		kafkaProducer = nil
	} else {
		log.Printf("auth: Kafka producer connected, brokers=%v\n", brokers)
		defer kafkaProducer.Close()
	}

	// ── Wire dependencies ──────────────────────────────────────────────────────
	gormDB := database.NewGORM(cfg)
	sqlxDB := database.NewSQLX(gormDB)
	database.RunMigrations(sqlxDB, migrations.SQL)
	repo := repository.New(sqlxDB)
	m    := mailer.NewMailer(cfg)

	// ── Expired token cleanup worker ───────────────────────────────────────────
	go func() {
		ctx := context.Background()
		ticker := time.NewTicker(12 * time.Hour)
		defer ticker.Stop()

		log.Println("auth: cleaning up expired or revoked refresh tokens...")
		if err := repo.DeleteExpiredOrRevokedTokens(ctx); err != nil {
			log.Printf("auth: warning — token cleanup failed: %v\n", err)
		}
		for range ticker.C {
			log.Println("auth: cleaning up expired or revoked refresh tokens...")
			if err := repo.DeleteExpiredOrRevokedTokens(ctx); err != nil {
				log.Printf("auth: warning — token cleanup failed: %v\n", err)
			}
		}
	}()

	svc := service.New(repo, m, cfg.JWTSecret, redisClient, kafkaProducer, cfg.JWTExpiry(), cfg.RefreshTokenExpiry())
	h   := handler.New(svc)

	// ── Start gRPC server ──────────────────────────────────────────────────────
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

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
