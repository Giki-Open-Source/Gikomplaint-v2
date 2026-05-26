package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/giki-open-source/gikomplaint-v2/internal/domain"
	"github.com/giki-open-source/gikomplaint-v2/internal/service"
)

type ComplaintHandler struct {
	complaintService *service.ComplaintService
}

func NewComplaintHandler(complaintService *service.ComplaintService) *ComplaintHandler {
	return &ComplaintHandler{complaintService: complaintService}
}

type CreateComplaintRequest struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Severity    string   `json:"severity"`
	Reach       int      `json:"reach"`
	Disruption  int      `json:"disruption"`
	Images      []string `json:"images"`
}

type ReassignRequest struct {
	Category string `json:"category"`
}

type ResolveRequest struct {
	ResolutionNotes string `json:"resolutionNotes"`
}

// CreateComplaint handles POST /api/complaints
func (h *ComplaintHandler) CreateComplaint(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	if user == nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized session context")
		return
	}

	var req CreateComplaintRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request JSON payload")
		return
	}

	if req.Title == "" || req.Description == "" || req.Category == "" {
		respondWithError(w, http.StatusBadRequest, "Missing required complaint parameters (title, description, category)")
		return
	}

	complaint := &domain.Complaint{
		UserID:      user.ID,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Severity:    req.Severity,
		Reach:       req.Reach,
		Disruption:  req.Disruption,
		Images:      req.Images,
	}

	if err := h.complaintService.CreateComplaint(r.Context(), complaint); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to broadcast incident: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(complaint)
}

// ListComplaints handles GET /api/complaints
func (h *ComplaintHandler) ListComplaints(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	if user == nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized session context")
		return
	}

	// Read optional query filtering parameters
	q := r.URL.Query()
	category := q.Get("category")
	status := q.Get("status")
	search := q.Get("search")
	own, _ := strconv.ParseBool(q.Get("own"))

	complaints, err := h.complaintService.ListComplaints(r.Context(), user.ID, category, status, own, search)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch incidents list: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(complaints)
}

// ToggleUpvote handles POST /api/complaints/{id}/upvote
func (h *ComplaintHandler) ToggleUpvote(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	if user == nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized session context")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid complaint identifier format")
		return
	}

	upvotes, hasUpvoted, err := h.complaintService.ToggleUpvote(r.Context(), id, user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update upvote status: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"upvotes":    upvotes,
		"hasUpvoted": hasUpvoted,
	})
}

// ClaimComplaint handles POST /api/complaints/{id}/claim (locked to staff/admin)
func (h *ComplaintHandler) ClaimComplaint(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromContext(r.Context())
	if user == nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized session context")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid complaint identifier format")
		return
	}

	// Claim using the dispatcher's name from JWT payload
	staffName := user.Name
	if err := h.complaintService.ClaimComplaint(r.Context(), id, staffName); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to register operator assignment: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":     "success",
		"assignedTo": staffName,
	})
}

// ReassignComplaint handles POST /api/complaints/{id}/reassign (locked to staff/admin)
func (h *ComplaintHandler) ReassignComplaint(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid complaint identifier format")
		return
	}

	var req ReassignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid category update JSON payload")
		return
	}

	if req.Category == "" {
		respondWithError(w, http.StatusBadRequest, "Missing reassign category designation")
		return
	}

	if err := h.complaintService.ReassignComplaint(r.Context(), id, req.Category); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to re-route category assignment: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
	})
}

// ResolveComplaint handles POST /api/complaints/{id}/resolve (locked to staff/admin)
func (h *ComplaintHandler) ResolveComplaint(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid complaint identifier format")
		return
	}

	var req ResolveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid resolution note JSON payload")
		return
	}

	if req.ResolutionNotes == "" {
		respondWithError(w, http.StatusBadRequest, "Missing official resolution steps remarks")
		return
	}

	if err := h.complaintService.ResolveComplaint(r.Context(), id, req.ResolutionNotes); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to mark incident as resolved: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
	})
}
