package database

import (
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/akhilbabu26/jinnx/shared/config"
)

func NewGORM(cfg *config.Config) *gorm.DB {
	logLevel := logger.Silent
	if !cfg.IsProduction() {
		logLevel = logger.Info
	}

	db, err := gorm.Open(
		postgres.Open(cfg.DatabaseURL),
		&gorm.Config{
			Logger: logger.Default.LogMode(logLevel),
		},
	)
	if err != nil {
		log.Fatalf("gorm: failed to connect to database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("gorm: failed to get underlying sql.DB: %v", err)
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	return db
}

func NewSQLX(gormDB *gorm.DB) *sqlx.DB {
	sqlDB, err := gormDB.DB()
	if err != nil {
		log.Fatalf("sqlx: failed to get underlying sql.DB from gorm: %v", err)
	}

	db := sqlx.NewDb(sqlDB, "postgres")
	if err := db.Ping(); err != nil {
		log.Fatalf("sqlx: ping failed: %v", err)
	}

	return db
}
