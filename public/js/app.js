// ==========================================================================
// GIKOMPLAINT V2 - FRONTEND SPA LOGIC ENGINE
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial State
    let session = {
        token: null,
        user: null
    };

    // In-memory mock database of complaints (pre-populated for visual beauty)
    let complaints = [
        {
            id: 1,
            title: "Mess 2 dinner uncooked and unhygienic",
            category: "mess",
            severity: "high",
            status: "pending",
            description: "The chicken served during tonight's dinner was completely raw on the inside. Several students complained to the mess manager, but no corrective action was taken. This is a severe health hazard.",
            upvotes: 42,
            hasUpvoted: false,
            authorName: "Ahmad Kamal",
            authorEmail: "u2021045@giki.edu.pk",
            createdAt: new Date(Date.now() - 3 * 3600000).toISOString()
        },
        {
            id: 2,
            title: "Hostel 12 ground floor washroom water outage",
            category: "plumbing",
            severity: "critical",
            status: "assigned",
            description: "There is absolutely no water pressure in the communal washrooms on the ground floor of Hostel 12 since 8 AM today. It is impossible to use the washrooms or shower. Needs urgent plumber dispatch.",
            upvotes: 89,
            hasUpvoted: true,
            authorName: "Zainab Ali",
            authorEmail: "u2022091@giki.edu.pk",
            createdAt: new Date(Date.now() - 12 * 3600000).toISOString()
        },
        {
            id: 3,
            title: "Campus Wi-Fi extremely slow in library wing",
            category: "it_services",
            severity: "medium",
            status: "resolved",
            description: "The primary Wi-Fi hotspot in the new library wing is dropping connections constantly. Speeds are hovering around 0.5 Mbps, making it impossible to download academic research papers. [Update: IT services swapped the router.]",
            upvotes: 18,
            hasUpvoted: false,
            authorName: "Usman Khan",
            authorEmail: "u2021110@giki.edu.pk",
            createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
        },
        {
            id: 4,
            title: "Hostel 8 main corridor lights malfunctioning",
            category: "electricity",
            severity: "low",
            status: "closed",
            description: "Three tube lights in the central corridor of Hostel 8 (first floor) are flickering constantly or completely fused. Minor electrical maintenance issue.",
            upvotes: 5,
            hasUpvoted: false,
            authorName: "Sarah Jamil",
            authorEmail: "u2023202@giki.edu.pk",
            createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
        }
    ];

    // 2. DOM Elements
    const loginView = document.getElementById('login-view');
    const portalView = document.getElementById('portal-view');
    const btnLoginSandbox = document.getElementById('btn-login-sandbox');
    const btnLogout = document.getElementById('btn-logout');
    const sidebarNav = document.querySelector('.sidebar-nav ul');
    const tabContents = document.querySelectorAll('.tab-content');
    const complaintsContainer = document.getElementById('complaints-list-container');
    const myComplaintsContainer = document.getElementById('my-complaints-container');
    const formSubmitComplaint = document.getElementById('form-submit-complaint');
    const filterCategory = document.getElementById('filter-category');
    const feedSearchInput = document.getElementById('feed-search-input');

    // Stats counters
    const statTotal = document.getElementById('stat-total');
    const statPending = document.getElementById('stat-pending');
    const statResolved = document.getElementById('stat-resolved');

    // 3. OAuth Session Parsing
    const parseUrlSession = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            const userJson = urlParams.get('user');
            try {
                const user = JSON.parse(decodeURIComponent(userJson));
                storeSession(token, user);
            } catch (e) {
                console.error("Failed to parse callback user info", e);
            }
            // Clean query string from browser URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    const storeSession = (token, user) => {
        session.token = token;
        session.user = user;
        localStorage.setItem('giko_token', token);
        localStorage.setItem('giko_user', JSON.stringify(user));
        activatePortal();
    };

    const loadLocalSession = () => {
        const token = localStorage.getItem('giko_token');
        const userStr = localStorage.getItem('giko_user');
        if (token && userStr) {
            try {
                session.token = token;
                session.user = JSON.parse(userStr);
                activatePortal();
            } catch (e) {
                clearSession();
            }
        } else {
            activateLogin();
        }
    };

    const clearSession = () => {
        session.token = null;
        session.user = null;
        localStorage.removeItem('giko_token');
        localStorage.removeItem('giko_user');
        activateLogin();
    };

    // 4. View Controllers
    const activateLogin = () => {
        portalView.style.display = 'none';
        loginView.style.display = 'flex';
    };

    const activatePortal = () => {
        loginView.style.display = 'none';
        portalView.style.display = 'flex';

        // Update profile details
        document.getElementById('user-display-name').textContent = `${session.user.first_name} ${session.user.last_name}`;
        document.getElementById('user-display-email').textContent = session.user.email;
        document.getElementById('user-display-role').textContent = session.user.role;
        document.getElementById('user-avatar-char').textContent = session.user.first_name.charAt(0).toUpperCase();

        renderFeed();
        renderMySubmissions();
        updateStats();
    };

    // Sandbox Bypass (Instant Local play)
    btnLoginSandbox.addEventListener('click', () => {
        const mockUser = {
            id: 101,
            email: "student_demo@giki.edu.pk",
            first_name: "Demo",
            last_name: "Student",
            role: "student"
        };
        const mockToken = "simulated_jwt_token_for_development_sandbox_mode";
        storeSession(mockToken, mockUser);
    });

    btnLogout.addEventListener('click', clearSession);

    // 5. Sidebar Navigation Controller
    sidebarNav.addEventListener('click', (e) => {
        const item = e.target.closest('li');
        if (!item) return;

        // Toggle Active navigation item
        sidebarNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));
        item.classList.add('active');

        // Toggle Tab Panels
        const targetTab = item.dataset.target;
        tabContents.forEach(tab => {
            if (tab.id === targetTab) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    });

    // 6. Data Rendering Engine (Templates)
    const renderFeed = () => {
        const filter = filterCategory.value;
        const searchVal = feedSearchInput.value.toLowerCase().trim();

        // Filter and Search logic
        const filtered = complaints.filter(comp => {
            const matchesCat = (filter === 'all' || comp.category === filter);
            const matchesSearch = (searchVal === '' || 
                comp.title.toLowerCase().includes(searchVal) || 
                comp.description.toLowerCase().includes(searchVal));
            return matchesCat && matchesSearch;
        });

        // Clear list
        complaintsContainer.innerHTML = '';

        if (filtered.length === 0) {
            complaintsContainer.innerHTML = `
                <div class="glass-card empty-state">
                    <div class="empty-state-icon">📢</div>
                    <h4>No Complaints Found</h4>
                    <p>There are no complaints fitting your category filter or search keywords.</p>
                </div>
            `;
            return;
        }

        // Sort by upvotes (concurrency weight)
        filtered.sort((a, b) => b.upvotes - a.upvotes);

        filtered.forEach(comp => {
            complaintsContainer.appendChild(createComplaintCard(comp, false));
        });
    };

    const renderMySubmissions = () => {
        const myEmail = session.user ? session.user.email : '';
        const myFiltered = complaints.filter(c => c.authorEmail === myEmail);

        myComplaintsContainer.innerHTML = '';

        if (myFiltered.length === 0) {
            myComplaintsContainer.innerHTML = `
                <div class="glass-card empty-state">
                    <div class="empty-state-icon">👤</div>
                    <h4>No Submissions Yet</h4>
                    <p>Go to the "File a Complaint" tab to report your first campus issue.</p>
                </div>
            `;
            return;
        }

        myFiltered.forEach(comp => {
            myComplaintsContainer.appendChild(createComplaintCard(comp, true));
        });
    };

    const createComplaintCard = (comp, isOwnCard) => {
        const card = document.createElement('div');
        card.className = `glass-card complaint-card border-glow-${comp.severity === 'critical' || comp.severity === 'high' ? 'amber' : 'cyan'}`;
        
        // Relative time formatting
        const relativeTime = getRelativeTime(new Date(comp.createdAt));

        card.innerHTML = `
            <div class="comp-header">
                <div class="comp-title-block">
                    <h3>${escapeHtml(comp.title)}</h3>
                    <div class="comp-meta-row">
                        <span class="badge badge-cat-${comp.category}">${comp.category.toUpperCase().replace('_', ' ')}</span>
                        <span class="badge badge-severity-${comp.severity}">${comp.severity.toUpperCase()}</span>
                        <span class="badge badge-status-${comp.status}">${comp.status.toUpperCase()}</span>
                    </div>
                </div>
                
                <div class="upvote-container">
                    <button class="btn-upvote ${comp.hasUpvoted ? 'active' : ''}" data-id="${comp.id}">
                        <span>👍</span> <strong class="upvote-count">${comp.upvotes}</strong>
                    </button>
                </div>
            </div>
            
            <div class="comp-body">
                <p>${escapeHtml(comp.description)}</p>
            </div>
            
            <div class="comp-footer">
                <div class="comp-author">
                    <div class="author-avatar">${comp.authorName.charAt(0).toUpperCase()}</div>
                    <span>${escapeHtml(comp.authorName)} (${escapeHtml(comp.authorEmail)})</span>
                </div>
                <span>${relativeTime}</span>
            </div>
        `;

        // Upvote event handler with pulse animation
        const upvoteBtn = card.querySelector('.btn-upvote');
        upvoteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUpvote(comp.id, upvoteBtn);
        });

        return card;
    };

    const toggleUpvote = (id, btn) => {
        const comp = complaints.find(c => c.id === id);
        if (!comp) return;

        if (comp.hasUpvoted) {
            comp.upvotes--;
            comp.hasUpvoted = false;
            btn.classList.remove('active');
        } else {
            comp.upvotes++;
            comp.hasUpvoted = true;
            btn.classList.add('active');
        }

        btn.querySelector('.upvote-count').textContent = comp.upvotes;
        updateStats();
        
        // Save and update list renders
        renderFeed();
        renderMySubmissions();
    };

    // 7. Form Submission Logic
    formSubmitComplaint.addEventListener('submit', (e) => {
        e.preventDefault();

        const btnSubmit = document.getElementById('btn-submit-complaint');
        const title = document.getElementById('comp-title').value;
        const category = document.getElementById('comp-category').value;
        const severity = document.getElementById('comp-severity').value;
        const description = document.getElementById('comp-description').value;

        // Submitting visual state
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `⚙️ Registering Complaint...`;

        setTimeout(() => {
            const newComplaint = {
                id: complaints.length + 1,
                title: title,
                category: category,
                severity: severity,
                status: "pending",
                description: description,
                upvotes: 1,
                hasUpvoted: true,
                authorName: `${session.user.first_name} ${session.user.last_name}`,
                authorEmail: session.user.email,
                createdAt: new Date().toISOString()
            };

            // Add to database
            complaints.unshift(newComplaint);

            // Clean Form inputs
            formSubmitComplaint.reset();

            // Re-render dashboard
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `Submit Complaint Request`;

            renderFeed();
            renderMySubmissions();
            updateStats();

            // Redirect back to All Feed tab
            const feedTab = sidebarNav.querySelector('li[data-target="tab-feed"]');
            feedTab.click();
        }, 1200); // Simulated delay for high-concurrency database connection pool write
    });

    // 8. Stats Calculator
    const updateStats = () => {
        statTotal.textContent = complaints.length;
        statPending.textContent = complaints.filter(c => c.status === 'pending' || c.status === 'assigned' || c.status === 'in_progress').length;
        statResolved.textContent = complaints.filter(c => c.status === 'resolved').length;
    };

    // 9. Filters Event Listeners
    filterCategory.addEventListener('change', renderFeed);
    feedSearchInput.addEventListener('input', renderFeed);

    // Helpers
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    };

    const getRelativeTime = (prevDate) => {
        const diffMs = Date.now() - prevDate.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    // Initialize Application
    parseUrlSession();
    loadLocalSession();
});
