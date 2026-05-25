package domain

import "time"

type User struct {
	ID           int       `json:"id"`
	Email        string    `json:"email"`
	PasswordHash *string   `json:"-"` // Nullable for SSO users
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	Role         string    `json:"role"` // 'student', 'faculty', 'staff', 'admin'
	MicrosoftID  *string   `json:"microsoft_id,omitempty"` // Nullable
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
