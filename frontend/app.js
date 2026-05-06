// Authentication State
let authToken = localStorage.getItem('authToken');
let currentUserData = null;
let currentActiveTool = null;

// DOM Elements
const authModal = document.getElementById('auth-modal');
const appContainer = document.getElementById('app-container');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSubmitBtn = document.getElementById('auth-submit');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');

window.isLoginMode = true;

// Plan & subscription state
let currentPlanData = { plan: 'free', is_active: false, unlocked_tools: [] };
let confettiRAF = null;
let upgradePopupDismissCount = 0;
let upgradePopupTimer = null;
let currentPurchasePlan = null;

// Helper to update the submit button text (handles both old textContent and new span)
function setAuthBtnText(text) {
    const span = document.getElementById('auth-btn-text');
    if (span) span.textContent = text;
    else authSubmitBtn.textContent = text;
}

// Initialize App
async function initApp() {
    if (authToken) {
        try {
            currentUserData = await api.getProfile(authToken);
            showApp();
        } catch (err) {
            console.error(err);
            localStorage.removeItem('authToken');
            localStorage.removeItem('token');
            authToken = null;
            showAuth();
        }
    } else {
        showAuth();
    }
}

// Auth UI Logic
function showAuth() {
    // Show the landing page (not the auth modal directly)
    authModal.style.display = 'none';
    appContainer.style.display = 'none';
    if (window.showLanding) window.showLanding();
}

function showApp() {
    authModal.style.display = 'none';
    if (window.hideLanding) window.hideLanding();
    updateDashboardUI();
    renderActivity();
    loadPlanData().then(() => loadTools());
    loadNotes();
    loadLeaderboard();
    showWelcomeSplash();
}

function showAppContainer() {
    appContainer.style.display = 'flex';
    appContainer.style.opacity = '0';
    requestAnimationFrame(() => {
        appContainer.style.transition = 'opacity 0.5s ease';
        appContainer.style.opacity = '1';
    });
    updatePlanBadge();
}

function logout() {
    document.getElementById('logout-modal').style.display = 'flex';
}

document.getElementById('btn-just-logout').addEventListener('click', () => {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUserData = null;
    window.location.reload();
});

document.getElementById('btn-delete-data').addEventListener('click', async () => {
    try {
        await api.deleteAccount(authToken);
    } catch (err) {
        console.error("Failed to delete account on server:", err);
    }
    localStorage.removeItem('authToken');
    authToken = null;
    currentUserData = null;
    window.location.reload();
});

document.getElementById('btn-cancel-logout').addEventListener('click', () => {
    document.getElementById('logout-modal').style.display = 'none';
});

authSwitchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.isLoginMode = !window.isLoginMode;
    authTitle.textContent = window.isLoginMode ? 'Welcome Back' : 'Create Account';
    authSubtitle.textContent = window.isLoginMode ? 'Log in to continue to your AI Study Hub' : 'Join the next-gen learning platform';
    setAuthBtnText(window.isLoginMode ? 'Log In' : 'Sign Up');
    authSwitchText.textContent = window.isLoginMode ? "Don't have an account?" : "Already have an account?";
    authSwitchBtn.textContent = window.isLoginMode ? 'Sign Up' : 'Log In';
    authError.textContent = '';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    authError.textContent = '';
    authSubmitBtn.disabled = true;
    setAuthBtnText('Processing...');

    try {
        let res;
        if (window.isLoginMode) {
            res = await api.login(username, password);
        } else {
            res = await api.register(username, password);
        }
        authToken = res.token;
        localStorage.setItem('authToken', authToken);
        currentUserData = await api.getProfile(authToken);
        showApp();
    } catch (err) {
        authError.textContent = err.message;
    } finally {
        authSubmitBtn.disabled = false;
        setAuthBtnText(window.isLoginMode ? 'Log In' : 'Sign Up');
    }
});

logoutBtn.addEventListener('click', logout);

// --- App UI Logic ---
function getAvatarUrl(seed) {
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}

function getDefaultAvatarForUser(user) {
    const seed = (user && user.username) ? user.username : 'default';
    return getAvatarUrl(seed);
}

function isBlank(v) {
    return v == null || String(v).trim().length === 0;
}

function resolveAvatarUrl(profilePicture, user) {
    // Keep ONLY user-uploaded images (data URLs). Everything else falls back to robot.
    // This prevents random/legacy photo URLs from showing as the default avatar.
    if (!isBlank(profilePicture)) {
        const s = String(profilePicture).trim();
        if (s.startsWith('data:image/')) return s;
    }
    return getDefaultAvatarForUser(user);
}

let activeTypewriter = { cancel: () => {} };

async function typewriterInto(el, text, { cps = 140, maxMs = 4500 } = {}) {
    if (!el) return;
    const s = String(text ?? '');

    // Cancel any in-flight animation for this output area
    try { activeTypewriter.cancel(); } catch {}

    let cancelled = false;
    activeTypewriter = { cancel: () => { cancelled = true; } };

    el.textContent = '';

    // Fast path for short text
    if (s.length <= 60) {
        el.textContent = s;
        return;
    }

    const chunk = Math.max(8, Math.floor(cps / 10));
    const startedAt = Date.now();
    for (let i = 0; i < s.length; i += chunk) {
        if (cancelled) return;
        // If the response is long, don't keep "typing" forever—finish quickly.
        if (Date.now() - startedAt > maxMs) {
            el.textContent += s.slice(i);
            break;
        }
        el.textContent += s.slice(i, i + chunk);
        // yield to browser
        await new Promise(r => setTimeout(r, 25));
    }
}

function renderOutputWithMath(el, text) {
    if (!el) return;
    if (typeof marked !== 'undefined') {
        el.innerHTML = marked.parse(String(text || ''));
    } else {
        el.textContent = String(text || '');
    }

    // Render LaTeX math ($...$, $$...$$) after markdown.
    if (typeof renderMathInElement !== 'undefined') {
        try {
            renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false
            });
        } catch {
            // If KaTeX isn't ready yet, keep the raw output.
        }
    }
}

async function renderWithTyping(el, text, { renderMath = false } = {}) {
    await typewriterInto(el, text);
    // After typing, render markdown and optional math for crisp display.
    if (renderMath) {
        renderOutputWithMath(el, text);
    } else if (typeof marked !== 'undefined') {
        el.innerHTML = marked.parse(String(text || ''));
    } else {
        el.textContent = String(text || '');
    }
}

function enableAutoGrow(textarea) {
    if (!textarea) return;
    const grow = () => {
        textarea.style.height = 'auto';
        const max = 360; // keep page usable; output remains visible
        textarea.style.height = `${Math.min(max, textarea.scrollHeight)}px`;
    };
    textarea.addEventListener('input', grow);
    textarea.addEventListener('paste', () => setTimeout(grow, 0));
    grow();
}

function getMathSolverTextarea() {
    return document.getElementById('input-problem') || document.getElementById('tool-input');
}

// Apply XP result from api.addXp() and refresh UI — single source of truth
function applyXpResult(res) {
    if (!res) return;
    currentUserData.xp = res.xp ?? currentUserData.xp;
    currentUserData.level = res.newLevel ?? res.level ?? currentUserData.level;
    if (res.time_spent !== undefined) currentUserData.time_spent = res.time_spent;
    if (res.streak !== undefined) currentUserData.streak = res.streak;
    updateDashboardUI();
}

