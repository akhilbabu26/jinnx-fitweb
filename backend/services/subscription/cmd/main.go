package main

import (
	"log"
	"net"

	"google.golang.org/grpc"

	"github.com/akhilbabu26/jinnx/shared/config"
	"github.com/akhilbabu26/jinnx/shared/database"

	subv1 "github.com/akhilbabu26/jinnx/proto/subscription/v1"
	"github.com/akhilbabu26/jinnx/services/subscription/internal/handler"
	"github.com/akhilbabu26/jinnx/services/subscription/internal/migrations"
	"github.com/akhilbabu26/jinnx/services/subscription/internal/repository"
	"github.com/akhilbabu26/jinnx/services/subscription/internal/service"
)

func main() {
	cfg := config.Load()

	gormDB := database.NewGORM(cfg)
	sqlxDB := database.NewSQLX(gormDB)
	database.RunMigrations(sqlxDB, migrations.SQL)
	repo := repository.New(sqlxDB)
	svc := service.New(repo, cfg.RazorpayKeyID, cfg.RazorpayKeySecret, cfg.RazorpayPlanID, cfg.RazorpayWebhookSecret)
	h := handler.New(svc)

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
