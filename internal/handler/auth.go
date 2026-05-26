package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/giki-open-source/gikomplaint-v2/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// RedirectToMicrosoft handles GET /auth/microsoft/login
func (h *AuthHandler) RedirectToMicrosoft(w http.ResponseWriter, r *http.Request) {
	url, err := h.authService.GenerateMicrosoftAuthURL(r.Context())
	if err != nil {
		log.Printf("Error generating Microsoft auth URL: %v", err)
		http.Error(w, "Failed to initiate login flow", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// HandleMicrosoftCallback handles GET /auth/microsoft/callback
func (h *AuthHandler) HandleMicrosoftCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" {
		respondWithError(w, http.StatusBadRequest, "Missing code or state parameters from authorization callback")
		return
	}

	// 1. Anti-CSRF verification
	stateValid, err := h.authService.ValidateState(r.Context(), state)
	if err != nil || !stateValid {
		log.Printf("CSRF state token validation failed: %v", err)
		respondWithError(w, http.StatusBadRequest, "OAuth state validation failed (possible CSRF attack attempt)")
		return
	}

	// 2. Exchange authorization code for Microsoft user details
	profile, err := h.authService.ExchangeCodeAndFetchProfile(r.Context(), code)
	if err != nil {
		log.Printf("Failed to exchange code and fetch profile: %v", err)
		respondWithError(w, http.StatusBadGateway, "Failed to authenticate with Microsoft services: "+err.Error())
		return
	}

	// 3. Authenticate and verify GIKI email suffix
	token, user, err := h.authService.AuthenticateMicrosoftUser(r.Context(), profile)
	if err != nil {
		log.Printf("Authentication failed for user: %v", err)

		// Check if it's a domain validation failure
		if strings.Contains(err.Error(), "unauthorized email domain") {
			respondWithError(w, http.StatusForbidden, "Onboarding Restricted: Only GIKI students or staff with a valid @giki.edu.pk email are allowed to sign up.")
			return
		}

		respondWithError(w, http.StatusInternalServerError, "Failed to process user session: "+err.Error())
		return
	}

	// 4. Redirect to frontend with token and user details in query parameters
	userBytes, _ := json.Marshal(user)
	redirectURL := fmt.Sprintf("/?token=%s&user=%s", token, url.QueryEscape(string(userBytes)))
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

// HandleSandboxLogin handles GET /auth/sandbox
func (h *AuthHandler) HandleSandboxLogin(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	if role != "student" && role != "staff" && role != "admin" {
		respondWithError(w, http.StatusBadRequest, "Invalid sandbox role parameter")
		return
	}

	token, user, err := h.authService.AuthenticateSandboxUser(r.Context(), role)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to authenticate sandbox session: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

func respondWithError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