// Lazily creates a fullscreen image-view modal used by image/diagram tools.
// Defined as top-level function so it's hoisted and available to all call sites.
function getOrCreateImageViewModal() {
    let modal = document.getElementById('image-view-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'image-view-modal';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '9999';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.background = 'rgba(0,0,0,0.65)';
    modal.style.backdropFilter = 'blur(6px)';
    modal.innerHTML = `
        <div id="image-view-modal-card" style="position: relative; width: min(1100px, 92vw); max-height: 88vh; padding: 14px; border-radius: 14px; background: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.25); overflow: auto;">
            <button id="image-view-close" class="icon-btn" style="position:absolute; top:10px; right:10px; font-size:18px; background: rgba(0,0,0,0.06); border-radius: 10px; padding: 8px 10px;">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div style="padding-top: 30px; display:flex; justify-content:center;">
                <img id="image-view-modal-img" alt="Generated image" style="max-width: 100%; height: auto; object-fit: contain; border-radius: 10px; image-rendering: auto;">
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const close = () => { modal.style.display = 'none'; };
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#image-view-close')?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    return modal;
}

// Motivational quotes that rotate on each greeting
const HERO_QUOTES = [
    "Small steps every day lead to big results.",
    "Your future self will thank you for the work you do today.",
    "Knowledge compounds — every minute studied counts.",
    "Done is better than perfect. Just start.",
    "The expert in anything was once a beginner.",
    "Focus on progress, not perfection.",
    "One AI tool at a time, you're getting smarter.",
    "Success is the sum of small efforts repeated daily."
];

// Animate a number from current to target value
function animateCount(el, target, duration = 900, suffix = '') {
    if (!el) return;
    const start = parseFloat((el.textContent || '0').replace(/[^0-9.-]/g, '')) || 0;
    const diff = target - start;
    if (diff === 0) { el.textContent = target.toLocaleString() + suffix; return; }
    const startTime = performance.now();
    const step = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = Math.round(start + diff * eased);
        el.textContent = value.toLocaleString() + suffix;
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// Set time-based greeting and rotating quote
function setHeroGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Welcome back';
    if (hour < 5) greeting = 'Burning the midnight oil';
    else if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else if (hour < 21) greeting = 'Good evening';
    else greeting = 'Good night';
    const greetingEl = document.getElementById('hero-time-greeting');
    if (greetingEl) greetingEl.textContent = greeting;

    const quoteEl = document.getElementById('hero-quote');
    if (quoteEl) {
        const idx = Math.floor(Math.random() * HERO_QUOTES.length);
        quoteEl.textContent = HERO_QUOTES[idx];
    }
}

function updateDashboardUI() {
    setHeroGreeting();

    const username = currentUserData.username || 'there';
    const heroName = document.getElementById('hero-username');
    if (heroName) heroName.textContent = username;

    const xp = currentUserData.xp || 0;
    const level = currentUserData.level || 1;
    const time = currentUserData.time_spent || 0;
    const streak = currentUserData.streak || 0;

    animateCount(document.getElementById('dash-xp'), xp);
    animateCount(document.getElementById('dash-time'), time, 900, 'm');
    const streakEl = document.getElementById('dash-streak');
    if (streakEl) animateCount(streakEl, streak);
    const levelEl = document.getElementById('dash-level');
    if (levelEl) animateCount(levelEl, level);

    document.getElementById('mini-username').textContent = username;
    document.getElementById('mini-level').textContent = level;

    const avatarUrl = resolveAvatarUrl(currentUserData.profile_picture, currentUserData);
    document.getElementById('mini-avatar').src = avatarUrl;

    // Also update settings prepopulation
    document.getElementById('settings-avatar-preview').src = avatarUrl;
    document.getElementById('settings-avatar-url').value = currentUserData.profile_picture || '';
    document.getElementById('settings-username').value = currentUserData.username;
    document.getElementById('settings-bio').value = currentUserData.bio || '';

    // XP Progress Bar
    const xpPerLevel = 100;
    const xpIntoLevel = xp % xpPerLevel;
    const pct = Math.min(100, (xpIntoLevel / xpPerLevel) * 100);
    const fillEl = document.getElementById('xp-fill');
    const glowEl = document.getElementById('xp-glow');
    const labelEl = document.getElementById('xp-level-label');
    const textEl = document.getElementById('xp-prog-text');
    if (fillEl) setTimeout(() => { fillEl.style.width = pct + '%'; }, 100);
    if (glowEl) setTimeout(() => { glowEl.style.width = pct + '%'; }, 100);
    if (labelEl) labelEl.textContent = level;
    if (textEl) textEl.textContent = `${xpIntoLevel} / ${xpPerLevel} XP`;

    // Hero ring (circumference 2 * PI * 52 ≈ 326.7)
    const ringFill = document.getElementById('ring-fill');
    if (ringFill) {
        const circumference = 326.7;
        const offset = circumference - (pct / 100) * circumference;
        setTimeout(() => { ringFill.style.strokeDashoffset = offset; }, 200);
    }
    const heroRingLevel = document.getElementById('hero-ring-level');
    const heroRingXp = document.getElementById('hero-ring-xp');
    if (heroRingLevel) heroRingLevel.textContent = level;
    if (heroRingXp) heroRingXp.textContent = Math.round(pct);
}

// ---- Recent activity feed ----
function loadActivity() {
    try {
        const raw = localStorage.getItem('recent_activity');
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}
function saveActivity(list) {
    try { localStorage.setItem('recent_activity', JSON.stringify(list.slice(0, 8))); } catch (e) {}
}
function recordActivity(toolName, icon, xpGained) {
    const list = loadActivity();
    list.unshift({
        name: toolName,
        icon: icon || 'fa-solid fa-wand-magic-sparkles',
        xp: xpGained || 0,
        time: Date.now()
    });
    saveActivity(list);
    renderActivity();
}
function timeAgo(ts) {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    return Math.floor(sec / 86400) + 'd ago';
}
function renderActivity() {
    const ul = document.getElementById('activity-list');
    if (!ul) return;
    const list = loadActivity();
    if (!list.length) {
        ul.innerHTML = `
            <li class="activity-empty">
                <i class="fa-solid fa-seedling"></i>
                <p>Your activity will appear here</p>
                <span>Try a tool to get started</span>
            </li>`;
        return;
    }
    ul.innerHTML = list.map(item => `
        <li class="activity-item">
            <div class="activity-item-icon"><i class="${item.icon}"></i></div>
            <div class="activity-item-text">
                <h5>${item.name}</h5>
                <span>${timeAgo(item.time)}</span>
            </div>
            ${item.xp ? `<div class="activity-item-xp">+${item.xp} XP</div>` : ''}
        </li>
    `).join('');
}

// Wire up quick-launch and hero CTAs (delegated since they're inside the dashboard)
document.addEventListener('click', (e) => {
    const targetEl = e.target.closest('[data-jump-target]');
    if (targetEl) {
        const target = targetEl.getAttribute('data-jump-target');
        const navItem = document.querySelector(`.nav-item[data-target="${target}"]`);
        if (navItem) navItem.click();
        return;
    }
    const toolEl = e.target.closest('[data-jump-tool]');
    if (toolEl) {
        const toolId = toolEl.getAttribute('data-jump-tool');
        const tool = (typeof toolsData !== 'undefined') && toolsData.find(t => t.id === toolId);
        if (tool) openTool(tool);
    }
});

// Navigation
const navItems = document.querySelectorAll('.nav-item[data-target]');
const sections = document.querySelectorAll('.section-container');

// Gate locked sections at the click capture phase, before any other handler runs
document.addEventListener('click', (e) => {
    const gateEl = e.target.closest('[data-section-gate]');
    if (!gateEl) return;
    const gate = gateEl.getAttribute('data-section-gate');
    if (!isSectionUnlocked(gate)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openPlansModal();
    }
}, true);

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        const target = item.getAttribute('data-target');
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        
        if (target === 'leaderboard') {
            loadLeaderboard();
        }
    });
});

const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebar = document.querySelector('.sidebar');

if (hamburgerBtn && sidebarOverlay && sidebar) {
    hamburgerBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });

    // Close sidebar on mobile when a nav item is clicked
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    });
}

// Topbar user mini dropdown toggle
(function() {
    const wrap = document.getElementById('profile-btn-wrap');
    const btn  = document.getElementById('profile-btn');
    const drop = document.getElementById('mini-dropdown');

    function openProfileSection() {
        navItems.forEach(n => n.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById('profile').classList.add('active');
    }

    function closeDrop() {
        wrap.classList.remove('open');
        drop.classList.remove('open');
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = drop.classList.contains('open');
        if (isOpen) { closeDrop(); } else { wrap.classList.add('open'); drop.classList.add('open'); }
    });

    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) closeDrop();
    });

    document.getElementById('drop-profile').addEventListener('click', () => {
        closeDrop();
        openProfileSection();
    });

    document.getElementById('drop-upgrade').addEventListener('click', () => {
        closeDrop();
        openPlansModal();
    });

    document.getElementById('drop-logout').addEventListener('click', () => {
        closeDrop();
        logout();
    });
})();

document.getElementById('profile-nav-btn').addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    document.getElementById('profile').classList.add('active');
});

// Quick Tools sidebar shortcuts
document.querySelectorAll('.quick-tool-item').forEach(item => {
    item.addEventListener('click', () => {
        let toolId = item.getAttribute('data-tool');
        if (toolId === 'grammar-checker') toolId = 'grammar-tutor';
        if (toolId === 'code-debugger') toolId = 'bug-fixer';
        const tool = toolsData.find(t => t.id === toolId);
        if (tool) openTool(tool);
    });
});

document.getElementById('settings-avatar-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('settings-avatar-preview').src = event.target.result;
            document.getElementById('settings-avatar-url').value = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('save-profile-btn').addEventListener('click', async (e) => {
    const btn = document.getElementById('save-profile-btn');
    const msg = document.getElementById('profile-status-msg');
    const newUsername = document.getElementById('settings-username').value;
    const newAvatar = document.getElementById('settings-avatar-url').value;
    const newBio = document.getElementById('settings-bio').value;
    
    msg.textContent = '';
    btn.disabled = true;
    
    try {
        await api.updateProfile(authToken, newUsername, newAvatar, newBio);
        currentUserData.username = newUsername;
        currentUserData.profile_picture = newAvatar;
        currentUserData.bio = newBio;
        updateDashboardUI();
        loadLeaderboard(); // Update leaderboard with new avatar
        msg.style.color = 'var(--success-color)';
        msg.textContent = 'Profile updated successfully!';
    } catch (err) {
        msg.style.color = 'var(--danger-color)';
        msg.textContent = 'Error: Username might be taken.';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-save"></i> Save Changes';
        setTimeout(() => msg.textContent = '', 3000);
    }
});

// Load Tools UI
function loadTools() {
    const container = document.getElementById('tools-container');
    const recommended = document.getElementById('recommended-tools');
    container.innerHTML = '';
    recommended.innerHTML = '';

    const categories = [...new Set(toolsData.map(t => t.category))];

    categories.forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.className = 'tools-category';
        catDiv.innerHTML = `<h3>${cat}</h3><div class="tools-grid"></div>`;
        container.appendChild(catDiv);

        const grid = catDiv.querySelector('.tools-grid');
        const catTools = toolsData.filter(t => t.category === cat);

        catTools.forEach(tool => {
            const card = createToolCard(tool);
            grid.appendChild(card);
            
            // Add some to recommended
            if (['essay-writer', 'math-solver', 'todo-ai'].includes(tool.id)) {
                recommended.appendChild(createToolCard(tool));
            }
        });
    });
}

function createToolCard(tool) {
    const locked = tool.premium && !isToolUnlocked(tool.id);
    const card = document.createElement('div');
    card.className = 'tool-card glass' + (locked ? ' tool-card-locked' : '');
    if (locked) {
        card.innerHTML = `
            <div class="tool-lock-badge"><i class="fa-solid fa-lock"></i> Locked</div>
            <div class="tool-icon"><i class="${tool.icon}"></i></div>
            <h4>${tool.name}</h4>
            <p>${tool.desc}</p>
        `;
        card.addEventListener('click', openPlansModal);
    } else {
        card.innerHTML = `
            <div class="tool-icon"><i class="${tool.icon}"></i></div>
            <h4>${tool.name}</h4>
            <p>${tool.desc}</p>
        `;
        card.addEventListener('click', () => openTool(tool));
    }
    return card;
}

function openTool(tool) {
    if (tool.premium && !isToolUnlocked(tool.id)) { openPlansModal(); return; }
    currentActiveTool = tool;
    sections.forEach(s => s.classList.remove('active'));
    document.getElementById('active-tool').classList.add('active');
    
    document.getElementById('active-tool-icon').className = tool.icon;
    document.getElementById('active-tool-name').textContent = tool.name;
    
    const inputArea = document.querySelector('.tool-input-area');
    // Clear old inputs except the button
    const btn = document.getElementById('run-tool-btn');
    inputArea.innerHTML = '';
    
    if (tool.inputs) {
        tool.inputs.forEach(inp => {
            const group = document.createElement('div');
            group.className = 'form-group';
            group.style.marginBottom = '12px';
            
            const label = document.createElement('label');
            label.textContent = inp.label;
            label.style.display = 'block';
            label.style.marginBottom = '8px';
            label.style.color = 'var(--text-secondary)';
            group.appendChild(label);
            
            if (inp.type === 'select') {
                const select = document.createElement('select');
                select.id = `input-${inp.id}`;
                select.style.width = '100%';
                select.style.padding = '12px';
                select.style.borderRadius = '12px';
                select.style.border = '1px solid var(--border-color)';
                select.style.background = 'var(--bg-color)';
                select.style.color = 'var(--text-primary)';
                inp.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    select.appendChild(option);
                });
                group.appendChild(select);
            } else if (inp.type === 'textarea') {
                const textarea = document.createElement('textarea');
                textarea.id = `input-${inp.id}`;
                textarea.style.width = '100%';
                textarea.style.padding = '12px';
                textarea.style.borderRadius = '12px';
                textarea.style.border = '1px solid var(--border-color)';
                textarea.style.background = 'var(--bg-color)';
                textarea.style.color = 'var(--text-primary)';
                textarea.style.minHeight = '100px';
                textarea.style.resize = 'vertical';
                if (tool.id === 'math-solver') {
                    textarea.style.minHeight = '160px';
                    textarea.style.fontSize = '16px';
                    textarea.style.lineHeight = '1.5';
                }
                enableAutoGrow(textarea);
                group.appendChild(textarea);
            } else {
                const input = document.createElement('input');
                input.type = inp.type;
                input.id = `input-${inp.id}`;
                input.style.width = '100%';
                input.style.padding = '12px';
                input.style.borderRadius = '12px';
                input.style.border = '1px solid var(--border-color)';
                input.style.background = 'var(--bg-color)';
                input.style.color = 'var(--text-primary)';
                group.appendChild(input);
            }
            inputArea.appendChild(group);
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.id = 'tool-input';
        textarea.placeholder = tool.prompt;
        textarea.style.width = '100%';
        textarea.style.padding = '12px';
        textarea.style.borderRadius = '12px';
        textarea.style.border = '1px solid var(--border-color)';
        textarea.style.background = 'var(--bg-color)';
        textarea.style.color = 'var(--text-primary)';
        textarea.style.minHeight = '100px';
        textarea.style.resize = 'vertical';
        enableAutoGrow(textarea);
        inputArea.appendChild(textarea);
    }
    
    inputArea.appendChild(btn);
    document.getElementById('tool-output').textContent = 'Output will appear here...';
}

document.getElementById('back-to-tools').addEventListener('click', () => {
    sections.forEach(s => s.classList.remove('active'));
    document.getElementById('tools').classList.add('active');
    navItems.forEach(n => n.classList.remove('active'));
    document.querySelector('.nav-item[data-target="tools"]').classList.add('active');
});

// Run AI Tool
document.getElementById('run-tool-btn').addEventListener('click', async () => {
    if (!currentActiveTool || !authToken) return;
    
    let fullPrompt = '';
    
    if (currentActiveTool.inputs) {
        const vals = {};
        for (const inp of currentActiveTool.inputs) {
            const el = document.getElementById(`input-${inp.id}`);
            if (inp.type === 'file') {
                if (el.files && el.files[0]) {
                    document.getElementById('tool-output').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reading file...';
                    vals[inp.id] = await extractTextFromFile(el.files[0]);
                } else {
                    vals[inp.id] = '';
                }
            } else {
                vals[inp.id] = el.value;
            }
        }
        fullPrompt = currentActiveTool.promptTemplate(vals);
    } else {
        const input = document.getElementById('tool-input').value;
        if (!input) return;
        fullPrompt = `${currentActiveTool.prompt} ${input}`;
    }

    const outputArea = document.getElementById('tool-output');
    outputArea.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
    
    try {
        let response;
        if (currentActiveTool.id === 'ai-tutor') {
            if (!window.aiTutorMemory) {
                window.aiTutorMemory = [{ role: 'system', content: 'You are an expert AI Tutor. Be extremely helpful and encouraging. Remember the context of our conversation.' }];
            }
            window.aiTutorMemory.push({ role: 'user', content: fullPrompt });
            response = await api.generateAIChat(authToken, window.aiTutorMemory);
            window.aiTutorMemory.push({ role: 'assistant', content: response.result });
            
            // Render as markdown to handle code/math better
            await renderWithTyping(outputArea, response.result, { renderMath: true });
        } else {
            // Math solver: use Gemini 2.5 Pro for accurate step-by-step reasoning
            if (currentActiveTool.id === 'math-solver') {
                const sys = currentActiveTool.systemMessage || 'You are a helpful math teacher.';
                const mathModel = 'gemini-2.5-pro';
                const memory = [
                    { role: 'system', content: sys },
                    { role: 'user', content: fullPrompt }
                ];

                response = await api.generateAIChat(authToken, memory, sys, mathModel);
                memory.push({ role: 'assistant', content: response.result });

                let combined = String(response.result || '');
                let safety = 0;
                while (!combined.includes('\nEND') && !combined.trim().endsWith('END') && safety < 3) {
                    safety += 1;
                    memory.push({
                        role: 'user',
                        content: 'Continue exactly where you left off. Do NOT repeat. Finish with FINAL ANSWER and END.'
                    });
                    const cont = await api.generateAIChat(authToken, memory, sys, mathModel);
                    memory.push({ role: 'assistant', content: cont.result });
                    combined += '\n' + String(cont.result || '');
                }

                await renderWithTyping(outputArea, combined, { renderMath: true });
            } else {
                response = await api.generateAI(
                    authToken,
                    fullPrompt,
                    currentActiveTool.systemMessage || `You are an expert in ${currentActiveTool.category}. Provide concise, accurate output.`
                );
                await renderWithTyping(outputArea, response.result, { renderMath: false });
            }
        }
        
        // Keep newest content visible for long solutions.
        outputArea.scrollTop = 0;
        
        const xpRes = await api.addXp(authToken, 10, 1, currentActiveTool.name);
        applyXpResult(xpRes);
        recordActivity(currentActiveTool.name, currentActiveTool.icon, 10);
    } catch (err) {
        outputArea.textContent = 'Error connecting to AI service.';
    }
});

async function extractTextFromFile(file) {
    if (!file) return '';
    
    // Plain Text / Subtitles
    if (file.type === 'text/plain' || file.name.match(/\.(txt|vtt|srt|csv)$/i)) {
        return await file.text();
    }
    
    // PDF
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        if (!window.pdfjsLib) return 'Error: PDF.js not loaded';
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(s => s.str).join(' ') + '\n';
        }
        return fullText;
    }
    
    // Image OCR
    if (file.type.startsWith('image/')) {
        if (!window.Tesseract) return 'Error: Tesseract not loaded';
        document.getElementById('tool-output').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Extracting text from image...';
        const result = await window.Tesseract.recognize(file, 'eng');
        return result.data.text;
    }
    
    return 'Unsupported file type.';
}

// Notes Logic
async function loadNotes() {
    try {
        const notes = await api.getNotes(authToken);
        const list = document.getElementById('notes-list');
        list.innerHTML = '';
        
        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'note-item';
            div.innerHTML = `<h4>${note.title}</h4><p>${new Date(note.created_at).toLocaleDateString()}</p>`;
            div.addEventListener('click', () => {
                document.getElementById('note-title').value = note.title;
                document.getElementById('note-content').value = note.content;
                document.querySelectorAll('.note-item').forEach(n => n.classList.remove('active'));
                div.classList.add('active');
            });
            list.appendChild(div);
        });
    } catch (err) {
        console.error(err);
    }
}

document.getElementById('save-note-btn').addEventListener('click', async () => {
    const title = document.getElementById('note-title').value;
    const content = document.getElementById('note-content').value;
    
    if (!title || !content) {
        alert("Please provide both title and content.");
        return;
    }
    
    try {
        await api.saveNote(authToken, title, content);
        const noteXp = await api.addXp(authToken, 5, 2, 'Note Taker');
        applyXpResult(noteXp);
        recordActivity('Saved Note: ' + title.slice(0, 30), 'fa-solid fa-book', 5);
        document.getElementById('note-title').value = '';
        document.getElementById('note-content').value = '';
        loadNotes();
    } catch (err) {
        alert("Failed to save note");
    }
});

document.getElementById('summarize-note-btn').addEventListener('click', async () => {
    const content = document.getElementById('note-content').value;
    if (!content) return;
    
    document.getElementById('note-content').value = "Summarizing... Please wait.";
    try {
        const response = await api.generateAI(authToken, `Summarize this text in bullet points: ${content}`, "You are a summarizing assistant.");
        document.getElementById('note-content').value = response.result;
    } catch (err) {
        document.getElementById('note-content').value = "Failed to summarize.";
    }
});

// Leaderboard Logic
async function loadLeaderboard() {
    try {
        const data = await api.getLeaderboard(authToken);
        const leaders = data.leaders || data; // backward compat
        const currentUserRank = data.currentUserRank || null;
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';

        function buildRow(user, index, rankLabel) {
            const div = document.createElement('div');
            const isMe = currentUserData && user.id === currentUserData.id;
            div.className = `leaderboard-item ${index < 3 ? 'top-3' : ''} ${isMe ? 'leaderboard-me' : ''}`;
            const avatarUrl = resolveAvatarUrl(user.profile_picture, user);
            const medal = rankLabel !== undefined ? rankLabel : (['🥇','🥈','🥉'][index] || `#${index+1}`);
            div.innerHTML = `
                <div class="lb-user">
                    <div class="rank">${medal}</div>
                    <img src="${avatarUrl}" alt="${user.username}" style="background:#1a1a2e; width: 40px; height: 40px; border-radius: 50%;">
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">${user.username}${isMe ? ' <span style="color:#a855f7">✨ You</span>' : ''}</div>
                        ${user.bio ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${user.bio}</div>` : ''}
                    </div>
                </div>
                <div class="lb-stats">
                    <span class="lb-level">Lvl ${user.level}</span>
                    <span class="lb-xp">${(user.xp || 0).toLocaleString()} XP</span>
                </div>
            `;
            return div;
        }

        leaders.forEach((user, index) => list.appendChild(buildRow(user, index)));

        // If current user is not in the top list, show them separately
        if (currentUserRank) {
            const sep = document.createElement('div');
            sep.style.cssText = 'text-align:center; padding: 8px 0; color: var(--text-secondary); font-size:13px; border-top: 1px solid var(--border-color); margin-top: 8px;';
            sep.textContent = '— Your Position —';
            list.appendChild(sep);
            list.appendChild(buildRow(currentUserRank, -1, `#${currentUserRank.rank}`));
        }
    } catch (err) {
        console.error(err);
    }
}

