package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/giki-open-source/gikomplaint-v2/internal/cache"
	"github.com/giki-open-source/gikomplaint-v2/internal/config"
	"github.com/giki-open-source/gikomplaint-v2/internal/domain"
	"github.com/giki-open-source/gikomplaint-v2/internal/repository"
)

type AuthService struct {
	cfg        *config.Config
	userRepo   *repository.UserRepository
	redisCache *cache.Client
	httpClient *http.Client
}

type MicrosoftProfile struct {
	ID                string `json:"id"`
	Email             string `json:"mail"`
	UserPrincipalName string `json:"userPrincipalName"`
	DisplayName       string `json:"displayName"`
	GivenName         string `json:"givenName"`
	Surname           string `json:"surname"`
}

type TokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

func NewAuthService(cfg *config.Config, userRepo *repository.UserRepository, redisCache *cache.Client) *AuthService {
	return &AuthService{
		cfg:        cfg,
		userRepo:   userRepo,
		redisCache: redisCache,
		httpClient: &http.Client{
			Timeout: 10 * time.Second, // Timeout to prevent thread pool starvation
		},
	}
}

// GenerateMicrosoftAuthURL creates the redirect URL and stores state in Redis for CSRF protection.
func (s *AuthService) GenerateMicrosoftAuthURL(ctx context.Context) (string, error) {
	state, err := generateRandomState()
	if err != nil {
		return "", fmt.Errorf("failed to generate state: %w", err)
	}

	// Cache state in Redis with 5-minute TTL to verify callback legitimacy
	stateKey := fmt.Sprintf("oauth_state:%s", state)
	err = s.redisCache.Redis.Set(ctx, stateKey, "valid", 5*time.Minute).Err()
	if err != nil {
		return "", fmt.Errorf("failed to cache state token: %w", err)
	}

	authURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/authorize?"+
		"client_id=%s"+
		"&response_type=code"+
		"&redirect_uri=%s"+
		"&response_mode=query"+
		"&scope=openid+profile+email+User.Read"+
		"&state=%s",
		s.cfg.Microsoft.TenantID,
		s.cfg.Microsoft.ClientID,
		url.QueryEscape(s.cfg.Microsoft.RedirectURI),
		state,
	)

	return authURL, nil
}

// ValidateState verifies that the returned OAuth state exists in Redis.
func (s *AuthService) ValidateState(ctx context.Context, state string) (bool, error) {
	stateKey := fmt.Sprintf("oauth_state:%s", state)
	val, err := s.redisCache.Redis.GetDel(ctx, stateKey).Result() // Get and delete instantly (one-time use)
	if err != nil {
		return false, nil
	}
	return val == "valid", nil
}

// ExchangeCodeAndFetchProfile exchanges code for Microsoft tokens and retrieves the Graph user profile.
func (s *AuthService) ExchangeCodeAndFetchProfile(ctx context.Context, code string) (*MicrosoftProfile, error) {
	// 1. Prepare Exchange Request
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", s.cfg.Microsoft.TenantID)
	data := url.Values{}
	data.Set("client_id", s.cfg.Microsoft.ClientID)
	data.Set("client_secret", s.cfg.Microsoft.ClientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", s.cfg.Microsoft.RedirectURI)
	data.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// 2. Perform Request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token exchange request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errMsg json.RawMessage
		_ = json.NewDecoder(resp.Body).Decode(&errMsg)
		return nil, fmt.Errorf("token exchange returned status %d: %s", resp.StatusCode, string(errMsg))
	}

	var tokenRes TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenRes); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	// 3. Request User Profile from Microsoft Graph
	profileURL := "https://graph.microsoft.com/v1.0/me"
	reqProfile, err := http.NewRequestWithContext(ctx, "GET", profileURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create profile request: %w", err)
	}
	reqProfile.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tokenRes.AccessToken))

	respProfile, err := s.httpClient.Do(reqProfile)
	if err != nil {
		return nil, fmt.Errorf("profile request failed: %w", err)
	}
	defer respProfile.Body.Close()

	if respProfile.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("graph API profile request returned status %d", respProfile.StatusCode)
	}

	var profile MicrosoftProfile
	if err := json.NewDecoder(respProfile.Body).Decode(&profile); err != nil {
		return nil, fmt.Errorf("failed to decode user profile: %w", err)
	}

	return &profile, nil
}

