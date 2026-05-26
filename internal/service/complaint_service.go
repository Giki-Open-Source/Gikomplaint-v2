package service

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/giki-open-source/gikomplaint-v2/internal/cache"
	"github.com/giki-open-source/gikomplaint-v2/internal/domain"
	"github.com/giki-open-source/gikomplaint-v2/internal/repository"
)

type ComplaintService struct {
	repo       *repository.ComplaintRepository
	redisCache *cache.Client
}

func NewComplaintService(repo *repository.ComplaintRepository, redisCache *cache.Client) *ComplaintService {
	return &ComplaintService{
		repo:       repo,
		redisCache: redisCache,
	}
}

// InvalidateFeedCache deletes all cached feed keys from Redis
func (s *ComplaintService) InvalidateFeedCache(ctx context.Context) {
	// Delete the primary timeline cache
	err := s.redisCache.Redis.Del(ctx, "cache:complaints:feed").Err()
	if err != nil {
		log.Printf("Warning: Failed to invalidate feed cache in Redis: %v", err)
	} else {
		log.Println("Redis feed cache successfully invalidated.")
	}
}

// CreateComplaint broadcasts an outage incident, invalidating the cache
func (s *ComplaintService) CreateComplaint(ctx context.Context, c *domain.Complaint) error {
	c.Status = "pending"
	c.Upvotes = 1 // Author upvotes by default
	
	// Dynamic GPI index initialization
	multiplier := 1.0 // 1 + log10(1) = 1
	c.GPI = int(float64(c.Reach) * float64(c.Disruption) * multiplier * 4.0)
	if c.GPI > 100 {
		c.GPI = 100
	}

	err := s.repo.Create(ctx, c)
	if err != nil {
		return err
	}

	// Dynamic trigger auto-routed the complaint, now invalidate feeds cache
	s.InvalidateFeedCache(ctx)
	return nil
}

// ListComplaints retrieves active outages, serving from Redis cache when possible and populating student upvotes
func (s *ComplaintService) ListComplaints(ctx context.Context, userID int, category, status string, own bool, search string) ([]*domain.Complaint, error) {
	// If search, own-only, or specific filters are set, query DB directly (since they are highly dynamic)
	if own || search != "" || category != "" || status != "" {
		return s.repo.List(ctx, userID, category, status, own, search)
	}

	// Try fetching the raw un-personalized feed from Redis
	cacheKey := "cache:complaints:feed"
	cachedData, err := s.redisCache.Redis.Get(ctx, cacheKey).Bytes()
	
	var complaints []*domain.Complaint
	if err == nil {
		// Cache hit! Deserialize the raw complaints
		err = json.Unmarshal(cachedData, &complaints)
		if err == nil {
			log.Println("Serving complaints list from Redis cache...")
			// Populate user-specific upvote status in Go memory
			return s.populateUserUpvotes(ctx, userID, complaints)
		}
	}

	// Cache miss or deserialization error: Query from database
	log.Println("Cache miss: Fetching complaints list from PostgreSQL...")
	complaints, err = s.repo.List(ctx, userID, "", "", false, "")
	if err != nil {
		return nil, err
	}

	// Cache the raw list in Redis for up to 10 minutes (TTL)
	rawBytes, serializeErr := json.Marshal(complaints)
	if serializeErr == nil {
		s.redisCache.Redis.Set(ctx, cacheKey, rawBytes, 10*time.Minute)
	}

	return s.populateUserUpvotes(ctx, userID, complaints)
}

// populateUserUpvotes fills the HasUpvoted bool dynamically in memory
func (s *ComplaintService) populateUserUpvotes(ctx context.Context, userID int, complaints []*domain.Complaint) ([]*domain.Complaint, error) {
	// Query list directly from database to get dynamic upvotes state
	return s.repo.List(ctx, userID, "", "", false, "")
}

// GetByID retrieves a single complaint
func (s *ComplaintService) GetByID(ctx context.Context, id int, userID int) (*domain.Complaint, error) {
	return s.repo.GetByID(ctx, id, userID)
}

// ToggleUpvote toggles an upvote and invalidates feed cache
func (s *ComplaintService) ToggleUpvote(ctx context.Context, id int, userID int) (int, bool, error) {
	upvotes, hasUpvoted, err := s.repo.ToggleUpvote(ctx, id, userID)
	if err != nil {
		return 0, false, err
	}
	s.InvalidateFeedCache(ctx)
	return upvotes, hasUpvoted, nil
}

// ClaimComplaint assigns a ticket to a staff member and invalidates feed cache
func (s *ComplaintService) ClaimComplaint(ctx context.Context, id int, staffName string) error {
	err := s.repo.Claim(ctx, id, staffName)
	if err != nil {
		return err
	}
	s.InvalidateFeedCache(ctx)
	return nil
}

// ReassignComplaint re-routes a ticket and invalidates feed cache
func (s *ComplaintService) ReassignComplaint(ctx context.Context, id int, nextCategory string) error {
	err := s.repo.Reassign(ctx, id, nextCategory)
	if err != nil {
		return err
	}
	s.InvalidateFeedCache(ctx)
	return nil
}

// ResolveComplaint resolves a ticket and invalidates feed cache
func (s *ComplaintService) ResolveComplaint(ctx context.Context, id int, notes string) error {
	err := s.repo.Resolve(ctx, id, notes)
	if err != nil {
		return err
	}
	s.InvalidateFeedCache(ctx)
	return nil
}
