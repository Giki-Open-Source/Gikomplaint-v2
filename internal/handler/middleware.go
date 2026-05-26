package handler

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	UserContextKey contextKey = "user"
)

type AuthUser struct {
	ID    int    `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
	Name  string `json:"name"`
}

// AuthMiddleware validates JWT Bearer tokens and injects the parsed AuthUser struct into context.
func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Unauthorized: missing authorization token", http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, "Unauthorized: invalid header format (must be Bearer <token>)", http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]
			token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				http.Error(w, "Unauthorized: invalid or expired session token", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, "Unauthorized: invalid token claims structure", http.StatusUnauthorized)
				return
			}

			userIDVal, ok := claims["sub"].(float64)
			if !ok {
				http.Error(w, "Unauthorized: invalid subject in token", http.StatusUnauthorized)
				return
			}

			email, _ := claims["email"].(string)
			role, _ := claims["role"].(string)
			name, _ := claims["name"].(string)

			authUser := &AuthUser{
				ID:    int(userIDVal),
				Email: email,
				Role:  role,
				Name:  name,
			}

			ctx := context.WithValue(r.Context(), UserContextKey, authUser)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserFromContext safely extracts the AuthUser from a request context.
func GetUserFromContext(ctx context.Context) *AuthUser {
	user, _ := ctx.Value(UserContextKey).(*AuthUser)
	return user
}

// RequireRole validates that the authenticated user possesses one of the allowed operational roles.
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := GetUserFromContext(r.Context())
			if user == nil {
				http.Error(w, "Unauthorized: session context not established", http.StatusUnauthorized)
				return
			}

			allowed := false
			for _, role := range allowedRoles {
				if user.Role == role {
					allowed = true
					break
				}
			}

			if !allowed {
				http.Error(w, "Forbidden: insufficient permissions for this operations", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
