#!/bin/sh

echo "Starting Gikomplaint-v2 development container..."

# 1. Download/Tidy Go dependencies and build the go.sum file automatically
echo "Tidying and downloading Go modules..."
go mod tidy

# 2. Check if air is already installed or install a version compatible with Go 1.21
if ! command -v air >/dev/null 2>&1; then
    echo "Installing Go 1.21 compatible air (v1.49.0)..."
    go install github.com/cosmtrek/air@v1.49.0
fi

# 3. Start the application
if command -v air >/dev/null 2>&1; then
    echo "Starting app with air (live reload)..."
    air
else
    echo "Air installation failed. Falling back to go run..."
    go run cmd/server/main.go
fi
