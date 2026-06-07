package main

import (
	"log"
	"net"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/akhilbabu26/jinnx/shared/config"
	"github.com/akhilbabu26/jinnx/shared/database"

	authv1 "github.com/akhilbabu26/jinnx/proto/auth/v1"
	videov1 "github.com/akhilbabu26/jinnx/proto/video/v1"
	"github.com/akhilbabu26/jinnx/services/video/internal/handler"
	"github.com/akhilbabu26/jinnx/services/video/internal/repository"
	"github.com/akhilbabu26/jinnx/services/video/internal/service"
)

func main() {
	cfg := config.Load()

	gormDB := database.NewGORM(cfg)
	sqlxDB := database.NewSQLX(gormDB)
	repo := repository.New(sqlxDB)

	// Dial Auth Service to fetch user display names for LiveKit tokens
	authAddr := "localhost:50051"
	authConn, err := grpc.Dial(authAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Printf("video: warning — failed to connect to Auth Service at %s: %v\n", authAddr, err)
	}
	authClient := authv1.NewAuthServiceClient(authConn)

	svc := service.New(repo, authClient, cfg.LivekitAPIKey, cfg.LivekitAPISecret, cfg.LivekitHost)
	h := handler.New(svc)

	listener, err := net.Listen("tcp", ":50055")
	if err != nil {
		log.Fatalf("video: failed to listen on :50055: %v", err)
	}

	grpcServer := grpc.NewServer()
	videov1.RegisterVideoServiceServer(grpcServer, h)

	log.Println("Video Service is running on :50055")
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("video: failed to serve: %v", err)
	}
}
