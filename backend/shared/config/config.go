package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv                 string
	Port                   string
	DatabaseURL            string
	JWTSecret              string
	JWTExpiryMinutes       int
	RefreshTokenExpiryDays int
	ResendAPIKey           string
	EmailFrom              string
	SMTPHost               string
	SMTPPort               string
	SMTPUser               string
	SMTPPass               string
	SMTPFrom               string
	R2AccountID            string
	R2AccessKeyID          string
	R2SecretAccessKey      string
	R2BucketName           string
	RazorpayKeyID          string
	RazorpayKeySecret      string
	RazorpayWebhookSecret  string
	RazorpayPlanID         string
	LivekitAPIKey          string
	LivekitAPISecret       string
	LivekitHost            string
	AnthropicAPIKey        string
	ChatbotDailyLimitFree  int
	ChatbotMaxHistory      int
}

func (c *Config) JWTExpiry() time.Duration {
	return time.Duration(c.JWTExpiryMinutes) * time.Minute
}

func (c *Config) RefreshTokenExpiry() time.Duration {
	return time.Duration(c.RefreshTokenExpiryDays) * 24 * time.Hour
}

func (c *Config) IsProduction() bool {
	return c.AppEnv == "production"
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		AppEnv:                 getEnv("APP_ENV", "development"),
		Port:                   getEnv("PORT", "8080"),
		DatabaseURL:            getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/jinnxfit?sslmode=disable"),
		JWTSecret:              getEnv("JWT_SECRET", "supersecretkey"),
		JWTExpiryMinutes:       getEnvInt("JWT_EXPIRY_MINUTES", 15),
		RefreshTokenExpiryDays: getEnvInt("REFRESH_TOKEN_EXPIRY_DAYS", 30),
		ResendAPIKey:           getEnv("RESEND_API_KEY", ""),
		EmailFrom:              getEnv("EMAIL_FROM", ""),
		SMTPHost:               getEnv("SMTP_HOST", ""),
		SMTPPort:               getEnv("SMTP_PORT", ""),
		SMTPUser:               getEnv("SMTP_USER", ""),
		SMTPPass:               getEnv("SMTP_PASS", ""),
		SMTPFrom:               getEnv("SMTP_FROM", ""),
		R2AccountID:            getEnv("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:          getEnv("R2_ACCESS_KEY_ID", ""),
		R2SecretAccessKey:      getEnv("R2_SECRET_ACCESS_KEY", ""),
		R2BucketName:           getEnv("R2_BUCKET_NAME", ""),
		RazorpayKeyID:          getEnv("RAZORPAY_KEY_ID", ""),
		RazorpayKeySecret:      getEnv("RAZORPAY_KEY_SECRET", ""),
		RazorpayWebhookSecret:  getEnv("RAZORPAY_WEBHOOK_SECRET", ""),
		RazorpayPlanID:         getEnv("RAZORPAY_PLAN_ID", ""),
		LivekitAPIKey:          getEnv("LIVEKIT_API_KEY", ""),
		LivekitAPISecret:       getEnv("LIVEKIT_API_SECRET", ""),
		LivekitHost:            getEnv("LIVEKIT_HOST", ""),
		AnthropicAPIKey:        getEnv("ANTHROPIC_API_KEY", ""),
		ChatbotDailyLimitFree:  getEnvInt("CHATBOT_DAILY_LIMIT_FREE", 20),
		ChatbotMaxHistory:      getEnvInt("CHATBOT_MAX_HISTORY", 10),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
