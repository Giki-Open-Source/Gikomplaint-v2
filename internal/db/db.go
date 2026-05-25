package db

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/giki-open-source/gikomplaint-v2/internal/config"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// ConnectDB establishes a connection pool to the PostgreSQL database.
func ConnectDB(cfg config.DBConfig) (*sql.DB, error) {
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Name, cfg.SSLMode)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// High Concurrency Tuning for Connection Pool
	db.SetMaxOpenConns(50)                  // Max parallel active connections
	db.SetMaxIdleConns(25)                  // Idle pool size
	db.SetConnMaxLifetime(15 * time.Minute) // Connection lifetime
	db.SetConnMaxIdleTime(5 * time.Minute)  // Max idle duration before closing

	// Verify database connection is alive
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("Successfully established PostgreSQL connection pool at %s:%s", cfg.Host, cfg.Port)
	return db, nil
}
