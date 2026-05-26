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
    <div className="glass-card complaint-card">
      <div className="comp-header">
        <div className="comp-user-block">
          <div className="user-avatar">
            {complaint.authorName ? complaint.authorName.charAt(0).toUpperCase() : 'G'}
          </div>
          <div className="comp-user-meta">
            <h4>{complaint.authorName}</h4>
            <span>{authorHandle} &bull; {complaint.authorEmail}</span>
          </div>
        </div>

        {/* Dynamic priority index badge */}
        <div className={`comp-priority-badge ${gpiClass}`}>
          GPI {complaint.gpi}
        </div>
      </div>

      <div className="comp-content-wrapper">
        <h3>{complaint.title}</h3>
        <div
          className="comp-body-desc"
          dangerouslySetInnerHTML={{ __html: complaint.description }}
        />

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
        >
          <span>▲</span> <strong className="upvote-count">{complaint.upvotes}</strong> Support
        </button>
        <button
          className={`action-btn action-btn-score ${isScorerOpen ? 'active' : ''}`}
          onClick={() => setIsScorerOpen(!isScorerOpen)}
        >
          <span>⚙</span> Evaluate
        </button>
        <span className="comp-time-ago">{relativeTime}</span>
      </div>

      {/* Nested Scorer Slider Panel */}
      {isScorerOpen && (
        <div className="scorer-drawer">
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
  );
};
