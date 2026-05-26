import React, { useState } from 'react';

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
}

interface PostCardProps {
  complaint: Complaint;
  onUpdateComplaint: (id: number, updatedFields: Partial<Complaint>) => void;
  showToast: (message: string, type?: 'cyan' | 'emerald' | 'amber' | 'rose') => void;
}

// GPI = Reach * Disruption * (1 + log10(upvotes)) * 4 [Capped at 100]
const calculateGPI = (reach: number, disruption: number, upvotes: number): number => {
  const multiplier = 1 + Math.log10(upvotes || 1);
  let score = Math.round(reach * disruption * multiplier * 4);
  if (score > 100) score = 100;
  return score;
};

const getReachLabel = (val: number): string => {
  const labels: Record<number, string> = {
    1: 'Single Room',
    2: 'Wing Corridor',
    3: 'Communal Ward',
    4: 'Hostel Block',
    5: 'Campus Wide',
  };
  return labels[val] || 'Wing corridor';
};

const getDisruptLabel = (val: number): string => {
  const labels: Record<number, string> = {
    1: 'Minor Glitch',
    2: 'Distracting',
    3: 'Disruptive',
    4: 'Severe Outage',
    5: 'Total Grid Down',
  };
  return labels[val] || 'Severe Outage';
};

const getRelativeTime = (createdAtStr: string): string => {
  const prevDate = new Date(createdAtStr);
  const diffMs = Date.now() - prevDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export const PostCard: React.FC<PostCardProps> = ({
  complaint,
  onUpdateComplaint,
  showToast,
}) => {
  const [isScorerOpen, setIsScorerOpen] = useState(false);

  const authorHandle = `@${complaint.authorName.replace(/\s+/g, '')}`;
  const relativeTime = getRelativeTime(complaint.createdAt);

  // Set visual priority badges based on score
  let gpiClass = 'gpi-low';
  if (complaint.gpi >= 75) gpiClass = 'gpi-critical';
  else if (complaint.gpi >= 50) gpiClass = 'gpi-high';
  else if (complaint.gpi >= 25) gpiClass = 'gpi-medium';

  const handleUpvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    let newUpvotes = complaint.upvotes;
    let newHasUpvoted = !complaint.hasUpvoted;

    if (complaint.hasUpvoted) {
      newUpvotes = Math.max(0, newUpvotes - 1);
      showToast('Retracted support.', 'amber');
    } else {
      newUpvotes = newUpvotes + 1;
      showToast('Supported incident report.', 'emerald');
    }

    const newGpi = calculateGPI(complaint.reach, complaint.disruption, newUpvotes);
    onUpdateComplaint(complaint.id, {
      upvotes: newUpvotes,
      hasUpvoted: newHasUpvoted,
      gpi: newGpi,
    });
  };

  const handleSliderChange = (field: 'reach' | 'disruption', value: number) => {
    const nextFields: Partial<Complaint> = { [field]: value };
    const reach = field === 'reach' ? value : complaint.reach;
    const disruption = field === 'disruption' ? value : complaint.disruption;
    nextFields.gpi = calculateGPI(reach, disruption, complaint.upvotes);
    onUpdateComplaint(complaint.id, nextFields);
  };

  return (
    <div className="complaint-card">
      <div className="comp-avatar-col">
        <div className="user-avatar">
          {complaint.authorName ? complaint.authorName.charAt(0).toUpperCase() : 'G'}
        </div>
      </div>

      <div className="comp-main-col">
        <div className="comp-header-row">
          <div className="comp-user-info">
            <strong className="comp-author-name">{complaint.authorName}</strong>
            <span className="comp-author-meta">
              {authorHandle} &middot; {complaint.authorEmail}
            </span>
            <span className="comp-dot">&middot;</span>
            <span className="comp-time-ago">{relativeTime}</span>
          </div>

          <div className={`comp-priority-badge ${gpiClass}`}>
            GPI {complaint.gpi}
          </div>
        </div>

        <div className="comp-body">
          <h3 className="comp-title">{complaint.title}</h3>
          <div
            className="comp-body-desc"
            dangerouslySetInnerHTML={{ __html: complaint.description }}
          />

          {complaint.images && complaint.images.length > 0 && (
            <div className="comp-images-grid">
              {complaint.images.map((imgSrc, idx) => (
                <img key={idx} src={imgSrc} alt="Outage incident attach" onClick={(e) => {
                  e.stopPropagation();
                }} />
              ))}
            </div>
          )}

          <div className="comp-meta-tags">
            <span className={`badge badge-cat-${complaint.category}`}>
              {complaint.category.replace('_', ' ')}
            </span>
            <span className={`badge badge-severity-${complaint.severity}`}>
              {complaint.severity}
            </span>
            <span className={`badge badge-status-${complaint.status}`}>
              {complaint.status}
            </span>
          </div>
        </div>

        {/* Social actions */}
        <div className="comp-social-actions">
          <button
            className={`action-btn action-btn-upvote ${complaint.hasUpvoted ? 'active' : ''}`}
            onClick={handleUpvote}
            title="Support incident report"
          >
            <svg viewBox="0 0 24 24" className="action-icon-svg" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
            <span className="upvote-count">{complaint.upvotes}</span>
          </button>

          <button
            className={`action-btn action-btn-score ${isScorerOpen ? 'active' : ''}`}
            onClick={() => setIsScorerOpen(!isScorerOpen)}
            title="Evaluate severity index"
          >
            <svg viewBox="0 0 24 24" className="action-icon-svg" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>Evaluate</span>
          </button>
        </div>

        {/* Nested Scorer Slider Panel */}
        {isScorerOpen && (
          <div className="scorer-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="scorer-card">
              <div className="scorer-row">
                <div className="score-control">
                  <div className="score-control-header">
                    <label>Reach Scale</label>
                    <span>{getReachLabel(complaint.reach)}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={complaint.reach}
                    onChange={(e) => handleSliderChange('reach', parseInt(e.target.value))}
                    className="slider-reach"
                  />
                </div>
                <div className="score-control">
                  <div className="score-control-header">
                    <label>Disruption Scale</label>
                    <span>{getDisruptLabel(complaint.disruption)}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={complaint.disruption}
                    onChange={(e) => handleSliderChange('disruption', parseInt(e.target.value))}
                    className="slider-disrupt"
                  />
                </div>
              </div>
              <div className="scorer-drawer-footer">
                <span className="scorer-summary-desc">
                  Adjust sliders to dynamically evaluate incident impact indices.
                </span>
                <div className="scorer-index-badge">
                  <span>Calculated GPI:</span> <strong>{complaint.gpi} / 100</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
