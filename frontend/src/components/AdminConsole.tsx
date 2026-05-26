import React, { useState } from 'react';

interface User {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface Complaint {
  id: number;
  title: string;
  category: string;
  severity: string;
  status: string;
  description: string;
  upvotes: number;
  hasUpvoted: boolean;
  reach: number;
  disruption: number;
  gpi: number;
  authorName: string;
  authorEmail: string;
  createdAt: string;
  images?: string[];
  assignedTo?: string;
  resolutionNotes?: string;
}

interface AdminConsoleProps {
  complaints: Complaint[];
  onUpdateComplaint: (id: number, updatedFields: Partial<Complaint>) => void;
  showToast: (message: string, type?: 'cyan' | 'emerald' | 'amber' | 'rose') => void;
  user: User;
}

const DEPARTMENTS = [
  { id: 1, name: 'IT Helpdesk & Networks', categories: ['it_services'] },
  { id: 2, name: 'Plumbing & Water Management', categories: ['plumbing'] },
  { id: 3, name: 'Electricity & Power Maintenance', categories: ['electricity'] },
  { id: 4, name: 'Mess & Dining Operations', categories: ['mess'] },
  { id: 5, name: 'Hostel Facility Maintenance', categories: ['hostel'] },
  { id: 6, name: 'Campus Safety & Security', categories: ['security'] },
  { id: 7, name: 'Other Infrastructure & Support', categories: ['academic', 'other'] },
];

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  complaints,
  onUpdateComplaint,
  showToast,
  user,
}) => {
  // Staff are assigned a default department, admins can access everything
  const defaultDeptId = user.role === 'staff' ? 2 : 1; // Plumbing for staff demo
  const [selectedDeptId, setSelectedDeptId] = useState<number>(defaultDeptId);
  const [activeIncidentId, setActiveIncidentId] = useState<number | null>(null);
  const [resNotes, setResNotes] = useState('');

  const currentDept = DEPARTMENTS.find((d) => d.id === selectedDeptId) || DEPARTMENTS[0];

  // Filter complaints assigned to this department by category mapping
  const deptComplaints = complaints.filter((c) =>
    currentDept.categories.includes(c.category)
  );

  const activeIncident = complaints.find((c) => c.id === activeIncidentId);

  const handleClaim = (complaintId: number) => {
    onUpdateComplaint(complaintId, {
      status: 'assigned',
      assignedTo: `${user.first_name} ${user.last_name}`,
    });
    showToast('Incident successfully claimed for operations.', 'emerald');
  };

  const handleReassignDept = (complaintId: number, targetDeptId: number) => {
    const targetDept = DEPARTMENTS.find((d) => d.id === targetDeptId);
    if (!targetDept) return;

    // Move category automatically to match the target department's primary category
    const nextCategory = targetDept.categories[0];
    onUpdateComplaint(complaintId, {
      category: nextCategory,
      assignedTo: undefined, // Clear assignment since department changed
      status: 'pending',     // Shift back to pending queue
    });

    if (activeIncidentId === complaintId) {
      setActiveIncidentId(null);
    }
    showToast(`Incident re-routed to ${targetDept.name}.`, 'amber');
  };

  const handleResolve = (e: React.FormEvent, complaintId: number) => {
    e.preventDefault();
    if (resNotes.trim() === '') {
      showToast('Resolution details are required.', 'rose');
      return;
    }

    onUpdateComplaint(complaintId, {
      status: 'resolved',
      resolutionNotes: resNotes,
    });

    setResNotes('');
    showToast('Incident marked as successfully RESOLVED.', 'emerald');
  };

  return (
    <div className="admin-console-layout">
      {/* Upper Control Bar */}
      <div className="admin-bar-header">
        <div className="dept-selector-block">
          <label>Operational Sector Queue</label>
          <select
            value={selectedDeptId}
            onChange={(e) => {
              setSelectedDeptId(parseInt(e.target.value));
              setActiveIncidentId(null);
            }}
            disabled={user.role === 'staff'} // Staff are locked to their sector
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} {user.role === 'staff' && dept.id === defaultDeptId ? '(Assigned)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-metrics-mini">
          <div className="mini-metric-item">
            <span className="lbl">Active Pipeline</span>
            <strong>
              {deptComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'closed').length}
            </strong>
          </div>
          <div className="mini-metric-item">
            <span className="lbl">Resolved Base</span>
            <strong>
              {deptComplaints.filter((c) => c.status === 'resolved').length}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Admin Workspace Grid */}
      <div className="admin-workspace-grid">
        {/* Left Side: Incidents Queue */}
        <div className="admin-inbox-column">
          <h3>Routed Incidents ({deptComplaints.length})</h3>
          
          {deptComplaints.length === 0 ? (
            <div className="empty-inbox-state">
              <span>▩</span>
              <p>Queue is completely clear.</p>
              <span>No outstanding incidents in this department.</span>
            </div>
          ) : (
            <div className="admin-queue-list">
              {deptComplaints.map((c) => {
                let statusClass = 'status-badge-pending';
                if (c.status === 'assigned') statusClass = 'status-badge-assigned';
                if (c.status === 'resolved') statusClass = 'status-badge-resolved';

                return (
                  <div
                    key={c.id}
                    className={`queue-item-card ${activeIncidentId === c.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveIncidentId(c.id);
                      setResNotes('');
                    }}
                  >
                    <div className="queue-item-header">
                      <span className={`status-pill ${statusClass}`}>{c.status}</span>
                      <span className="queue-item-gpi">GPI {c.gpi}</span>
                    </div>
                    <h4>{c.title}</h4>
                    <div className="queue-item-footer">
                      <span>Reported by: {c.authorName}</span>
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Incident Inspector Details */}
        <div className="admin-inspector-column">
          {activeIncident ? (
            <div className="inspector-panel-container">
              <div className="inspector-panel-header">
                <h2>Outage Incident Inspector</h2>
                <span className="incident-id">LOG ID #{activeIncident.id}</span>
              </div>

              <div className="inspector-details-card">
                <h3>{activeIncident.title}</h3>
                
                <div className="inspector-meta-row">
                  <span className="meta-lbl">Category: <strong>{activeIncident.category.replace('_', ' ')}</strong></span>
                  <span className="meta-lbl">Urgency: <strong>{activeIncident.severity}</strong></span>
                  <span className="meta-lbl">GPI Score: <strong>{activeIncident.gpi} / 100</strong></span>
                </div>

                <div 
                  className="inspector-desc-box"
                  dangerouslySetInnerHTML={{ __html: activeIncident.description }}
                />

                {activeIncident.images && activeIncident.images.length > 0 && (
                  <div className="inspector-media-box">
                    {activeIncident.images.map((img, idx) => (
                      <img key={idx} src={img} alt="Attached incident screenshot" />
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment Claims Drawer */}
              <div className="inspector-action-section">
                <h3>Operational Assignment</h3>
                {activeIncident.status === 'resolved' ? (
                  <div className="inspector-resolved-success">
                    <h4>✔ Outage Resolved</h4>
                    <p>Official resolution details submitted by staff dispatcher:</p>
                    <div className="resolved-notes-content">
                      {activeIncident.resolutionNotes}
                    </div>
                  </div>
                ) : (
                  <div className="assignment-control-card">
                    {activeIncident.assignedTo ? (
                      <div className="assigned-status-banner">
                        <span>👤 Active Dispatcher: <strong>{activeIncident.assignedTo}</strong></span>
                        <span className="assigned-status-helper">Status: {activeIncident.status}</span>
                      </div>
                    ) : (
                      <div className="unassigned-banner">
                        <span>⚠ Incident Unassigned</span>
                        <button
                          type="button"
                          className="btn btn-claim"
                          onClick={() => handleClaim(activeIncident.id)}
                        >
                          Claim Incident (Assign to Me)
                        </button>
                      </div>
                    )}

                    {/* Resolution Form (Displays once assigned) */}
                    {activeIncident.assignedTo && (
                      <form 
                        className="resolution-form" 
                        onSubmit={(e) => handleResolve(e, activeIncident.id)}
                      >
                        <div className="form-group">
                          <label>Incident Resolution Steps</label>
                          <textarea
                            value={resNotes}
                            onChange={(e) => setResNotes(e.target.value)}
                            required
                            placeholder="Describe action taken, hardware replacement, timelines, or maintenance reports..."
                            rows={3}
                          />
                        </div>
                        <button type="submit" className="btn btn-resolve">
                          Submit Official Resolution
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Department Re-routing Engine */}
              {activeIncident.status !== 'resolved' && (
                <div className="inspector-action-section border-top">
                  <h3>Incident Re-routing Engine</h3>
                  <p className="reassign-desc">
                    If this incident belongs in a different sector, re-route it to automatically assign a new dispatcher.
                  </p>
                  <div className="reassign-selector-row">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleReassignDept(activeIncident.id, parseInt(e.target.value));
                        }
                      }}
                    >
                      <option value="" disabled>-- Select Destination Department --</option>
                      {DEPARTMENTS.filter((d) => d.id !== selectedDeptId).map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-inspector-state">
              <span>🔍</span>
              <h3>No Incident Selected</h3>
              <p>Select an logged outage from the routing queue to inspect details, dispatch staff, or submit resolutions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
