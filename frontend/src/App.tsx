import { useState, useEffect } from 'react';
import { SlimNavbar } from './components/SlimNavbar';
import { TimelineFeed } from './components/TimelineFeed';
import { AnalyticsConsole } from './components/AnalyticsConsole';

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

// Initial Mock Complaints Data
const initialComplaints: Complaint[] = [
  {
    id: 1,
    title: 'Hostel 12 ground floor washroom water outage',
    category: 'plumbing',
    severity: 'critical',
    status: 'assigned',
    description:
      'There is absolutely no water pressure in the communal washrooms on the ground floor of Hostel 12 since 8 AM today. It is impossible to use the washrooms or shower. Needs urgent plumber dispatch.',
    upvotes: 89,
    hasUpvoted: true,
    reach: 4, // 4 = Hostel-wide
    disruption: 5, // 5 = Total Outage
    gpi: 95,
    authorName: 'Zainab Ali',
    authorEmail: 'u2022091@giki.edu.pk',
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    id: 2,
    title: 'Mess 2 dinner served uncooked and unhygienic',
    category: 'mess',
    severity: 'high',
    status: 'pending',
    description:
      "The chicken served during tonight's dinner was completely raw on the inside. Several students complained to the mess manager, but no corrective action was taken. This is a severe health hazard.",
    upvotes: 42,
    hasUpvoted: false,
    reach: 3, // 3 = Wing-wide
    disruption: 4, // 4 = Severe Blockage
    gpi: 78,
    authorName: 'Ahmad Kamal',
    authorEmail: 'u2021045@giki.edu.pk',
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
  },
  {
    id: 3,
    title: 'Campus Wi-Fi extremely slow in library wing',
    category: 'it_services',
    severity: 'medium',
    status: 'resolved',
    description:
      'The primary Wi-Fi hotspot in the new library wing is dropping connections constantly. Speeds are hovering around 0.5 Mbps, making it impossible to download academic research papers.',
    upvotes: 18,
    hasUpvoted: false,
    reach: 2, // 2 = Corridor
    disruption: 3, // 3 = Distracting
    gpi: 54,
    authorName: 'Usman Khan',
    authorEmail: 'u2021110@giki.edu.pk',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 4,
    title: 'Hostel 8 corridor tube lights fused',
    category: 'electricity',
    severity: 'low',
    status: 'closed',
    description:
      'Three tube lights in the central corridor of Hostel 8 (first floor) are flickering constantly or completely fused. Minor electrical maintenance issue.',
    upvotes: 5,
    hasUpvoted: false,
    reach: 1, // 1 = Room
    disruption: 2, // 2 = Minor inconvenience
    gpi: 14,
    authorName: 'Sarah Jamil',
    authorEmail: 'u2023202@giki.edu.pk',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'my-complaints' | 'analytics'>('feed');
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [searchVal, setSearchVal] = useState('');

  // 1. Toast notifications using CDN Toastify
  const showToast = (message: string, type: 'cyan' | 'emerald' | 'amber' | 'rose' = 'cyan') => {
    let borderGlow = 'rgba(255,255,255,0.08)'; // Slate border by default
    if (type === 'emerald') borderGlow = 'rgba(16, 185, 129, 0.3)';
    if (type === 'amber') borderGlow = 'rgba(249, 115, 22, 0.3)';
    if (type === 'rose') borderGlow = 'rgba(239, 68, 68, 0.3)';

    if ((window as any).Toastify) {
      (window as any).Toastify({
        text: message,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        stopOnFocus: true,
        style: {
          background: '#111217',
          border: `1px solid ${borderGlow}`,
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
        },
      }).showToast();
    } else {
      console.log(`[Toast - ${type}]: ${message}`);
    }
  };

  // 2. Parse URL Session callback and load from Local Storage on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const callbackToken = urlParams.get('token');
    const callbackUser = urlParams.get('user');

    if (callbackToken && callbackUser) {
      try {
        const decodedUser = JSON.parse(decodeURIComponent(callbackUser)) as User;
        localStorage.setItem('giko_token', callbackToken);
        localStorage.setItem('giko_user', JSON.stringify(decodedUser));
        setToken(callbackToken);
        setUser(decodedUser);
        showToast(`Access Granted. Welcome back, ${decodedUser.first_name}.`, 'emerald');
      } catch (e) {
        console.error('Failed to parse URL session information', e);
        showToast('SSO authentication callback failed.', 'rose');
      }
      // Clean query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Load standard local session if exists
      const savedToken = localStorage.getItem('giko_token');
      const savedUserStr = localStorage.getItem('giko_user');
      if (savedToken && savedUserStr) {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUserStr) as User);
        } catch (e) {
          clearSession();
        }
      }
    }
  }, []);

  const storeSession = (sessionToken: string, sessionUser: User) => {
    localStorage.setItem('giko_token', sessionToken);
    localStorage.setItem('giko_user', JSON.stringify(sessionUser));
    setToken(sessionToken);
    setUser(sessionUser);
  };

  const clearSession = () => {
    localStorage.removeItem('giko_token');
    localStorage.removeItem('giko_user');
    setToken(null);
    setUser(null);
    showToast('Session terminated.', 'amber');
  };

  const handleSandboxLogin = () => {
    const mockUser: User = {
      id: 101,
      email: 'student_demo@giki.edu.pk',
      first_name: 'Demo',
      last_name: 'Student',
      role: 'student',
    } as any;
    const mockToken = 'simulated_jwt_token_for_sandbox';
    storeSession(mockToken, mockUser);
    showToast('Demo session initiated.', 'cyan');
  };

  const handleUpdateComplaint = (id: number, updatedFields: Partial<Complaint>) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updatedFields } : c))
    );
  };

  const handleCreateComplaint = (
    title: string,
    category: string,
    severity: string,
    description: string
  ) => {
    if (!user) return;

    // Calculate dynamic starting index
    const reach = 3; // default: Wing-wide
    const disruption = 3; // default: Distracting
    const upvotes = 1;
    const multiplier = 1 + Math.log10(upvotes);
    const startingGpi = Math.round(reach * disruption * multiplier * 4);

    const newComplaint: Complaint = {
      id: complaints.length + 1,
      title,
      category,
      severity,
      status: 'pending',
      description,
      upvotes,
      hasUpvoted: true,
      reach,
      disruption,
      gpi: startingGpi > 100 ? 100 : startingGpi,
      authorName: `${user.first_name} ${user.last_name}`,
      authorEmail: user.email,
      createdAt: new Date().toISOString(),
    };

    setComplaints((prev) => [newComplaint, ...prev]);
    showToast('Outage incident broadcasted.', 'emerald');
  };

  // Scoreboard counters calculations
  const pendingCount = complaints.filter(
    (c) => c.status === 'pending' || c.status === 'assigned' || c.status === 'in_progress'
  ).length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;
  const totalCount = complaints.length;

  // View routing switcher
  if (!token || !user) {
    return (
      <section id="login-view" className="view-section active">
        <div className="login-wrapper">
          <div className="login-brand">
            <div className="brand-badge">PORTAL V2</div>
            <h1>GIKOMPLAINT</h1>
            <p className="brand-tagline">
              GIKI Campus Outage Timeline &amp; Priority Evaluation Console
            </p>
          </div>

          <div className="glass-card login-card">
            <h2>Connect to Timeline</h2>
            <p className="card-subtitle">Verify and connect instantly using your campus Outlook account.</p>

            <div className="outlook-benefit-list">
              <div className="benefit-item">
                <span className="benefit-icon">▪</span>
                <div className="benefit-text">
                  <strong>Social Outage Timeline</strong>
                  <span>A clean scrolling feed of logged campus incidents.</span>
                </div>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">▪</span>
                <div className="benefit-text">
                  <strong>Priority Scorer Console</strong>
                  <span>Evaluate reach and disruption levels to prioritize dispatcher dispatching.</span>
                </div>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">▪</span>
                <div className="benefit-text">
                  <strong>Outlook Secure SSO</strong>
                  <span>onboarding restricted strictly to active campus profiles.</span>
                </div>
              </div>
            </div>

            {/* Outlook Sign In Button */}
            <a href="/auth/microsoft/login" className="btn btn-outlook" id="btn-login-outlook">
              <svg className="outlook-icon" viewBox="0 0 23 23" style={{ width: '14px', height: '14px' }} xmlns="http://www.w3.org/2000/svg">
                <path d="M11.4 0H0v11.4h11.4V0z" fill="#F25022" />
                <path d="M23 0H11.6v11.4H23V0z" fill="#7FBA00" />
                <path d="M11.4 11.6H0V23h11.4V11.6z" fill="#00A4EF" />
                <path d="M23 11.6H11.6V23H23V11.6z" fill="#FFB900" />
              </svg>
              Sign in with Campus Outlook
            </a>

            <div className="divider">
              <span>LOCAL BYPASS FOR DEMONSTRATION</span>
            </div>

            <button className="btn btn-sandbox" onClick={handleSandboxLogin}>
              Launch Sandbox Session
            </button>
            <p className="sandbox-help">Explore the minimalist timeline interface directly.</p>
          </div>

          <div className="login-footer">
            <span>GIKI Open Source Community &copy; 2026.</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="portal-view" className="view-section active">
      {/* LEFT ICONIC MINIMALIST NAVBAR */}
      <SlimNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={clearSession}
      />

      {/* MAIN TIMELINE CONTENT AREA */}
      <main className="timeline-container">
        {/* TIMELINE CENTRAL COLUMN */}
        <div className="timeline-feed-column">
          {/* Topbar Sticky Header */}
          <header className="timeline-header">
            <h2>Campus Outages</h2>
            <div className="timeline-header-meta">
              <span className="status-indicator-green"></span>
              <span className="status-indicator-text">
                {pendingCount} active &bull; {resolvedCount} resolved &bull; {totalCount} total
              </span>
            </div>
          </header>

          {/* TAB ROUTING */}
          {activeTab === 'feed' && (
            <TimelineFeed
              complaints={complaints}
              onUpdateComplaint={handleUpdateComplaint}
              onCreateComplaint={handleCreateComplaint}
              showToast={showToast}
              user={user}
              isOwnOnly={false}
              searchVal={searchVal}
              setSearchVal={setSearchVal}
            />
          )}

          {activeTab === 'my-complaints' && (
            <TimelineFeed
              complaints={complaints}
              onUpdateComplaint={handleUpdateComplaint}
              onCreateComplaint={handleCreateComplaint}
              showToast={showToast}
              user={user}
              isOwnOnly={true}
              searchVal={searchVal}
              setSearchVal={setSearchVal}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsConsole complaints={complaints} />}
        </div>
      </main>
    </section>
  );
}
