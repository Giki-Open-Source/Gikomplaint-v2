// ==========================================================================
// GIKOMPLAINT V2 - FRONTEND SPA LOGIC ENGINE (SOCIAL TIMELINE & GPI SCORER)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Session State
    let session = {
        token: null,
        user: null
    };

    // Current timeline sorting criteria: 'priority' or 'newest'
    let currentSort = 'priority';

    // In-memory database of outages, with pre-computed GIKI Priority Index (GPI)
    // Formula: gpi = Math.round(reach * disruption * (1 + Math.log10(upvotes)) * 4) [Capped at 100]
    let complaints = [
        {
            id: 1,
            title: "Hostel 12 ground floor washroom water outage",
            category: "plumbing",
            severity: "critical",
            status: "assigned",
            description: "There is absolutely no water pressure in the communal washrooms on the ground floor of Hostel 12 since 8 AM today. It is impossible to use the washrooms or shower. Needs urgent plumber dispatch.",
            upvotes: 89,
            hasUpvoted: true,
            reach: 4,        // 4 = Hostel-wide
            disruption: 5,   // 5 = Total Outage
            gpi: 95,         // Pre-calculated GPI
            authorName: "Zainab Ali",
            authorEmail: "u2022091@giki.edu.pk",
            createdAt: new Date(Date.now() - 3 * 3600000).toISOString()
        },
        {
            id: 2,
            title: "Mess 2 dinner served uncooked and unhygienic",
            category: "mess",
            severity: "high",
            status: "pending",
            description: "The chicken served during tonight's dinner was completely raw on the inside. Several students complained to the mess manager, but no corrective action was taken. This is a severe health hazard.",
            upvotes: 42,
            hasUpvoted: false,
            reach: 3,        // 3 = Wing-wide
            disruption: 4,   // 4 = Severe Blockage
            gpi: 78,         // Pre-calculated GPI
            authorName: "Ahmad Kamal",
            authorEmail: "u2021045@giki.edu.pk",
            createdAt: new Date(Date.now() - 1 * 3600000).toISOString()
        },
        {
            id: 3,
            title: "Campus Wi-Fi extremely slow in library wing",
            category: "it_services",
            severity: "medium",
            status: "resolved",
            description: "The primary Wi-Fi hotspot in the new library wing is dropping connections constantly. Speeds are hovering around 0.5 Mbps, making it impossible to download academic research papers.",
            upvotes: 18,
            hasUpvoted: false,
            reach: 2,        // 2 = Wing-wide
            disruption: 3,   // 3 = Distracting
            gpi: 54,         // Pre-calculated GPI
            authorName: "Usman Khan",
            authorEmail: "u2021110@giki.edu.pk",
            createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
        },
        {
            id: 4,
            title: "Hostel 8 corridor tube lights fused",
            category: "electricity",
            severity: "low",
            status: "closed",
            description: "Three tube lights in the central corridor of Hostel 8 (first floor) are flickering constantly or completely fused. Minor electrical maintenance issue.",
            upvotes: 5,
            hasUpvoted: false,
            reach: 1,        // 1 = Room-wide
            disruption: 2,   // 2 = Minor inconvenience
            gpi: 14,         // Pre-calculated GPI
            authorName: "Sarah Jamil",
            authorEmail: "u2023202@giki.edu.pk",
            createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
        }
    ];

    // Global charts instances
    let categoryChart = null;
    let urgencyChart = null;

    // 2. DOM Elements
    const loginView = document.getElementById('login-view');
    const portalView = document.getElementById('portal-view');
    const btnLoginSandbox = document.getElementById('btn-login-sandbox');
    const btnLogout = document.getElementById('btn-logout');
    const sidebarNav = document.querySelector('.slim-nav-links ul');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Timeline list containers
    const complaintsContainer = document.getElementById('complaints-list-container');
    const myComplaintsContainer = document.getElementById('my-complaints-container');
    
    // Quick Composer components
    const quickComposer = document.getElementById('quick-composer');
    const composerTrigger = document.getElementById('composer-collapsed-trigger');
    const composerDrawer = document.getElementById('composer-expanded-drawer');
    const btnCancelComposer = document.getElementById('btn-cancel-composer');
    const formQuickComposer = document.getElementById('form-quick-composer');

    // Sorting & Filters
    const sortPriorityBtn = document.getElementById('sort-priority-trigger');
    const sortNewestBtn = document.getElementById('sort-newest-trigger');
    const filterCategory = document.getElementById('filter-category');
    const feedSearchInput = document.getElementById('feed-search-input');

    // Right Sidebar Stats widgets
    const statTotal = document.getElementById('stat-total');
    const statPending = document.getElementById('stat-pending');
    const statResolved = document.getElementById('stat-resolved');

    // 3. Initialize Quill Rich Text Editor inside Composer
    let quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Describe exact locations, timelines, and details of the outage...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'bullet' }],
                ['link', 'clean']
            ]
        }
    });

    // 4. Utility Glassmorphic Toast Notification
    const showToast = (message, type = 'cyan') => {
        let borderGlow = '#00F2FE'; // cyan
        if (type === 'emerald') borderGlow = '#00FF87';
        if (type === 'amber') borderGlow = '#F7971E';
        if (type === 'rose') borderGlow = '#FF007F';

        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: "rgba(18, 25, 43, 0.85)",
                border: `1px solid ${borderGlow}`,
                boxShadow: `0 8px 30px rgba(0, 0, 0, 0.5), 0 0 10px ${borderGlow}20`
            }
        }).showToast();
    };

    // 5. Session Controllers & OAuth Integration
    const parseUrlSession = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            const userJson = urlParams.get('user');
            try {
                const user = JSON.parse(decodeURIComponent(userJson));
                storeSession(token, user);
                showToast(`Access Granted! Welcome back, ${user.first_name}!`, 'emerald');
            } catch (e) {
                console.error("Failed to parse callback user info", e);
                showToast("OAuth callback failed.", "rose");
            }
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
        showToast("Session cleared successfully.", "amber");
        activateLogin();
    };

    const activateLogin = () => {
        portalView.style.display = 'none';
        loginView.style.display = 'flex';
    };

    const activatePortal = () => {
        loginView.style.display = 'none';
        portalView.style.display = 'flex';

        // Update profile mini avatars
        document.getElementById('user-avatar-char').textContent = session.user.first_name.charAt(0).toUpperCase();
        document.getElementById('user-mini-avatar').textContent = session.user.first_name.charAt(0).toUpperCase();

        renderFeed();
        renderMySubmissions();
        updateStats();
        
        setTimeout(initCharts, 100);
    };

    // Sandbox Login Trigger
    btnLoginSandbox.addEventListener('click', () => {
        const mockUser = {
            id: 101,
            email: "student_demo@giki.edu.pk",
            first_name: "Demo",
            last_name: "Student",
            role: "student"
        };
        const mockToken = "simulated_jwt_token_for_sandbox";
        storeSession(mockToken, mockUser);
        showToast("Demo Sandbox active. Outlook bypass simulated.", "cyan");
    });

    btnLogout.addEventListener('click', clearSession);

    // 6. Navigation and Tabs
    sidebarNav.addEventListener('click', (e) => {
        const item = e.target.closest('li');
        if (!item) return;

        sidebarNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));
        item.classList.add('active');

        const targetTab = item.dataset.target;
        tabContents.forEach(tab => {
            if (tab.id === targetTab) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        if (targetTab === 'tab-analytics') {
            setTimeout(() => {
                if (categoryChart) categoryChart.windowResizeHandler();
                if (urgencyChart) urgencyChart.windowResizeHandler();
            }, 100);
        }
    });

    // 7. Interactive Quick Composer Drawer
    composerTrigger.addEventListener('click', () => {
        composerTrigger.style.display = 'none';
        composerDrawer.style.display = 'block';
        setTimeout(() => {
            quickComposer.classList.add('expanded');
        }, 10);
    });

    const closeComposer = () => {
        quickComposer.classList.remove('expanded');
        setTimeout(() => {
            composerDrawer.style.display = 'none';
            composerTrigger.style.display = 'flex';
            formQuickComposer.reset();
            quill.setContents([]);
        }, 150);
    };

    btnCancelComposer.addEventListener('click', closeComposer);

    // Submit quick composer
    formQuickComposer.addEventListener('submit', (e) => {
        e.preventDefault();

        const btnSubmit = quickComposer.querySelector('button[type="submit"]');
        const title = document.getElementById('comp-title').value;
        const category = document.getElementById('comp-category').value;
        const severity = document.getElementById('comp-severity').value;
        const description = quill.root.innerHTML;
        const plainText = quill.getText().trim();

        if (plainText === "") {
            showToast("Details of the outage are required.", "rose");
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `📡 Broadcasting...`;

        setTimeout(() => {
            // New Outage pre-set defaults
            const newOutage = {
                id: complaints.length + 1,
                title: title,
                category: category,
                severity: severity,
                status: "pending",
                description: description,
                upvotes: 1,
                hasUpvoted: true,
                reach: 3,         // Default: Wing-wide
                disruption: 3,    // Default: Distracting
                authorName: `${session.user.first_name} ${session.user.last_name}`,
                authorEmail: session.user.email,
                createdAt: new Date().toISOString()
            };

            // Calculate active priority index
            newOutage.gpi = calculateGPI(newOutage.reach, newOutage.disruption, newOutage.upvotes);

            complaints.unshift(newOutage);
            closeComposer();
            
            showToast("Outage incident broadcasted to GIKI timeline!", "emerald");

            renderFeed();
            renderMySubmissions();
            updateStats();
            updateCharts();
        }, 1000);
    });

    // 8. Sorting Controller
    sortPriorityBtn.addEventListener('click', () => {
        sortPriorityBtn.classList.add('active');
        sortNewestBtn.classList.remove('active');
        currentSort = 'priority';
        renderFeed();
    });

    sortNewestBtn.addEventListener('click', () => {
        sortNewestBtn.classList.add('active');
        sortPriorityBtn.classList.remove('active');
        currentSort = 'newest';
        renderFeed();
    });

    // 9. Timeline Social Card Rendering Engine
    const renderFeed = () => {
        const filter = filterCategory.value;
        const searchVal = feedSearchInput.value.toLowerCase().trim();

        let filtered = complaints.filter(c => {
            const matchesCat = (filter === 'all' || c.category === filter);
            const matchesSearch = (searchVal === '' || 
                c.title.toLowerCase().includes(searchVal) || 
                c.description.toLowerCase().includes(searchVal));
            return matchesCat && matchesSearch;
        });

        // Dynamic chronological sorting vs GIKI Priority Index rank sorting
        if (currentSort === 'priority') {
            filtered.sort((a, b) => b.gpi - a.gpi);
        } else {
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        complaintsContainer.innerHTML = '';

        if (filtered.length === 0) {
            complaintsContainer.innerHTML = `
                <div class="glass-card empty-state">
                    <div class="empty-state-icon">📢</div>
                    <h4>No active incidents reported</h4>
                    <p>Timeline is completely clear. Search criteria returned zero matches.</p>
                </div>
            `;
            return;
        }

        filtered.forEach(comp => {
            complaintsContainer.appendChild(createSocialCard(comp, false));
        });
    };

    const renderMySubmissions = () => {
        const myEmail = session.user ? session.user.email : '';
        const myFiltered = complaints.filter(c => c.authorEmail === myEmail);

        myFiltered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        myComplaintsContainer.innerHTML = '';

        if (myFiltered.length === 0) {
            myComplaintsContainer.innerHTML = `
                <div class="glass-card empty-state">
                    <div class="empty-state-icon">👤</div>
                    <h4>No logs submitted</h4>
                    <p>Use the Quick Outage composer at the top of the feed to broadcast an issue.</p>
                </div>
            `;
            return;
        }

        myFiltered.forEach(comp => {
            myComplaintsContainer.appendChild(createSocialCard(comp, true));
        });
    };

    const createSocialCard = (comp, isOwnCard) => {
        const card = document.createElement('div');
        card.className = `glass-card complaint-card`;
        
        const relativeTime = getRelativeTime(new Date(comp.createdAt));
        const authorHandle = `@${comp.authorName.replace(/\s+/g, '')}`;

        // Get matching GPI color glows
        let gpiClass = 'gpi-low';
        if (comp.gpi >= 75) gpiClass = 'gpi-critical';
        else if (comp.gpi >= 50) gpiClass = 'gpi-high';
        else if (comp.gpi >= 25) gpiClass = 'gpi-medium';

        card.innerHTML = `
            <div class="comp-header">
                <div class="comp-user-block">
                    <div class="user-avatar">${comp.authorName.charAt(0).toUpperCase()}</div>
                    <div class="comp-user-meta">
                        <h4>${escapeHtml(comp.authorName)}</h4>
                        <span>${authorHandle} &bull; ${comp.authorEmail}</span>
                    </div>
                </div>
                
                <!-- Dynamic priority index badge -->
                <div class="comp-priority-badge ${gpiClass}" id="gpi-badge-${comp.id}">
                    🔥 GPI <strong>${comp.gpi}</strong>
                </div>
            </div>
            
            <div class="comp-content-wrapper">
                <h3>${escapeHtml(comp.title)}</h3>
                <div class="comp-body-desc">${comp.description}</div>
                
                <div class="comp-meta-tags">
                    <span class="badge badge-cat-${comp.category}">${comp.category.toUpperCase().replace('_', ' ')}</span>
                    <span class="badge badge-severity-${comp.severity}">${comp.severity.toUpperCase()}</span>
                    <span class="badge badge-status-${comp.status}">${comp.status.toUpperCase()}</span>
                </div>
            </div>
            
            <!-- Social actions -->
            <div class="comp-social-actions">
                <button class="action-btn action-btn-upvote ${comp.hasUpvoted ? 'active' : ''}" data-id="${comp.id}">
                    <span>👍</span> <strong class="upvote-count">${comp.upvotes}</strong> Support
                </button>
                <button class="action-btn action-btn-score" id="btn-score-drawer-${comp.id}">
                    <span>🎯</span> Score Outage
                </button>
                <span class="comp-time-ago">${relativeTime}</span>
            </div>

            <!-- Nested Scorer Slider Panel (Innovative Scorer Console) -->
            <div class="scorer-drawer" id="scorer-drawer-${comp.id}" style="display: none;">
                <div class="scorer-card">
                    <div class="scorer-row">
                        <div class="score-control">
                            <div class="score-control-header">
                                <label>Outage Reach Scale</label>
                                <span id="lbl-reach-${comp.id}">${getReachLabel(comp.reach)}</span>
                            </div>
                            <input type="range" min="1" max="5" value="${comp.reach}" class="slider-reach" data-id="${comp.id}">
                        </div>
                        <div class="score-control">
                            <div class="score-control-header">
                                <label>Disruption Severity</label>
                                <span id="lbl-disrupt-${comp.id}">${getDisruptLabel(comp.disruption)}</span>
                            </div>
                            <input type="range" min="1" max="5" value="${comp.disruption}" class="slider-disrupt" data-id="${comp.id}">
                        </div>
                    </div>
                    <div class="scorer-drawer-footer">
                        <span class="scorer-summary-desc">Adjust sliders to dynamically evaluate incident impact quotient.</span>
                        <div class="scorer-index-badge">
                            <span>GPI Index:</span> <strong id="lbl-gpi-${comp.id}">${comp.gpi} / 100</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Upvote event handler
        const upvoteBtn = card.querySelector('.action-btn-upvote');
        upvoteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUpvote(comp.id, upvoteBtn);
        });

        // Scorer Drawer toggle event handler
        const scoreBtn = card.querySelector(`#btn-score-drawer-${comp.id}`);
        const scorerDrawer = card.querySelector(`#scorer-drawer-${comp.id}`);
        scoreBtn.addEventListener('click', () => {
            if (scorerDrawer.style.display === 'none') {
                scorerDrawer.style.display = 'block';
                scoreBtn.classList.add('active');
            } else {
                scorerDrawer.style.display = 'none';
                scoreBtn.classList.remove('active');
            }
        });

        // Sliders change event handlers
        const reachSlider = card.querySelector('.slider-reach');
        const disruptSlider = card.querySelector('.slider-disrupt');

        const handleSliderChange = () => {
            const reach = parseInt(reachSlider.value);
            const disruption = parseInt(disruptSlider.value);
            
            comp.reach = reach;
            comp.disruption = disruption;
            
            // Recalculate GIKI Priority Index (GPI)
            comp.gpi = calculateGPI(reach, disruption, comp.upvotes);

            // Update UI elements dynamically inside post card
            card.querySelector(`#lbl-reach-${comp.id}`).textContent = getReachLabel(reach);
            card.querySelector(`#lbl-disrupt-${comp.id}`).textContent = getDisruptLabel(disruption);
            card.querySelector(`#lbl-gpi-${comp.id}`).textContent = `${comp.gpi} / 100`;

            const gpiBadge = card.querySelector(`#gpi-badge-${comp.id}`);
            gpiBadge.querySelector('strong').textContent = comp.gpi;

            // Shift colors of badge dynamically
            gpiBadge.className = 'comp-priority-badge';
            if (comp.gpi >= 75) gpiBadge.classList.add('gpi-critical');
            else if (comp.gpi >= 50) gpiBadge.classList.add('gpi-high');
            else if (comp.gpi >= 25) gpiBadge.classList.add('gpi-medium');
            else gpiBadge.classList.add('gpi-low');

            updateStats();
            updateCharts();
        };

        reachSlider.addEventListener('input', handleSliderChange);
        disruptSlider.addEventListener('input', handleSliderChange);

        // Keep sorting timeline chronologically or by priority when mouse leaves post or slider completes to prevent cards jump mid-drag!
        reachSlider.addEventListener('change', () => {
            if (currentSort === 'priority') {
                setTimeout(renderFeed, 600); // Debounced timeline sort shifting
            }
        });
        disruptSlider.addEventListener('change', () => {
            if (currentSort === 'priority') {
                setTimeout(renderFeed, 600);
            }
        });

        return card;
    };

    // Upvote Toggle logic
    const toggleUpvote = (id, btn) => {
        const comp = complaints.find(c => c.id === id);
        if (!comp) return;

        if (comp.hasUpvoted) {
            comp.upvotes--;
            comp.hasUpvoted = false;
            btn.classList.remove('active');
            showToast("Retracted outage support.", "amber");
        } else {
            comp.upvotes++;
            comp.hasUpvoted = true;
            btn.classList.add('active');
            showToast("Supported outage broadcast! GPI Priority recalculated.", "emerald");
        }

        btn.querySelector('.upvote-count').textContent = comp.upvotes;
        comp.gpi = calculateGPI(comp.reach, comp.disruption, comp.upvotes);

        updateStats();
        
        renderFeed();
        renderMySubmissions();
        updateCharts();
    };

    // 10. GIKI Priority Index Calculator
    // GPI = Reach * Disruption * (1 + log10(upvotes)) * 4 [Max 100]
    const calculateGPI = (reach, disruption, upvotes) => {
        const multiplier = 1 + Math.log10(upvotes || 1);
        let score = Math.round(reach * disruption * multiplier * 4);
        if (score > 100) score = 100;
        return score;
    };

    // Label mapping converters
    const getReachLabel = (val) => {
        const labels = {
            1: "Single Room",
            2: "Wing Corridor",
            3: "Communal Ward",
            4: "Hostel Block",
            5: "Campus Wide"
        };
        return labels[val] || "Wing-wide";
    };

    const getDisruptLabel = (val) => {
        const labels = {
            1: "Minor Glitch",
            2: "Distracting",
            3: "Disruptive",
            4: "Severe Outage",
            5: "Total Grid Down"
        };
        return labels[val] || "Severe Outage";
    };

    // 11. Right Sidebar Incidents Calculator
    const updateStats = () => {
        statTotal.textContent = complaints.length;
        statPending.textContent = complaints.filter(c => c.status === 'pending' || c.status === 'assigned' || c.status === 'in_progress').length;
        statResolved.textContent = complaints.filter(c => c.status === 'resolved').length;
    };

    // 12. Filters Events
    filterCategory.addEventListener('change', renderFeed);
    feedSearchInput.addEventListener('input', renderFeed);

    // 13. Interactive Insights Charts: ApexCharts Config
    const initCharts = () => {
        if (!portalView.offsetParent) return;

        // Donut Outages chart
        const catData = getCategoryChartData();
        const catOptions = {
            chart: {
                type: 'donut',
                background: 'transparent',
                foreColor: '#94a3b8',
                height: 280,
                toolbar: { show: false }
            },
            stroke: { show: false },
            series: catData.series,
            labels: catData.labels,
            colors: ['#4FACFE', '#F7971E', '#7F00FF', '#00F2FE', '#00FF87', '#FF007F', '#e2e8f0'],
            theme: { mode: 'dark' },
            legend: { position: 'bottom' },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '72%',
                        background: 'transparent',
                        labels: {
                            show: true,
                            name: { show: true, fontSize: '13px', fontFamily: 'Outfit' },
                            value: { show: true, fontSize: '20px', fontFamily: 'Outfit', fontWeight: 'bold', color: '#ffffff' },
                            total: { show: true, label: 'GPI Weight', color: '#64748b' }
                        }
                    }
                }
            }
        };

        categoryChart = new ApexCharts(document.querySelector("#chart-categories"), catOptions);
        categoryChart.render();

        // Urgency column chart
        const urgData = getUrgencyChartData();
        const urgOptions = {
            chart: {
                type: 'bar',
                background: 'transparent',
                foreColor: '#94a3b8',
                height: 280,
                toolbar: { show: false }
            },
            theme: { mode: 'dark' },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '55%',
                    borderRadius: 5
                },
            },
            stroke: { show: false },
            dataLabels: { enabled: false },
            series: [
                { name: 'Active Outages', data: urgData.pending },
                { name: 'Resolved Fixes', data: urgData.resolved }
            ],
            xaxis: {
                categories: ['Critical', 'High', 'Medium', 'Low'],
            },
            colors: ['#F7971E', '#00FF87'],
            legend: { position: 'top' },
            grid: { borderColor: 'rgba(255, 255, 255, 0.03)' }
        };

        urgencyChart = new ApexCharts(document.querySelector("#chart-status-urgency"), urgOptions);
        urgencyChart.render();
    };

    const updateCharts = () => {
        if (!categoryChart || !urgencyChart) return;

        const catData = getCategoryChartData();
        categoryChart.updateSeries(catData.series);

        const urgData = getUrgencyChartData();
        urgencyChart.updateSeries([
            { name: 'Active Outages', data: urgData.pending },
            { name: 'Resolved Fixes', data: urgData.resolved }
        ]);
    };

    const getCategoryChartData = () => {
        let counts = { hostel: 0, mess: 0, academic: 0, it_services: 0, electricity: 0, plumbing: 0, security: 0, other: 0 };
        complaints.forEach(c => {
            if (counts[c.category] !== undefined) counts[c.category]++;
            else counts.other++;
        });
        return {
            series: Object.values(counts),
            labels: Object.keys(counts).map(k => k.toUpperCase().replace('_', ' '))
        };
    };

    const getUrgencyChartData = () => {
        let pending = { critical: 0, high: 0, medium: 0, low: 0 };
        let resolved = { critical: 0, high: 0, medium: 0, low: 0 };

        complaints.forEach(c => {
            const isFinished = (c.status === 'resolved' || c.status === 'closed');
            if (isFinished) {
                if (resolved[c.severity] !== undefined) resolved[c.severity]++;
            } else {
                if (pending[c.severity] !== undefined) pending[c.severity]++;
            }
        });

        return {
            pending: Object.values(pending),
            resolved: Object.values(resolved)
        };
    };

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
