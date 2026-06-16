package main

import (
	"log"
	"net"

	"google.golang.org/grpc"

	"github.com/akhilbabu26/jinnx/shared/config"
	"github.com/akhilbabu26/jinnx/shared/database"

	workoutv1 "github.com/akhilbabu26/jinnx/proto/workout/v1"
	"github.com/akhilbabu26/jinnx/services/workout/internal/handler"
	"github.com/akhilbabu26/jinnx/services/workout/internal/migrations"
	"github.com/akhilbabu26/jinnx/services/workout/internal/repository"
	"github.com/akhilbabu26/jinnx/services/workout/internal/service"
)

func main() {
	cfg := config.Load()

	gormDB := database.NewGORM(cfg)
	sqlxDB := database.NewSQLX(gormDB)
	database.RunMigrations(sqlxDB, migrations.SQL)
	repo := repository.New(sqlxDB)
	svc := service.New(repo)
	h := handler.New(svc)

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
