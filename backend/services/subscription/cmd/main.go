package main

import (
	"log"
	"net"
	"os"
	"strings"

	"google.golang.org/grpc"

	"github.com/akhilbabu26/jinnx/shared/config"
	"github.com/akhilbabu26/jinnx/shared/database"
	"github.com/akhilbabu26/jinnx/shared/kafka"

	subv1 "github.com/akhilbabu26/jinnx/proto/subscription/v1"
	"github.com/akhilbabu26/jinnx/services/subscription/internal/handler"
	"github.com/akhilbabu26/jinnx/services/subscription/internal/migrations"
	"github.com/akhilbabu26/jinnx/services/subscription/internal/repository"
	"github.com/akhilbabu26/jinnx/services/subscription/internal/service"
)

func main() {
	cfg := config.Load()

	// ── Database ───────────────────────────────────────────────────────────────
	gormDB := database.NewGORM(cfg)
	sqlxDB := database.NewSQLX(gormDB)
	database.RunMigrations(sqlxDB, migrations.SQL)
	repo := repository.New(sqlxDB)

	// ── Kafka Producer ─────────────────────────────────────────────────────────
	brokers := strings.Split(getEnv("KAFKA_BROKERS", "localhost:9092"), ",")
	kafkaProducer, err := kafka.NewProducer(brokers)
	if err != nil {
		log.Printf("subscription: warning — Kafka producer init failed: %v (events disabled)\n", err)
		kafkaProducer = nil
	} else {
		log.Printf("subscription: Kafka producer connected, brokers=%v\n", brokers)
		defer kafkaProducer.Close()
	}

	// ── Wire service ───────────────────────────────────────────────────────────
	svc := service.New(
		repo,
		cfg.RazorpayKeyID,
		cfg.RazorpayKeySecret,
		cfg.RazorpayPlanID,
		cfg.RazorpayWebhookSecret,
		kafkaProducer,
	)
	h := handler.New(svc)

	// ── Start gRPC server ──────────────────────────────────────────────────────
	listener, err := net.Listen("tcp", ":50052")
	if err != nil {
		log.Fatalf("subscription: failed to listen on :50052: %v", err)
	}
	grpcServer := grpc.NewServer()
	subv1.RegisterSubscriptionServiceServer(grpcServer, h)

	log.Println("Subscription Service is running on :50052")
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("subscription: failed to serve: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