// Theme Toggle
document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
});

// Focus Timer Logic
let timerInterval;
let timeLeft = 25 * 60; // 25 minutes
let isTimerRunning = false;

const timerDisplay = document.getElementById('timer-display');
const startTimerBtn = document.getElementById('start-timer');
const resetTimerBtn = document.getElementById('reset-timer');

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

startTimerBtn.addEventListener('click', () => {
    if (isTimerRunning) {
        clearInterval(timerInterval);
        startTimerBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Focus';
        isTimerRunning = false;
    } else {
        isTimerRunning = true;
        startTimerBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        timerInterval = setInterval(async () => {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                startTimerBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Focus';
                alert('Focus session complete! Take a break.');
                if (authToken) {
                    const xpRes = await api.addXp(authToken, 50, 25, 'Focus Timer');
                    applyXpResult(xpRes);
                    recordActivity('Completed Focus Session', 'fa-solid fa-stopwatch', 50);
                }
                timeLeft = 25 * 60;
                updateTimerDisplay();
            }
        }, 1000);
    }
});

document.getElementById('reset-timer').addEventListener('click', () => {
    clearInterval(timerInterval);
    isTimerRunning = false;
    startTimerBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Focus';
    timeLeft = 25 * 60;
    updateTimerDisplay();
});

