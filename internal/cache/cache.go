package cache

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/giki-open-source/gikomplaint-v2/internal/config"
	"github.com/redis/go-redis/v9"
)

// Client wraps the redis.Client to provide application cache actions.
type Client struct {
	Redis *redis.Client
}

// ConnectCache initializes the connection to the Redis service.
func ConnectCache(cfg config.RedisConfig) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       0, // Default DB
		// High Concurrency Tuning
		PoolSize:     50,              // Max socket connections
		MinIdleConns: 10,              // Maintain at least 10 idle connections
		PoolTimeout:  4 * time.Second, // Timeout to fetch from pool
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		rdb.Close()
		return nil, fmt.Errorf("failed to ping Redis: %w", err)
	}

	log.Printf("Successfully established Redis connection pool at %s:%s", cfg.Host, cfg.Port)
	return &Client{Redis: rdb}, nil
}
