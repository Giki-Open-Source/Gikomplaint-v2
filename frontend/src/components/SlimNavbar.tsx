import React from 'react';

interface User {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface SlimNavbarProps {
  activeTab: 'feed' | 'my-complaints' | 'analytics' | 'admin-console';
  setActiveTab: (tab: 'feed' | 'my-complaints' | 'analytics' | 'admin-console') => void;
  user: User;
  onLogout: () => void;
}

export const SlimNavbar: React.FC<SlimNavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
}) => {
  const userInitials = user.first_name ? user.first_name.charAt(0).toUpperCase() : 'G';

  return (
    <aside className="slim-navbar">
      <div className="nav-brand-dot">
        <span className="pulse-indicator"></span>
      </div>

      <nav className="slim-nav-links">
        <ul>
          <li
            className={activeTab === 'feed' ? 'active' : ''}
            onClick={() => setActiveTab('feed')}
            title="Outage Timeline"
          >
            <span className="nav-icon">▤</span>
            <span className="nav-label">Timeline</span>
          </li>
          <li
            className={activeTab === 'my-complaints' ? 'active' : ''}
            onClick={() => setActiveTab('my-complaints')}
            title="My Submissions"
          >
            <span className="nav-icon">◯</span>
            <span className="nav-label">Logs</span>
          </li>
          <li
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
            title="Insights Console"
          >
            <span className="nav-icon">◇</span>
            <span className="nav-label">Insights</span>
          </li>
          {(user.role === 'admin' || user.role === 'staff') && (
            <li
              className={activeTab === 'admin-console' ? 'active' : ''}
              onClick={() => setActiveTab('admin-console')}
              title="Admin Control Panel"
            >
              <span className="nav-icon">▩</span>
              <span className="nav-label">Control</span>
            </li>
          )}
        </ul>
      </nav>

      <div className="nav-profile-trigger">
        <div className="user-avatar" id="user-avatar-char" title={`${user.first_name} ${user.last_name}`}>
          {userInitials}
        </div>
        <button
          className="btn-logout-icon"
          onClick={onLogout}
          title="Sign Out"
          aria-label="Sign Out"
        >
          Logout
        </button>
      </div>
    </aside>
  );
};
