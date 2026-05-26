package domain

import "time"

// Complaint represents an outage incident logged by a user.
type Complaint struct {
	ID              int       `json:"id"`
	UserID          int       `json:"user_id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Category        string    `json:"category"`
	Status          string    `json:"status"`
	Severity        string    `json:"severity"`
	Upvotes         int       `json:"upvotes"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	DepartmentID    *int      `json:"department_id"`
	Reach           int       `json:"reach"`
	Disruption      int       `json:"disruption"`
	GPI             int       `json:"gpi"`
	Images          []string  `json:"images"`
	AssignedTo      *string   `json:"assignedTo,omitempty"`
	ResolutionNotes *string   `json:"resolutionNotes,omitempty"`

	// Preloaded / Custom Joined Fields
	AuthorName  string `json:"authorName,omitempty"`
	AuthorEmail string `json:"authorEmail,omitempty"`
	HasUpvoted  bool   `json:"hasUpvoted"`
}
