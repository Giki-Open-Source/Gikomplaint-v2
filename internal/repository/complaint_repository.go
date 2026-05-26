package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/giki-open-source/gikomplaint-v2/internal/domain"
)

type ComplaintRepository struct {
	db *sql.DB
}

func NewComplaintRepository(db *sql.DB) *ComplaintRepository {
	return &ComplaintRepository{db: db}
}

// Create inserts a new complaint record.
func (r *ComplaintRepository) Create(ctx context.Context, c *domain.Complaint) error {
	query := `INSERT INTO complaints (user_id, title, description, category, status, severity, reach, disruption, gpi, images) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
	          RETURNING id, department_id, created_at, updated_at`

	// pgx natively supports scanning into slice
	var images []string
	err := r.db.QueryRowContext(ctx, query,
		c.UserID,
		c.Title,
		c.Description,
		c.Category,
		c.Status,
		c.Severity,
		c.Reach,
		c.Disruption,
		c.GPI,
		c.Images,
	).Scan(&c.ID, &c.DepartmentID, &c.CreatedAt, &c.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create complaint: %w", err)
	}

	c.Images = images
	if c.Images == nil {
		c.Images = []string{}
	}

	return nil
}

// GetByID retrieves a single complaint joined with author details and upvote status.
func (r *ComplaintRepository) GetByID(ctx context.Context, id int, currentUserID int) (*domain.Complaint, error) {
	query := `SELECT c.id, c.user_id, c.title, c.description, c.category, c.status, c.severity, c.upvotes, c.created_at, c.updated_at, c.department_id, c.reach, c.disruption, c.gpi, c.images, c.assigned_to, c.resolution_notes,
	                 u.first_name || ' ' || u.last_name as author_name, u.email as author_email,
	                 EXISTS(SELECT 1 FROM complaint_upvotes WHERE complaint_id = c.id AND user_id = $1) as has_upvoted
	          FROM complaints c
	          JOIN users u ON c.user_id = u.id
	          WHERE c.id = $2`

	var c domain.Complaint
	var images []string
	err := r.db.QueryRowContext(ctx, query, currentUserID, id).Scan(
		&c.ID, &c.UserID, &c.Title, &c.Description, &c.Category, &c.Status, &c.Severity, &c.Upvotes, &c.CreatedAt, &c.UpdatedAt, &c.DepartmentID,
		&c.Reach, &c.Disruption, &c.GPI, &images, &c.AssignedTo, &c.ResolutionNotes,
		&c.AuthorName, &c.AuthorEmail, &c.HasUpvoted,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get complaint by ID: %w", err)
	}

	c.Images = images
	if c.Images == nil {
		c.Images = []string{}
	}

	return &c, nil
}

// List retrieves a list of complaints filtered by optional parameters, sorted by GPI index and creation date.
func (r *ComplaintRepository) List(ctx context.Context, currentUserID int, category, status string, own bool, search string) ([]*domain.Complaint, error) {
	var conditions []string
	var args []interface{}
	argCount := 1

	query := `SELECT c.id, c.user_id, c.title, c.description, c.category, c.status, c.severity, c.upvotes, c.created_at, c.updated_at, c.department_id, c.reach, c.disruption, c.gpi, c.images, c.assigned_to, c.resolution_notes,
	                 u.first_name || ' ' || u.last_name as author_name, u.email as author_email,
	                 EXISTS(SELECT 1 FROM complaint_upvotes WHERE complaint_id = c.id AND user_id = $1) as has_upvoted
	          FROM complaints c
	          JOIN users u ON c.user_id = u.id`

	args = append(args, currentUserID)

	if category != "" {
		conditions = append(conditions, fmt.Sprintf("c.category = $%d", argCount+1))
		args = append(args, category)
		argCount++
	}

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("c.status = $%d", argCount+1))
		args = append(args, status)
		argCount++
	}

	if own {
		conditions = append(conditions, fmt.Sprintf("c.user_id = $%d", argCount+1))
		args = append(args, currentUserID)
		argCount++
	}

	if search != "" {
		conditions = append(conditions, fmt.Sprintf("(c.title ILIKE $%d OR c.description ILIKE $%d)", argCount+1, argCount+1))
		args = append(args, "%"+search+"%")
		argCount++
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	// Sort high dynamic priority complaints to the top of the timeline
	query += " ORDER BY c.gpi DESC, c.created_at DESC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query complaints timeline: %w", err)
	}
	defer rows.Close()

	complaints := make([]*domain.Complaint, 0)
	for rows.Next() {
		var c domain.Complaint
		var images []string
		err := rows.Scan(
			&c.ID, &c.UserID, &c.Title, &c.Description, &c.Category, &c.Status, &c.Severity, &c.Upvotes, &c.CreatedAt, &c.UpdatedAt, &c.DepartmentID,
			&c.Reach, &c.Disruption, &c.GPI, &images, &c.AssignedTo, &c.ResolutionNotes,
			&c.AuthorName, &c.AuthorEmail, &c.HasUpvoted,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan complaint: %w", err)
		}
		c.Images = images
		if c.Images == nil {
			c.Images = []string{}
		}
		complaints = append(complaints, &c)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return complaints, nil
}

