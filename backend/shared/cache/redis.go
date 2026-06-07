// Package cache provides a thin Redis client wrapper used across services.
// It handles JSON serialisation, key management, and graceful error handling.
package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// ErrCacheMiss is returned when a key does not exist in the cache.
var ErrCacheMiss = errors.New("cache: key not found")

// UserProfileKey returns the canonical Redis key for a cached user profile.
// Format: "user_profile:<userID>"
func UserProfileKey(userID uint32) string {
	return fmt.Sprintf("user_profile:%d", userID)
}

// RedisClient wraps go-redis with typed helpers.
type RedisClient struct {
	rdb *redis.Client
}

// NewRedisClient creates a RedisClient connected to addr (e.g. "localhost:6379").
func NewRedisClient(addr string) *RedisClient {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: "", // no auth by default; override via REDIS_PASSWORD env if needed
		DB:       0,
	})
	return &RedisClient{rdb: rdb}
}

// Ping verifies the connection is alive. Call this at startup.
func (c *RedisClient) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

// SetJSON marshals v to JSON and stores it under key with the given TTL.
func (c *RedisClient) SetJSON(ctx context.Context, key string, v any, ttl time.Duration) error {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("cache: marshal %q: %w", key, err)
	}
	return c.rdb.Set(ctx, key, b, ttl).Err()
}

// GetJSON retrieves the value at key and unmarshals it into v.
// Returns ErrCacheMiss if the key does not exist.
func (c *RedisClient) GetJSON(ctx context.Context, key string, v any) error {
	b, err := c.rdb.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return ErrCacheMiss
	}
	if err != nil {
		return fmt.Errorf("cache: get %q: %w", key, err)
	}
	return json.Unmarshal(b, v)
}

// Delete removes one or more keys from the cache.
// Used for active invalidation when user status changes.
func (c *RedisClient) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	return c.rdb.Del(ctx, keys...).Err()
}