// AuthenticateMicrosoftUser validates domains, finds/creates users, and issues JWT tokens.
func (s *AuthService) AuthenticateMicrosoftUser(ctx context.Context, profile *MicrosoftProfile) (string, *domain.User, error) {
	// 1. Determine canonical email
	email := strings.TrimSpace(strings.ToLower(profile.Email))
	if email == "" {
		email = strings.TrimSpace(strings.ToLower(profile.UserPrincipalName))
	}

	if email == "" {
		return "", nil, errors.New("microsoft profile did not return a valid email address")
	}

	// 2. STRICTOR GIKI MAIL CHECK
	// Must end with configured GIKI domain (e.g. "@giki.edu.pk")
	allowedDomain := strings.TrimSpace(strings.ToLower(s.cfg.Microsoft.AllowedDomain))
	if !strings.HasSuffix(email, allowedDomain) {
		return "", nil, fmt.Errorf("unauthorized email domain: only %s users are allowed", allowedDomain)
	}

	// 3. DB Lookup / Upsert
	// Check by Microsoft ID first
	user, err := s.userRepo.GetByMicrosoftID(ctx, profile.ID)
	if err != nil {
		return "", nil, fmt.Errorf("error searching user by Microsoft ID: %w", err)
	}

	if user == nil {
		// Try to look up by Email (if they pre-existed or were created manually)
		user, err = s.userRepo.GetByEmail(ctx, email)
		if err != nil {
			return "", nil, fmt.Errorf("error searching user by email: %w", err)
		}

		if user != nil {
			// Associate their Microsoft ID for future SSO logins
			user.MicrosoftID = &profile.ID
			if err := s.userRepo.Update(ctx, user); err != nil {
				return "", nil, fmt.Errorf("failed to link Microsoft ID to existing account: %w", err)
			}
		} else {
			// Register a brand new user
			firstName := profile.GivenName
			lastName := profile.Surname

			if firstName == "" && lastName == "" {
				parts := strings.Split(profile.DisplayName, " ")
				if len(parts) > 0 {
					firstName = parts[0]
				}
				if len(parts) > 1 {
					lastName = strings.Join(parts[1:], " ")
				}
			}

			if firstName == "" {
				firstName = "GIKI"
			}
			if lastName == "" {
				lastName = "Student"
			}

			user = &domain.User{
				Email:        email,
				PasswordHash: nil, // Passwordless
				FirstName:    firstName,
				LastName:     lastName,
				Role:         "student", // Default role
				MicrosoftID:  &profile.ID,
			}

			if err := s.userRepo.Create(ctx, user); err != nil {
				return "", nil, fmt.Errorf("failed to register new SSO user: %w", err)
			}
		}
	}

	// 4. Generate Session JWT Token
	tokenString, err := s.GenerateJWT(user)
	if err != nil {
		return "", nil, fmt.Errorf("failed to sign authentication token: %w", err)
	}

	return tokenString, user, nil
}

// GenerateJWT creates a claims payload and signs a JWT token.
func (s *AuthService) GenerateJWT(user *domain.User) (string, error) {
	expirationTime := time.Now().Add(time.Duration(s.cfg.JWTExpiry) * time.Hour)

	claims := jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"role":  user.Role,
		"name":  fmt.Sprintf("%s %s", user.FirstName, user.LastName),
		"exp":   expirationTime.Unix(),
		"iat":   time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

func generateRandomState() (string, error) {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
