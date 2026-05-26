import React, { useState, useEffect, useRef } from 'react';
import { PostCard } from './PostCard';

interface User {
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
}

interface TimelineFeedProps {
  complaints: Complaint[];
  onUpdateComplaint: (id: number, updatedFields: Partial<Complaint>) => void;
  onCreateComplaint: (title: string, category: string, severity: string, description: string, images?: string[]) => void;
  showToast: (message: string, type?: 'cyan' | 'emerald' | 'amber' | 'rose') => void;
  user: User;
  isOwnOnly: boolean;
  searchVal: string;
  setSearchVal: (val: string) => void;
}

export const TimelineFeed: React.FC<TimelineFeedProps> = ({
  complaints,
  onUpdateComplaint,
  onCreateComplaint,
  showToast,
  user,
  isOwnOnly,
  searchVal,
  setSearchVal,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('hostel');
  const [severity, setSeverity] = useState('medium');
  const [sortCriteria, setSortCriteria] = useState<'priority' | 'newest'>('priority');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const quillInstanceRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Quill dynamically when expanded
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        const editorContainer = document.getElementById('editor-container');
        if (editorContainer && !(window as any).Quill.find(editorContainer)) {
          quillInstanceRef.current = new (window as any).Quill('#editor-container', {
            theme: 'snow',
            placeholder: 'Describe exact locations, timelines, and details of the outage...',
            modules: {
              toolbar: [
                ['bold', 'italic', 'underline'],
                [{ list: 'bullet' }],
                ['link', 'clean'],
              ],
            },
          });
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      quillInstanceRef.current = null;
    }
  }, [isExpanded]);

  const handleCancel = () => {
    setIsExpanded(false);
    setTitle('');
    setCategory('hostel');
    setSeverity('medium');
    setSelectedImages([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Simulate asking permission (as requested)
    showToast("Requesting device media library and camera permissions...", "cyan");

    setTimeout(() => {
      const readPromises = Array.from(files).map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              resolve(event.target.result as string);
            }
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readPromises).then((results) => {
        setSelectedImages((prev) => [...prev, ...results]);
        showToast(`Permission verified. Attached ${results.length} image(s).`, "emerald");
      });
    }, 400); // 400ms visual feedback delay for permissions prompt
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quillInstanceRef.current) return;

    const descriptionHtml = quillInstanceRef.current.root.innerHTML;
    const plainText = quillInstanceRef.current.getText().trim();

    if (plainText === '') {
      showToast('Details of the outage are required.', 'rose');
      return;
    }

    setIsBroadcasting(true);
    setTimeout(() => {
      onCreateComplaint(title, category, severity, descriptionHtml, selectedImages);
      setIsBroadcasting(false);
      handleCancel();
    }, 800);
  };

  // Filter complaints based on search value, category filter, and isOwnOnly
  const filteredComplaints = complaints.filter((c) => {
    const matchesOwn = !isOwnOnly || c.authorEmail === user.email;
    const matchesCat = filterCategory === 'all' || c.category === filterCategory;
    const searchLower = searchVal.toLowerCase();
    const matchesSearch =
      searchVal === '' ||
      c.title.toLowerCase().includes(searchLower) ||
      c.description.toLowerCase().includes(searchLower) ||
      c.authorName.toLowerCase().includes(searchLower);

    return matchesOwn && matchesCat && matchesSearch;
  });

  // Sort complaints based on sort criteria
  const sortedComplaints = [...filteredComplaints].sort((a, b) => {
    if (sortCriteria === 'priority') {
      return b.gpi - a.gpi;
    } else {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const userInitial = user.first_name ? user.first_name.charAt(0).toUpperCase() : 'S';

  return (
    <div id="tab-feed" className="tab-content active">
      {/* 🚀 INLINE QUICK COMPOSER */}
      {!isOwnOnly && (
        <div className={`glass-card quick-composer-card ${isExpanded ? 'expanded' : ''}`} id="quick-composer">
          {!isExpanded ? (
            <div className="composer-collapsed" onClick={() => setIsExpanded(true)}>
              <div className="user-avatar mini">{userInitial}</div>
              <div className="composer-placeholder">
                Report an active GIKI outage, @{user.first_name ? user.first_name.toLowerCase() : 'user'}...
              </div>
            </div>
          ) : (
            <div className="composer-expanded">
              <h4>Report Outage</h4>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Outage Title (e.g. Hostel 12 plumbing fused)"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                      <option value="hostel">Hostel</option>
                      <option value="mess">Mess & Dining</option>
                      <option value="academic">Academic Wing</option>
                      <option value="it_services">Wifi & Network</option>
                      <option value="electricity">Electricity</option>
                      <option value="plumbing">Plumbing & Water</option>
                      <option value="security">Security</option>
                      <option value="other">General</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Urgency State</label>
                    <select value={severity} onChange={(e) => setSeverity(e.target.value)} required>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Outage Details</label>
                  <div id="editor-container" style={{ height: '120px' }}></div>
                </div>

                {/* Upload Thumbnail Previews */}
                {selectedImages.length > 0 && (
                  <div className="composer-previews">
                    {selectedImages.map((src, idx) => (
                      <div key={idx} className="preview-thumbnail">
                        <img src={src} alt="Upload preview" />
                        <button
                          type="button"
                          className="remove-preview-btn"
                          onClick={() => removeSelectedImage(idx)}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="composer-actions-row">
                  {/* Gallery/PC Media Attachment Trigger */}
                  <div className="composer-attachments" style={{ marginRight: 'auto' }}>
                    <button
                      type="button"
                      className="composer-action-btn"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach outage pictures"
                      disabled={isBroadcasting}
                    >
                      <svg viewBox="0 0 24 24" className="composer-action-icon" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>Add Media</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-cancel-composer"
                    onClick={handleCancel}
                    disabled={isBroadcasting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-submit-timeline" disabled={isBroadcasting}>
                    {isBroadcasting ? 'Broadcasting...' : 'Broadcast Outage'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {isOwnOnly && (
        <div className="tab-header-minimal">
          <h2>My Submission Logs</h2>
          <p>Track progress of outages reported by your authenticated GIKI session.</p>
        </div>
      )}

      {/* Timeline Filters / Sorting Options */}
      <div className="timeline-feed-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="feed-sort-triggers" style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className={`sort-btn ${sortCriteria === 'priority' ? 'active' : ''}`}
            onClick={() => setSortCriteria('priority')}
          >
            Priority Rank
          </button>
          <button
            type="button"
            className={`sort-btn ${sortCriteria === 'newest' ? 'active' : ''}`}
            onClick={() => setSortCriteria('newest')}
          >
            Recent Updates
          </button>
        </div>
        <div className="filter-actions-inline" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search timeline..."
            className="filter-search-input"
            style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'var(--color-text-header)',
              fontSize: '11.5px',
              outline: 'none',
              width: '160px',
              transition: 'var(--transition-smooth)'
            }}
          />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">All Sectors</option>
            <option value="hostel">Hostel</option>
            <option value="mess">Mess</option>
            <option value="academic">Academic</option>
            <option value="it_services">Wifi & Network</option>
            <option value="electricity">Electricity</option>
            <option value="plumbing">Plumbing & Water</option>
            <option value="security">Security</option>
          </select>
        </div>
      </div>

      {/* Complaints Feed List */}
      <div className="timeline-posts-list">
        {sortedComplaints.length === 0 ? (
          <div className="glass-card empty-state">
            <h4>No active incidents reported</h4>
            <p>Timeline is completely clear.</p>
          </div>
        ) : (
          sortedComplaints.map((c) => (
            <PostCard
              key={c.id}
              complaint={c}
              onUpdateComplaint={onUpdateComplaint}
              showToast={showToast}
            />
          ))
        )}
      </div>
    </div>
  );
};