// Run Init
initApp();

// --- Worksheet Logic ---
let currentWorksheetQuestions = [];

document.getElementById('generate-ws-btn').addEventListener('click', async () => {
    const cls = document.getElementById('ws-class').value;
    const topic = document.getElementById('ws-topic').value;
    const type = document.getElementById('ws-type').value;
    const count = document.getElementById('ws-count').value || 5;
    const status = document.getElementById('ws-gen-status');
    
    if (!cls || !topic) return alert('Please enter Class and Topic.');
    
    status.style.display = 'block';
    status.textContent = 'Generating worksheet...';
    document.getElementById('worksheet-interactive-area').style.display = 'none';
    document.getElementById('ws-grading-area').style.display = 'none';
    
    const prompt = `Generate a ${count}-question worksheet for ${cls} students about "${topic}". The question type must be ${type}.
    You MUST return ONLY a valid JSON array of objects. Do not include markdown code blocks or any other text.
    Format:
    [
      { "id": 1, "question": "Question text", "options": ["A", "B", "C", "D"] }, // Include options ONLY if Multiple Choice
      { "id": 2, "question": "Another question text", "options": [] }
    ]`;
    
    try {
        const response = await api.generateAI(authToken, prompt, "You are a teacher formatting output strictly as JSON.");
        let jsonStr = response.result.replace(/```json/g, '').replace(/```/g, '').trim();
        const questions = JSON.parse(jsonStr);
        currentWorksheetQuestions = questions;
        
        document.getElementById('ws-title').textContent = `${topic} (${type})`;
        const container = document.getElementById('ws-questions-container');
        container.innerHTML = '';
        
        questions.forEach((q, idx) => {
            const div = document.createElement('div');
            div.className = 'glass';
            div.style.padding = '20px';
            
            let html = `<strong>${idx + 1}. ${q.question}</strong><br><br>`;
            
            if (type === 'Multiple Choice' && q.options && q.options.length > 0) {
                q.options.forEach(opt => {
                    html += `<label style="display:block; margin-bottom:8px;">
                        <input type="radio" name="q_${q.id}" value="${opt.replace(/"/g, '&quot;')}"> ${opt}
                    </label>`;
                });
            } else {
                html += `<input type="text" id="q_${q.id}" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-color); color:var(--text-primary);" placeholder="Your answer...">`;
            }
            
            div.innerHTML = html;
            container.appendChild(div);
        });
        
        document.getElementById('worksheet-interactive-area').style.display = 'block';
        status.style.display = 'none';
    } catch (err) {
        console.error(err);
        status.textContent = 'Error generating worksheet. Please try again.';
    }
});

