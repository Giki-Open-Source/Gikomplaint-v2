package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/giki-open-source/gikomplaint-v2/internal/domain"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

// GetByEmail retrieves a user by their email address.
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `SELECT id, email, password_hash, first_name, last_name, role, microsoft_id, created_at, updated_at 
	          FROM users WHERE email = $1`

	var user domain.User
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FirstName,
		&user.LastName,
		&user.Role,
		&user.MicrosoftID,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, fmt.Errorf("error querying user by email: %w", err)
	}

	return &user, nil
}

// GetByMicrosoftID retrieves a user by their unique Microsoft identity.
func (r *UserRepository) GetByMicrosoftID(ctx context.Context, msID string) (*domain.User, error) {
	query := `SELECT id, email, password_hash, first_name, last_name, role, microsoft_id, created_at, updated_at 
	          FROM users WHERE microsoft_id = $1`

	var user domain.User
	err := r.db.QueryRowContext(ctx, query, msID).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FirstName,
		&user.LastName,
		&user.Role,
		&user.MicrosoftID,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, fmt.Errorf("error querying user by microsoft_id: %w", err)
	}

	return &user, nil
}

// Create inserts a new user record.
func (r *UserRepository) Create(ctx context.Context, user *domain.User) error {
	query := `INSERT INTO users (email, password_hash, first_name, last_name, role, microsoft_id) 
	          VALUES ($1, $2, $3, $4, $5, $6) 
	          RETURNING id, created_at, updated_at`

	err := r.db.QueryRowContext(ctx, query,
		user.Email,
		user.PasswordHash,
		user.FirstName,
		user.LastName,
		user.Role,
		user.MicrosoftID,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return fmt.Errorf("error creating user: %w", err)
	}

	return nil
}

// Update updates an existing user record.
func (r *UserRepository) Update(ctx context.Context, user *domain.User) error {
	query := `UPDATE users 
	          SET email = $1, password_hash = $2, first_name = $3, last_name = $4, role = $5, microsoft_id = $6, updated_at = CURRENT_TIMESTAMP 
	          WHERE id = $7`

	_, err := r.db.ExecContext(ctx, query,
		user.Email,
		user.PasswordHash,
		user.FirstName,
		user.LastName,
		user.Role,
		user.MicrosoftID,
		user.ID,
	)

	if err != nil {
		return fmt.Errorf("error updating user: %w", err)
	}

	return nil
}
