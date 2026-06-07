package main

import (
	"log"
	"net"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/akhilbabu26/jinnx/shared/config"
	"github.com/akhilbabu26/jinnx/shared/database"

	chatv1 "github.com/akhilbabu26/jinnx/proto/chat/v1"
	workoutv1 "github.com/akhilbabu26/jinnx/proto/workout/v1"
	"github.com/akhilbabu26/jinnx/services/chat/internal/handler"
	"github.com/akhilbabu26/jinnx/services/chat/internal/repository"
	"github.com/akhilbabu26/jinnx/services/chat/internal/service"
)

func main() {
	cfg := config.Load()

	gormDB := database.NewGORM(cfg)
	sqlxDB := database.NewSQLX(gormDB)
	repo := repository.New(sqlxDB)

	// Dial workout service for context-aware system prompts
	workoutAddr := "localhost:50053"
	workoutConn, err := grpc.Dial(workoutAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Printf("chat: warning — failed to connect to Workout Service at %s: %v\n", workoutAddr, err)
	}
	var workoutClient workoutv1.WorkoutServiceClient
	if workoutConn != nil {
		workoutClient = workoutv1.NewWorkoutServiceClient(workoutConn)
	}

	svc := service.New(repo, workoutClient, cfg.AnthropicAPIKey, cfg.ChatbotDailyLimitFree, cfg.ChatbotMaxHistory)
	h := handler.New(svc)

	listener, err := net.Listen("tcp", ":50054")
	if err != nil {
		log.Fatalf("chat: failed to listen on :50054: %v", err)
	}

	grpcServer := grpc.NewServer()
	chatv1.RegisterChatServiceServer(grpcServer, h)

	log.Println("AI Chat Service is running on :50054")
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("chat: failed to serve: %v", err)
	}
}