document.getElementById('submit-ws-btn').addEventListener('click', async () => {
    const btn = document.getElementById('submit-ws-btn');
    btn.disabled = true;
    btn.textContent = 'Grading...';
    
    // Collect answers
    let studentAnswers = [];
    currentWorksheetQuestions.forEach(q => {
        let answer = '';
        const radio = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (radio) {
            answer = radio.value;
        } else {
            const txt = document.getElementById(`q_${q.id}`);
            if (txt) answer = txt.value;
        }
        studentAnswers.push({ question: q.question, student_answer: answer });
    });
    
    const prompt = `Grade the following student worksheet answers.
    You MUST return ONLY a valid JSON object. Do not include markdown code blocks.
    Format:
    {
      "score": "80/100",
      "feedback": [
         { "question": "Q1 text", "correct": true, "correct_answer": "...", "explanation": "..." },
         { "question": "Q2 text", "correct": false, "correct_answer": "...", "explanation": "..." }
      ]
    }
    
    Student Answers:
    ${JSON.stringify(studentAnswers)}
    `;
    
    try {
        const response = await api.generateAI(authToken, prompt, "You are a strict teacher grading a worksheet. Output strictly JSON.");
        let jsonStr = response.result.replace(/```json/g, '').replace(/```/g, '').trim();
        const grading = JSON.parse(jsonStr);
        
        document.getElementById('ws-score').textContent = `Score: ${grading.score}`;
        const fContainer = document.getElementById('ws-feedback-container');
        fContainer.innerHTML = '';
        
        grading.feedback.forEach(f => {
            const div = document.createElement('div');
            div.style.padding = '15px';
            div.style.borderRadius = '8px';
            div.style.background = f.correct ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            div.style.borderLeft = `4px solid ${f.correct ? 'var(--success-color)' : 'var(--danger-color)'}`;
            
            div.innerHTML = `
                <strong>${f.question}</strong><br>
                <span style="color: ${f.correct ? 'var(--success-color)' : 'var(--danger-color)'}">
                    ${f.correct ? '✅ Correct' : '❌ Incorrect'}
                </span><br>
                ${!f.correct ? `<strong>Correct Answer:</strong> ${f.correct_answer}<br>` : ''}
                <small>${f.explanation}</small>
            `;
            fContainer.appendChild(div);
        });
        
        document.getElementById('ws-grading-area').style.display = 'block';
        
        api.addXp(authToken, 50, 5, 'Completed Worksheet').then(res => {
            applyXpResult(res);
            recordActivity('Completed Worksheet', 'fa-solid fa-file-pen', 50);
        });
        
    } catch (err) {
        console.error(err);
        alert('Failed to grade worksheet. AI might have returned invalid format.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Answers for Grading';
    }
});

// --- AI Creative Logic ---
if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
}

