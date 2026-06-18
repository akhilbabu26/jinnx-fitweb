package main

import (
	"context"
	"log"
	"net"
	"os"
	"strings"
	"time"

	"google.golang.org/grpc"

	"github.com/akhilbabu26/jinnx/shared/config"
	"github.com/akhilbabu26/jinnx/shared/database"
	"github.com/akhilbabu26/jinnx/shared/kafka"

	workoutv1 "github.com/akhilbabu26/jinnx/proto/workout/v1"
	"github.com/akhilbabu26/jinnx/services/workout/internal/handler"
	"github.com/akhilbabu26/jinnx/services/workout/internal/migrations"
	"github.com/akhilbabu26/jinnx/services/workout/internal/repository"
	"github.com/akhilbabu26/jinnx/services/workout/internal/service"
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
		log.Printf("workout: warning — Kafka producer init failed: %v (events disabled)\n", err)
		kafkaProducer = nil
	} else {
		log.Printf("workout: Kafka producer connected, brokers=%v\n", brokers)
		defer kafkaProducer.Close()
	}

	// ── Wire service ───────────────────────────────────────────────────────────
	svc := service.New(repo, kafkaProducer)
	h   := handler.New(svc)

	// ── Trial expiry cron (every hour) ────────────────────────────────────────
	if kafkaProducer != nil {
		go func() {
			ctx := context.Background()
			ticker := time.NewTicker(1 * time.Hour)
			defer ticker.Stop()
			for range ticker.C {
				users, err := repo.ListTrialExpiringUsers(ctx)
				if err != nil {
					log.Printf("workout: trial expiry check error: %v\n", err)
					continue
				}
				for _, u := range users {
					_ = kafkaProducer.Publish(ctx, kafka.Event{
						Type:    kafka.EventTrialExpiring,
						ActorID: u.UserID,
						Payload: map[string]any{
							"ends_at": u.TrialEndsAt.Format(time.RFC3339),
							"name":    u.Name,
							"email":   u.Email,
						},
					})
				}
				log.Printf("workout: trial expiry check done — %d alerts sent\n", len(users))
			}
		}()
	}

	// ── Start gRPC server ──────────────────────────────────────────────────────
	listener, err := net.Listen("tcp", ":50053")
	if err != nil {
		log.Fatalf("workout: failed to listen on :50053: %v", err)
	}
	grpcServer := grpc.NewServer()
	workoutv1.RegisterWorkoutServiceServer(grpcServer, h)

	log.Println("Workout Service is running on :50053")
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("workout: failed to serve: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