// ToggleUpvote toggles an upvote for a user, atomically adjusts count, and recalculates the dynamic GPI score.
func (r *ComplaintRepository) ToggleUpvote(ctx context.Context, id int, userID int) (int, bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, false, fmt.Errorf("failed to start upvote transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if upvote row exists
	var exists bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM complaint_upvotes WHERE complaint_id = $1 AND user_id = $2)`
	err = tx.QueryRowContext(ctx, checkQuery, id, userID).Scan(&exists)
	if err != nil {
		return 0, false, fmt.Errorf("failed to verify active upvote: %w", err)
	}

	var newUpvotes int
	var hasUpvoted bool

	if exists {
		// Delete active upvote registry
		_, err = tx.ExecContext(ctx, `DELETE FROM complaint_upvotes WHERE complaint_id = $1 AND user_id = $2`, id, userID)
		if err != nil {
			return 0, false, fmt.Errorf("failed to remove upvote registration: %w", err)
		}

		// Atomic decrement
		err = tx.QueryRowContext(ctx, `UPDATE complaints SET upvotes = GREATEST(0, upvotes - 1) WHERE id = $1 RETURNING upvotes`, id).Scan(&newUpvotes)
		if err != nil {
			return 0, false, fmt.Errorf("failed to decrement upvotes counter: %w", err)
		}
		hasUpvoted = false
	} else {
		// Insert active upvote registry
		_, err = tx.ExecContext(ctx, `INSERT INTO complaint_upvotes (complaint_id, user_id) VALUES ($1, $2)`, id, userID)
		if err != nil {
			return 0, false, fmt.Errorf("failed to save upvote registration: %w", err)
		}

		// Atomic increment
		err = tx.QueryRowContext(ctx, `UPDATE complaints SET upvotes = upvotes + 1 WHERE id = $1 RETURNING upvotes`, id).Scan(&newUpvotes)
		if err != nil {
			return 0, false, fmt.Errorf("failed to increment upvotes counter: %w", err)
		}
		hasUpvoted = true
	}

	// Retrieve reach and disruption values to recalculate dynamic GPI score
	var reach, disruption int
	err = tx.QueryRowContext(ctx, `SELECT reach, disruption FROM complaints WHERE id = $1`, id).Scan(&reach, &disruption)
	if err != nil {
		return 0, false, fmt.Errorf("failed to query complaint reach/disruption: %w", err)
	}

	// Calculate GPI = min(100, reach * disruption * (1 + log10(upvotes)) * 4)
	var multiplier float64 = 1.0
	if newUpvotes > 0 {
		multiplier = 1.0 + math.Log10(float64(newUpvotes))
	}
	newGPI := int(math.Round(float64(reach) * float64(disruption) * multiplier * 4.0))
	if newGPI > 100 {
		newGPI = 100
	}

	_, err = tx.ExecContext(ctx, `UPDATE complaints SET gpi = $1 WHERE id = $2`, newGPI, id)
	if err != nil {
		return 0, false, fmt.Errorf("failed to update GPI priority index: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, false, fmt.Errorf("failed to commit upvote transaction: %w", err)
	}

	return newUpvotes, hasUpvoted, nil
}

// Claim assigns a complaint to a staff member.
func (r *ComplaintRepository) Claim(ctx context.Context, id int, staffName string) error {
	query := `UPDATE complaints SET status = 'assigned', assigned_to = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, staffName, id)
	if err != nil {
		return fmt.Errorf("failed to claim complaint assignment: %w", err)
	}
	return nil
}

// Reassign changes category, resets status to pending, and clears current staff assignment.
func (r *ComplaintRepository) Reassign(ctx context.Context, id int, nextCategory string) error {
	query := `UPDATE complaints SET category = $1, status = 'pending', assigned_to = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, nextCategory, id)
	if err != nil {
		return fmt.Errorf("failed to re-route category assignment: %w", err)
	}
	return nil
}

// Resolve marks a complaint as resolved and attaches official resolution notes.
func (r *ComplaintRepository) Resolve(ctx context.Context, id int, notes string) error {
	query := `UPDATE complaints SET status = 'resolved', resolution_notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, notes, id)
	if err != nil {
		return fmt.Errorf("failed to mark complaint as resolved: %w", err)
	}
	return nil
}
