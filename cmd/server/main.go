package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/giki-open-source/gikomplaint-v2/internal/cache"
	"github.com/giki-open-source/gikomplaint-v2/internal/config"
	"github.com/giki-open-source/gikomplaint-v2/internal/db"
	"github.com/giki-open-source/gikomplaint-v2/internal/handler"
	"github.com/giki-open-source/gikomplaint-v2/internal/repository"
	"github.com/giki-open-source/gikomplaint-v2/internal/service"
)

func main() {
	log.Println("Starting Gikomplaint-v2 API Monolith...")

	// 1. Load configuration
	cfg := config.LoadConfig()

	// 2. Initialize PostgreSQL
	pgDB, err := db.ConnectDB(cfg.DB)
	if err != nil {
		log.Fatalf("Fatal: Database initialization failed: %v", err)
	}
	defer pgDB.Close()

	// 3. Initialize Redis
	redisClient, err := cache.ConnectCache(cfg.Redis)
	if err != nil {
		log.Fatalf("Fatal: Redis initialization failed: %v", err)
	}
	defer redisClient.Redis.Close()

	// Initialize Repository and Service Layers
	userRepo := repository.NewUserRepository(pgDB)
	authService := service.NewAuthService(cfg, userRepo, redisClient)
	authHandler := handler.NewAuthHandler(authService)

	// 4. Setup Router & Middleware
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS Middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-CSRF-Token")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// 5. Register Routes
	workDir, _ := os.Getwd()
	distDir := filepath.Join(workDir, "frontend", "dist")

	// Direct serve of index.html at root "/"
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
	})

	// Mount the compiled static assets (js, css, images) from frontend/dist/assets
	r.Get("/assets/*", func(w http.ResponseWriter, r *http.Request) {
		fs := http.StripPrefix("/assets/", http.FileServer(http.Dir(filepath.Join(distDir, "assets"))))
		fs.ServeHTTP(w, r)
	})

	// JSON endpoint to test API responsiveness
	r.Get("/api/welcome", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"app":     "Gikomplaint-v2 API",
			"status":  "running",
			"version": "2.0.0",
		})
	})

	// Auth Routes Group
	r.Route("/auth", func(r chi.Router) {
		r.Get("/microsoft/login", authHandler.RedirectToMicrosoft)
		r.Get("/microsoft/callback", authHandler.HandleMicrosoftCallback)
	})

	// Robust Health Check checking both PG and Redis
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		status := http.StatusOK

		// Test PG
		pgStatus := "healthy"
		if err := pgDB.Ping(); err != nil {
			pgStatus = "unhealthy: " + err.Error()
			status = http.StatusInternalServerError
		}

		// Test Redis
		redisStatus := "healthy"
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := redisClient.Redis.Ping(ctx).Err(); err != nil {
			redisStatus = "unhealthy: " + err.Error()
			status = http.StatusInternalServerError
		}

		w.WriteHeader(status)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   statusText(status),
			"postgres": pgStatus,
			"redis":    redisStatus,
			"time":     time.Now().Format(time.RFC3339),
		})
	})

	// 6. Graceful Shutdown & Server Execution
	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Server listening on http://localhost%s", serverAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Fatal: ListenAndServe failed: %v", err)
		}
	}()

	// Channel to capture termination signals
	shutdownSig := make(chan os.Signal, 1)
	signal.Notify(shutdownSig, os.Interrupt, syscall.SIGTERM)

	<-shutdownSig
	log.Println("Shutdown signal received. Gracefully closing resources...")

	// Create a timeout context for shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Fatal: Graceful server shutdown failed: %v", err)
	}

	log.Println("Gikomplaint-v2 successfully stopped.")
}

func statusText(code int) string {
	if code == http.StatusOK {
		return "UP"
	}
	return "DOWN"
}