document.getElementById('generate-creative-btn').addEventListener('click', async () => {
    const promptTxt = document.getElementById('creative-prompt').value;
    const diagramType = document.getElementById('creative-type').value;
    const status = document.getElementById('creative-status');
    const container = document.getElementById('creative-output-container');
    const diagramArea = document.getElementById('creative-diagram');
    
    if (!promptTxt) return alert('Please enter a description for your diagram.');
    
    status.style.display = 'block';
    status.textContent = 'Generating visual...';
    container.style.display = 'none';
    
    if (diagramType === 'image') {
        diagramArea.innerHTML = '';
        // User explicitly chose Image Generation — always honour that.
        // (Mermaid options are available separately in the dropdown.)
        const needsCrispText = false;

        if (needsCrispText) {
            status.style.display = 'block';
            status.textContent = 'Generating crisp diagram (perfect readable text)…';

            try {
                const mermaidPrompt = `Create a clean, readable Mermaid diagram for: "${promptTxt}".\n\nRequirements:\n- Use SHORT labels (no paragraphs)\n- Use clear structure\n- Prefer flowchart or mindmap depending on what fits\n- Output ONLY a single \`\`\`mermaid\`\`\` code block, nothing else`;

                const response = await api.generateAI(
                    authToken,
                    mermaidPrompt,
                    'You generate Mermaid diagrams with very readable, minimal labels. Output only Mermaid.'
                );

                let aiOutput = response.result || '';
                let mermaidCode = '';
                const match = aiOutput.match(/```mermaid([\s\S]*?)```/);
                if (match) mermaidCode = match[1];
                if (!mermaidCode) {
                    const match2 = aiOutput.match(/```([\s\S]*?)```/);
                    if (match2) mermaidCode = match2[1];
                }
                mermaidCode = String(mermaidCode || aiOutput).trim();

                diagramArea.innerHTML = '';
                const id = 'mermaid-imglike-' + Date.now();
                diagramArea.innerHTML = `<div class="mermaid" id="${id}">${mermaidCode}</div>`;

                container.style.display = 'block';
                status.style.display = 'none';

                if (typeof mermaid !== 'undefined') {
                    await mermaid.run({ querySelector: `#${id}` });
                }

                // Action buttons: Download SVG + View (bouncy)
                const actionsId = 'creative-image-actions';
                document.getElementById(actionsId)?.remove();
                const actions = document.createElement('div');
                actions.id = actionsId;
                actions.style.display = 'flex';
                actions.style.gap = '12px';
                actions.style.justifyContent = 'center';
                actions.style.marginTop = '14px';

                const downloadBtnEl = document.createElement('button');
                downloadBtnEl.className = 'btn btn-secondary';
                downloadBtnEl.innerHTML = '<i class="fa-solid fa-download"></i> Download SVG';

                const viewBtnEl = document.createElement('button');
                viewBtnEl.className = 'btn';
                viewBtnEl.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> View';
                viewBtnEl.style.animation = 'studyhub-bounce 1.4s infinite';

                actions.appendChild(downloadBtnEl);
                actions.appendChild(viewBtnEl);
                diagramArea.appendChild(actions);

                const svgEl = document.querySelector(`#${id} svg`);
                const svgText = svgEl ? new XMLSerializer().serializeToString(svgEl) : '';

                downloadBtnEl.onclick = () => {
                    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                    const dlUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = dlUrl;
                    a.download = `studyhub-diagram-${Date.now()}.svg`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
                };

                viewBtnEl.onclick = () => {
                    const modal = getOrCreateImageViewModal();
                    const modalImg = modal.querySelector('#image-view-modal-img');
                    if (modalImg) {
                        // Show SVG as data URL
                        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                        modalImg.src = URL.createObjectURL(svgBlob);
                        modalImg.onload = () => setTimeout(() => URL.revokeObjectURL(modalImg.src), 1500);
                    }
                    modal.style.display = 'flex';
                };

                api.addXp(authToken, 20, 5, 'AI Diagram (Crisp Text)').then(applyXpResult);

            } catch (err) {
                console.error(err);
                status.textContent = 'Failed to generate crisp diagram. Please try again.';
            }
            return;
        }

        // Image-art path (best for pictures; NOT for lots of readable text)
        const imagePrompt =
            `${promptTxt}. ` +
            `Ultra sharp, crisp, clean, high detail, high quality, sharp focus. ` +
            `No small text. No paragraphs. Aspect ratio 16:9.`;
        const encodedPrompt = encodeURIComponent(imagePrompt);
        const url = `${API_BASE_URL}/ai/image?prompt=${encodedPrompt}&model=nano-banana&width=2048&height=1152&enhance=true`;

        // Immediate "thinking" loader (ChatGPT-like) while the image provider renders.
        const loader = document.createElement('div');
        loader.style.display = 'flex';
        loader.style.flexDirection = 'column';
        loader.style.alignItems = 'center';
        loader.style.justifyContent = 'center';
        loader.style.gap = '10px';
        loader.style.padding = '26px 16px';

        loader.innerHTML = `
            <div style="display:flex; gap:10px; align-items:center;">
                <div class="studyhub-dot"></div>
                <div class="studyhub-dot"></div>
                <div class="studyhub-dot"></div>
            </div>
            <div style="color: var(--text-secondary); font-weight: 600;">Generating image…</div>
            <div style="color: var(--text-secondary); font-size: 12px; text-align:center; max-width: 520px;">
                This can take some time because the image is rendered on the server (and we request high quality).
            </div>
        `;
        diagramArea.appendChild(loader);

        // Remove old action buttons (if any) at the start of a new generation.
        const actionsId = 'creative-image-actions';
        document.getElementById(actionsId)?.remove();

        // Disable the button while generating (prevents accidental spam clicks).
        const genBtn = document.getElementById('generate-creative-btn');
        const prevBtnHtml = genBtn?.innerHTML;
        if (genBtn) {
            genBtn.disabled = true;
            genBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating…';
        }
        

        const img = document.createElement('img');
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
        img.style.imageRendering = 'auto';

        // If provider stalls, show a helpful message instead of looking "stuck".
        let stalledTimer = setTimeout(() => {
            status.textContent = 'Still generating… (image servers can be slow). If it takes too long, try again or simplify the prompt.';
            status.style.display = 'block';
        }, 9000);
        
        img.onload = () => {
            clearTimeout(stalledTimer);
            container.style.display = 'block';
            status.style.display = 'none';
            loader.remove();
            if (genBtn) {
                genBtn.disabled = false;
                genBtn.innerHTML = prevBtnHtml || '<i class="fa-solid fa-paint-roller"></i> Generate Diagram';
            }

            // Actions: Download + View (bouncy)
            let actions = document.getElementById(actionsId);
            actions = document.createElement('div');
            actions.id = actionsId;
            actions.style.display = 'flex';
            actions.style.gap = '12px';
            actions.style.justifyContent = 'center';
            actions.style.marginTop = '14px';

            const downloadBtnEl = document.createElement('a');
            downloadBtnEl.className = 'btn btn-secondary';
            downloadBtnEl.style.textDecoration = 'none';
            downloadBtnEl.innerHTML = '<i class="fa-solid fa-download"></i> Download';

            const viewBtnEl = document.createElement('button');
            viewBtnEl.className = 'btn';
            viewBtnEl.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> View';
            // bounce animation
            viewBtnEl.style.animation = 'studyhub-bounce 1.4s infinite';

            actions.appendChild(downloadBtnEl);
            actions.appendChild(viewBtnEl);
            // Put buttons directly under the image area so they’re always visible.
            diagramArea.appendChild(actions);

            if (downloadBtnEl) {
                downloadBtnEl.href = img.src;
                downloadBtnEl.download = `studyhub-image-${Date.now()}.jpg`;
                downloadBtnEl.target = '_blank';
                downloadBtnEl.rel = 'noopener noreferrer';
            }
            if (viewBtnEl) {
                viewBtnEl.onclick = () => {
                    const modal = getOrCreateImageViewModal();
                    const modalImg = modal.querySelector('#image-view-modal-img');
                    if (modalImg) modalImg.src = img.src;
                    modal.style.display = 'flex';
                };
            }

            api.addXp(authToken, 20, 5, 'AI Image Generation').then(applyXpResult);
        };
        
        // ── Fallback chain: if generation fails, try backup model, then web image search ──
        const fallbackSources = [
            // 1. Backup AI model (flux)
            async () => `${API_BASE_URL}/ai/image?prompt=${encodedPrompt}&model=flux&width=1280&height=720&enhance=true`,
            // 2. Default Pollinations (no specific model)
            async () => `${API_BASE_URL}/ai/image?prompt=${encodedPrompt}&width=1280&height=720`,
            // 3. Wikipedia / Wikimedia free image search
            async () => {
                const term = encodeURIComponent(promptTxt);
                const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${term}&gsrlimit=5&prop=pageimages&piprop=original&pilimit=5&origin=*`;
                const wRes = await fetch(wikiUrl);
                if (!wRes.ok) return null;
                const wData = await wRes.json();
                const pages = wData?.query?.pages || {};
                const found = Object.values(pages).find(p => p?.original?.source);
                return found?.original?.source || null;
            },
            // 4. Wikimedia Commons direct image search
            async () => {
                const term = encodeURIComponent(promptTxt);
                const cUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${term}&gsrlimit=5&prop=imageinfo&iiprop=url&origin=*`;
                const cRes = await fetch(cUrl);
                if (!cRes.ok) return null;
                const cData = await cRes.json();
                const pages = cData?.query?.pages || {};
                const found = Object.values(pages).find(p => p?.imageinfo?.[0]?.url);
                return found?.imageinfo?.[0]?.url || null;
            }
        ];

        let fbIdx = 0;
        img.onerror = async () => {
            while (fbIdx < fallbackSources.length) {
                const i = fbIdx++;
                try {
                    status.style.display = 'block';
                    status.textContent = i < 2
                        ? 'Image generator hiccup — trying a backup model…'
                        : 'Searching the web for a relevant image…';
                    const next = await fallbackSources[i]();
                    if (next) {
                        img.src = next;
                        return;
                    }
                } catch (_) { /* try next */ }
            }
            // All fallbacks exhausted
            clearTimeout(stalledTimer);
            loader.remove();
            if (genBtn) {
                genBtn.disabled = false;
                genBtn.innerHTML = prevBtnHtml || '<i class="fa-solid fa-paint-roller"></i> Generate Diagram';
            }
            status.textContent = 'Could not generate or find an image. Please try a simpler prompt.';
        };
        
        img.src = url;
        // Keep layout stable: append image but hide until loaded.
        img.style.display = 'none';
        diagramArea.appendChild(img);
        img.addEventListener('load', () => { img.style.display = 'block'; });

        // Add bounce keyframes once
        if (!document.getElementById('studyhub-bounce-style')) {
            const style = document.createElement('style');
            style.id = 'studyhub-bounce-style';
            style.textContent = `
@keyframes studyhub-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.studyhub-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent-primary);
  opacity: 0.35;
  animation: studyhub-dot 1s infinite ease-in-out;
}
.studyhub-dot:nth-child(2) { animation-delay: 0.15s; }
.studyhub-dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes studyhub-dot {
  0%, 100% { transform: translateY(0); opacity: 0.35; }
  50% { transform: translateY(-6px); opacity: 1; }
}
            `.trim();
            document.head.appendChild(style);
        }
        return; // Exit early since we're not using Mermaid
    }
    
    const prompt = `Generate a ${diagramType} using Mermaid.js syntax for the following description: "${promptTxt}".
    You MUST wrap the code in standard markdown backticks (e.g., \`\`\`mermaid\ncode\n\`\`\`). Do NOT output any conversational text or explanation. Only return the markdown block.`;
    
    try {
        const response = await api.generateAI(authToken, prompt, "You are an expert Diagram Generator. Output ONLY raw Mermaid.js syntax inside a markdown code block.");
        let aiOutput = response.result;
        let mermaidCode = '';
        
        const match = aiOutput.match(/```mermaid([\s\S]*?)```/);
        if (match) {
            mermaidCode = match[1];
        } else {
            const match2 = aiOutput.match(/```([\s\S]*?)```/);
            if (match2) {
                mermaidCode = match2[1];
            } else {
                const fallbackMatch = aiOutput.match(/^(graph |flowchart |sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|requirementDiagram|gitGraph|mindmap)[\s\S]*/m);
                if (fallbackMatch) {
                    // Extract until the last possible closing bracket or just take the whole thing
                    mermaidCode = fallbackMatch[0];
                    // Clean up common AI trailing text
                    mermaidCode = mermaidCode.replace(/(Here is your diagram|Enjoy!|Hope this helps).*$/ig, '');
                } else {
                    mermaidCode = aiOutput;
                }
            }
        }
        
        mermaidCode = mermaidCode.trim();
        
        diagramArea.innerHTML = '';
        const id = 'mermaid-' + Date.now();
        diagramArea.innerHTML = `<div class="mermaid" id="${id}">${mermaidCode}</div>`;
        
        container.style.display = 'block';
        status.style.display = 'none';
        
        if (typeof mermaid !== 'undefined') {
            await mermaid.run({
                querySelector: `#${id}`
            });
        }
        
        api.addXp(authToken, 20, 5, 'AI Creative Diagram').then(applyXpResult);
        
    } catch (err) {
        console.error(err);
        status.textContent = 'Failed to generate diagram. Please try a simpler description.';
    }
});

