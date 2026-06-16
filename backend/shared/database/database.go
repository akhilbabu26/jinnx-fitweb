package database

import (
	"embed"
	"io/fs"
	"log"
	"sort"
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

// RunMigrations reads every *.sql file from the provided embed.FS (sorted by
// filename) and executes them against the database in order.  It is safe to
// call on every startup because migration files use IF NOT EXISTS guards.
func RunMigrations(db *sqlx.DB, migrations embed.FS) {
	entries, err := fs.ReadDir(migrations, ".")
	if err != nil {
		log.Fatalf("migrations: failed to read embedded FS: %v", err)
	}

	// Collect only .sql files and sort them (001_, 002_, …)
	var files []string
	for _, e := range entries {
		if !e.IsDir() && len(e.Name()) > 4 && e.Name()[len(e.Name())-4:] == ".sql" {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, name := range files {
		content, err := fs.ReadFile(migrations, name)
		if err != nil {
			log.Fatalf("migrations: failed to read %s: %v", name, err)
		}
		if _, err := db.Exec(string(content)); err != nil {
			log.Fatalf("migrations: failed to execute %s: %v", name, err)
		}
		log.Printf("migrations: applied %s", name)
	}
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
