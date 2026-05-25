package config

import (
	"os"
	"strconv"
)

type Config struct {
	AppEnv    string
	Port      string
	DB        DBConfig
	Redis     RedisConfig
	JWTSecret string
	JWTExpiry int
	Microsoft MicrosoftOAuthConfig
}

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
}

type MicrosoftOAuthConfig struct {
	ClientID      string
	ClientSecret  string
	RedirectURI   string
	TenantID      string
	AllowedDomain string
}

// LoadConfig loads application configuration from environment variables.
func LoadConfig() *Config {
	return &Config{
		AppEnv:    getEnv("APP_ENV", "development"),
		Port:      getEnv("PORT", "8080"),
		JWTSecret: getEnv("JWT_SECRET", "super_secret_gikomplaint_key_change_me_local_development"),
		JWTExpiry: getEnvInt("JWT_EXPIRY_HOURS", 24),
		DB: DBConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "giko_user"),
			Password: getEnv("DB_PASSWORD", "giko_secure_pass"),
			Name:     getEnv("DB_NAME", "gikomplaint"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
		},
		Microsoft: MicrosoftOAuthConfig{
			ClientID:      getEnv("AZURE_CLIENT_ID", ""),
			ClientSecret:  getEnv("AZURE_CLIENT_SECRET", ""),
			RedirectURI:   getEnv("AZURE_REDIRECT_URI", "http://localhost:8080/auth/microsoft/callback"),
			TenantID:      getEnv("AZURE_TENANT_ID", "common"),
			AllowedDomain: getEnv("ALLOWED_EMAIL_DOMAIN", "@giki.edu.pk"),
		},
	}
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultVal
}