// ================================================================
// PLAN & PAYMENT SYSTEM
// ================================================================

async function loadPlanData() {
    if (!authToken) return;
    try {
        const data = await api.getPlan(authToken);
        currentPlanData = data;
        refreshSidebarLocks();
    } catch (e) {
        console.warn('Could not load plan data:', e.message);
    }
}

function isToolUnlocked(toolId) {
    if (!currentPlanData) return false;
    if (currentPlanData.plan === 'pro' && currentPlanData.is_active) return true;
    return currentPlanData.is_active &&
        Array.isArray(currentPlanData.unlocked_tools) &&
        currentPlanData.unlocked_tools.includes(toolId);
}

function isSectionUnlocked(sectionGate) {
    if (!currentPlanData || !currentPlanData.is_active) return false;
    if (currentPlanData.plan === 'pro') return true;
    if (sectionGate === 'notes') {
        return ['basic', 'standard', 'pro'].includes(currentPlanData.plan);
    }
    if (sectionGate === 'worksheets') {
        return isToolUnlocked('worksheet-generator');
    }
    return false;
}

function refreshSidebarLocks() {
    document.querySelectorAll('[data-section-gate]').forEach(el => {
        const gate = el.getAttribute('data-section-gate');
        if (isSectionUnlocked(gate)) {
            el.classList.add('unlocked');
        } else {
            el.classList.remove('unlocked');
        }
    });
}

function openPlansModal() {
    const modal = document.getElementById('plans-modal');
    if (modal) modal.style.display = 'flex';
}

function closePlansModal() {
    const modal = document.getElementById('plans-modal');
    if (modal) modal.style.display = 'none';
}

async function handlePlanPurchase(plan) {
    currentPurchasePlan = plan;
    closePlansModal();
    const popup = document.getElementById('upgrade-popup');
    if (popup) {
        popup.classList.remove('popup-visible');
        setTimeout(() => { popup.style.display = 'none'; }, 450);
    }
    try {
        const orderData = await api.createPaymentOrder(authToken, plan);
        if (orderData.demo) {
            showDemoPayment(orderData);
        } else {
            loadRazorpayCheckout(orderData);
        }
    } catch (err) {
        showPlanToast('Failed to initiate payment: ' + err.message, 'error');
    }
}

function showDemoPayment(orderData) {
    const modal = document.getElementById('demo-payment-modal');
    if (!modal) return;
    const planNames = { basic: 'Basic Spark', standard: 'Standard', pro: 'Pro Unlimited' };
    const nameEl = document.getElementById('demo-plan-name-display');
    const amtEl  = document.getElementById('demo-plan-amount-display');
    if (nameEl) nameEl.textContent = planNames[orderData.plan] || orderData.plan;
    if (amtEl)  amtEl.textContent  = '₹' + Math.round(orderData.amount / 100);
    modal.style.display = 'flex';

    const btn = document.getElementById('demo-pay-btn');
    if (!btn) return;
    btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Confirm & Activate';
    btn.disabled = false;

    btn.onclick = async () => {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        btn.disabled = true;
        await new Promise(r => setTimeout(r, 2000));
        try {
            const result = await api.verifyPayment(authToken, {
                order_id:   orderData.order_id,
                payment_id: 'demo_' + Date.now(),
                plan:       orderData.plan,
                demo:       true
            });
            modal.style.display = 'none';
            currentPlanData = await api.getPlan(authToken);
            updatePlanBadge();
            if (result.needs_tool_selection) {
                openToolSelectModal(orderData.plan);
            } else {
                loadTools();
                showPlanToast('🎉 Pro Plan activated! All tools unlocked!');
            }
        } catch (err) {
            showPlanToast('Error: ' + err.message, 'error');
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Confirm & Activate';
            btn.disabled = false;
        }
    };
}

function loadRazorpayCheckout(orderData) {
    if (!window.Razorpay) {
        showPlanToast('Payment gateway not loaded. Please refresh.', 'error');
        return;
    }
    const rzp = new window.Razorpay({
        key:         orderData.key_id,
        amount:      orderData.amount,
        currency:    'INR',
        name:        'AI Study Hub',
        description: `${orderData.plan} Plan – 3 Months`,
        order_id:    orderData.order_id,
        handler: async function(response) {
            try {
                const result = await api.verifyPayment(authToken, {
                    order_id:   response.razorpay_order_id,
                    payment_id: response.razorpay_payment_id,
                    signature:  response.razorpay_signature,
                    plan:       orderData.plan
                });
                currentPlanData = await api.getPlan(authToken);
                updatePlanBadge();
                if (result.needs_tool_selection) {
                    openToolSelectModal(orderData.plan);
                } else {
                    loadTools();
                    showPlanToast('🎉 Pro Plan activated! All tools unlocked!');
                }
            } catch (err) {
                showPlanToast('Payment verification failed: ' + err.message, 'error');
            }
        },
        prefill: { name: currentUserData?.username || '' },
        theme: { color: '#4f46e5' }
    });
    rzp.open();
}

function openToolSelectModal(plan) {
    const maxTools = plan === 'basic' ? 10 : 25;
    const countEl  = document.getElementById('tool-select-count');
    const maxEl    = document.getElementById('tool-select-max');
    const chosenEl = document.getElementById('tool-select-chosen');
    if (countEl)  countEl.textContent  = maxTools;
    if (maxEl)    maxEl.textContent    = maxTools;
    if (chosenEl) chosenEl.textContent = '0';

    const oldGrid = document.getElementById('tool-select-grid');
    if (!oldGrid) return;
    const newGrid = oldGrid.cloneNode(false);
    oldGrid.parentNode.replaceChild(newGrid, oldGrid);

    toolsData.filter(t => t.premium).forEach(tool => {
        const item = document.createElement('label');
        item.className = 'tool-select-item';
        item.innerHTML = `
            <input type="checkbox" value="${tool.id}" class="tool-select-cb">
            <div class="tool-select-card">
                <i class="${tool.icon}"></i>
                <span class="ts-name">${tool.name}</span>
                <span class="ts-cat">${tool.category}</span>
            </div>`;
        newGrid.appendChild(item);
    });

    newGrid.addEventListener('change', () => {
        const checked = newGrid.querySelectorAll('.tool-select-cb:checked');
        if (chosenEl) chosenEl.textContent = checked.length;
        if (checked.length >= maxTools) {
            newGrid.querySelectorAll('.tool-select-cb:not(:checked)').forEach(cb => cb.disabled = true);
        } else {
            newGrid.querySelectorAll('.tool-select-cb').forEach(cb => cb.disabled = false);
        }
    });

    document.getElementById('tool-select-modal').style.display = 'flex';
}

