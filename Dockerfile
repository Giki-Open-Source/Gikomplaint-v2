# Development / Build stage
FROM golang:1.21-alpine AS dev
WORKDIR /app

# Install git, air for live reload, and golang-migrate
RUN apk add --no-cache git build-base && \
    go install github.com/cosmtrek/air@latest && \
    go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

COPY go.mod go.sum ./
# Note: we will copy and download dependencies soon. In dev stage, go.sum is not created yet if we haven't go get'ed anything, so we'll handle this dynamically.
# Let's check how docker handles it. If go.sum doesn't exist, COPY will error. We can COPY just go.mod first or wait till we create it.
# To be robust, let's create a minimal go.mod and go.sum in our repo before running docker.
# Let's write the Dockerfile first.

COPY . .

# Production compilation
FROM dev AS builder
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /server cmd/server/main.go

# Production release stage
FROM scratch AS prod
COPY --from=builder /server /server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8080
ENTRYPOINT ["/server"]