function updatePlanBadge() {
    const badge = document.getElementById('plan-badge');
    if (!badge) return;
    const labels = { free: 'Free', basic: 'Basic', standard: 'Standard', pro: 'Pro ⭐' };
    const plan   = currentPlanData?.plan || 'free';
    badge.textContent = labels[plan] || 'Free';
    badge.className   = 'plan-badge plan-' + plan;
    updateProfilePlanCard();
    refreshSidebarLocks();
}

function updateProfilePlanCard() {
    const iconEl  = document.getElementById('profile-plan-icon');
    const labelEl = document.getElementById('profile-plan-label');
    const descEl  = document.getElementById('profile-plan-desc');
    const btn     = document.getElementById('profile-upgrade-btn');
    if (!iconEl || !labelEl || !descEl) return;

    const plan     = currentPlanData?.plan || 'free';
    const isActive = currentPlanData?.is_active || false;
    const expires  = currentPlanData?.expires_at;

    const cfg = {
        free:     { icon: '🆓', label: 'Free Plan',           desc: '10 tools available',          btnText: '<i class="fa-solid fa-rocket"></i> Upgrade Plan', gradient: 'linear-gradient(135deg,#6366f1,#a855f7)' },
        basic:    { icon: '⚡', label: 'Basic Spark',          desc: '10 premium tools unlocked',   btnText: '<i class="fa-solid fa-rocket"></i> Upgrade Plan', gradient: 'linear-gradient(135deg,#6366f1,#a855f7)' },
        standard: { icon: '🌟', label: 'Standard Plan',        desc: '25 premium tools unlocked',   btnText: '<i class="fa-solid fa-rocket"></i> Upgrade to Pro', gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
        pro:      { icon: '👑', label: 'Pro Unlimited',        desc: 'All 50 tools unlocked',       btnText: '<i class="fa-solid fa-check"></i> Active',           gradient: 'linear-gradient(135deg,#10b981,#059669)' },
    };

    const c = (isActive && cfg[plan]) ? cfg[plan] : cfg.free;
    iconEl.textContent  = c.icon;
    labelEl.textContent = c.label;

    if (isActive && expires) {
        const d = new Date(expires);
        descEl.textContent = c.desc + ' · Expires ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } else {
        descEl.textContent = c.desc;
    }

    if (btn) {
        btn.innerHTML = c.btnText;
        if (plan === 'pro' && isActive) {
            btn.style.background = c.gradient;
            btn.style.cursor = 'default';
            btn.onclick = null;
        } else {
            btn.style.background = c.gradient;
            btn.style.cursor = 'pointer';
            btn.onclick = openPlansModal;
        }
    }
}

function showPlanToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = 'plan-toast ' + (type === 'error' ? 'toast-error' : 'toast-success');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('visible')));
    setTimeout(() => {
        t.classList.remove('visible');
        setTimeout(() => t.remove(), 400);
    }, 4000);
}

// ================================================================
// WELCOME SPLASH + CONFETTI
// ================================================================

function showWelcomeSplash() {
    const splash = document.getElementById('welcome-splash');
    if (!splash) { showAppContainer(); return; }

    const nameEl   = document.getElementById('splash-username');
    const levelEl  = document.getElementById('splash-level');
    const xpEl     = document.getElementById('splash-xp');
    const timeEl   = document.getElementById('splash-time');
    const avatarEl = document.getElementById('splash-avatar');

    if (nameEl)   nameEl.textContent   = currentUserData.username;
    if (levelEl)  levelEl.textContent  = currentUserData.level;
    if (xpEl)     xpEl.textContent     = (currentUserData.xp || 0).toLocaleString();
    if (timeEl)   timeEl.textContent   = (currentUserData.time_spent || 0) + 'm';
    if (avatarEl) avatarEl.src         = resolveAvatarUrl(currentUserData.profile_picture, currentUserData);

    splash.style.display   = 'flex';
    splash.style.opacity   = '0';
    splash.style.transform = '';
    requestAnimationFrame(() => {
        splash.style.transition = 'opacity 0.5s ease';
        splash.style.opacity    = '1';
    });

    startConfetti();

    const autoTimer = setTimeout(dismissSplash, 7000);
    const goBtn = document.getElementById('splash-go-btn');
    if (goBtn) {
        goBtn.onclick = () => { clearTimeout(autoTimer); dismissSplash(); };
    }
}

function dismissSplash() {
    const splash = document.getElementById('welcome-splash');
    if (!splash || splash.style.display === 'none') return;
    stopConfetti();
    splash.style.opacity   = '0';
    splash.style.transform = 'scale(1.03)';
    setTimeout(() => {
        splash.style.display   = 'none';
        splash.style.transform = '';
        showAppContainer();
        scheduleUpgradePopup();
    }, 450);
}

function startConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#4f46e5','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444'];
    const pieces = Array.from({ length: 150 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height * 0.5,
        size:     Math.random() * 9 + 5,
        speedY:   Math.random() * 3 + 2,
        speedX:   Math.random() * 2 - 1,
        rotation: Math.random() * 360,
        rotSpeed: Math.random() * 4 - 2,
        color:    colors[Math.floor(Math.random() * colors.length)],
        shape:    Math.random() > 0.4 ? 'rect' : 'circle',
        opacity:  Math.random() * 0.4 + 0.6
    }));

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.translate(p.x + p.size / 2, p.y + p.size / 2);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            if (p.shape === 'rect') {
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotSpeed;
            if (p.y > canvas.height) {
                p.y = -p.size;
                p.x = Math.random() * canvas.width;
            }
        });
        confettiRAF = requestAnimationFrame(animate);
    }
    animate();
}

function stopConfetti() {
    if (confettiRAF) { cancelAnimationFrame(confettiRAF); confettiRAF = null; }
    const canvas = document.getElementById('confetti-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// ================================================================
// UPGRADE POPUP (random timing — bottom-right slide-up)
// ================================================================

function scheduleUpgradePopup() {
    if (upgradePopupDismissCount >= 3) return;
    if (currentPlanData && currentPlanData.plan !== 'free' && currentPlanData.is_active) return;
    const delay = upgradePopupDismissCount === 0 ? 90000 : 300000;
    clearTimeout(upgradePopupTimer);
    upgradePopupTimer = setTimeout(showUpgradePopup, delay);
}

function showUpgradePopup() {
    if (currentPlanData && currentPlanData.plan !== 'free' && currentPlanData.is_active) return;
    const popup = document.getElementById('upgrade-popup');
    if (!popup) return;
    popup.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => popup.classList.add('popup-visible')));
}

function hideUpgradePopup() {
    upgradePopupDismissCount++;
    const popup = document.getElementById('upgrade-popup');
    if (!popup) return;
    popup.classList.remove('popup-visible');
    setTimeout(() => { popup.style.display = 'none'; }, 450);
    scheduleUpgradePopup();
}

// ================================================================
// EVENT LISTENERS — new modals & buttons
// ================================================================

function safeOn(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
    else console.warn('[safeOn] element not found:', id);
}

safeOn('plans-modal-close', 'click', closePlansModal);
safeOn('plans-modal', 'click', e => { if (e.target === e.currentTarget) closePlansModal(); });

safeOn('demo-cancel-btn', 'click', () => {
    const m = document.getElementById('demo-payment-modal');
    if (m) m.style.display = 'none';
});
safeOn('demo-payment-modal', 'click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

safeOn('tool-select-modal', 'click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});
safeOn('tool-select-save', 'click', async () => {
    const selected = [...document.querySelectorAll('#tool-select-grid .tool-select-cb:checked')]
        .map(cb => cb.value);
    if (selected.length === 0) { showPlanToast('Select at least 1 tool', 'error'); return; }
    const btn = document.getElementById('tool-select-save');
    if (!btn) return;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;
    try {
        await api.selectTools(authToken, selected);
        currentPlanData = await api.getPlan(authToken);
        const tsm = document.getElementById('tool-select-modal');
        if (tsm) tsm.style.display = 'none';
        loadTools();
        updatePlanBadge();
        showPlanToast(`🔓 ${selected.length} tools unlocked!`);
    } catch (err) {
        showPlanToast(err.message, 'error');
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Unlock Selected Tools';
        btn.disabled = false;
    }
});

safeOn('upgrade-popup-close', 'click', hideUpgradePopup);
safeOn('upgrade-popup-btn', 'click', () => { hideUpgradePopup(); openPlansModal(); });
