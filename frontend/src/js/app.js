/**
 * Placify Main Application UI Controller & Orchestration Wiring
 */

document.addEventListener('DOMContentLoaded', () => {
  const supervisor = window.placifySupervisor;

  // Global UI references
  const views = {
    onboarding: document.getElementById('view-onboarding'),
    domainSelection: document.getElementById('view-domain-selection'),
    diagnostic: document.getElementById('view-diagnostic'),
    assessmentReport: document.getElementById('view-assessment-report'),
    roadmap: document.getElementById('view-roadmap'),
    dailyHub: document.getElementById('view-daily-hub'),
    conceptQuiz: document.getElementById('view-concept-quiz'),
    progressAnalytics: document.getElementById('view-progress-analytics'),
    techNews: document.getElementById('view-tech-news'),
    internships: document.getElementById('view-internships')
  };

  const consoleContainer = document.getElementById('agent-console');

  // Register live agent logging callback
  window.onAgentLog = function(logEntry) {
    if (!consoleContainer) return;
    const div = document.createElement('div');
    div.className = 'console-entry';
    div.innerHTML = `
      <span class="console-time">[${logEntry.timestamp}]</span>
      <span class="console-agent ${logEntry.agentName}">${logEntry.agentName}</span>
      <span class="console-text"><strong>${logEntry.action}:</strong> ${logEntry.details}</span>
    `;
    consoleContainer.prepend(div);
  };

  function updateNavActiveState(viewKey) {
    const btnRoadmap = document.getElementById('nav-roadmap-btn');
    const btnDaily = document.getElementById('nav-daily-hub-btn');
    const btnProgress = document.getElementById('nav-progress-btn');
    const btnNews = document.getElementById('nav-tech-news-btn');
    const btnInternships = document.getElementById('nav-internships-btn');

    [btnRoadmap, btnDaily, btnProgress, btnNews, btnInternships].forEach(btn => {
      if (btn) {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-muted)';
        btn.style.fontWeight = '600';
      }
    });

    if (viewKey === 'roadmap' && btnRoadmap) {
      btnRoadmap.style.background = 'rgba(6, 182, 212, 0.2)';
      btnRoadmap.style.color = 'var(--accent-cyan)';
      btnRoadmap.style.fontWeight = '700';
    } else if (viewKey === 'dailyHub' && btnDaily) {
      btnDaily.style.background = 'rgba(16, 185, 129, 0.2)';
      btnDaily.style.color = 'var(--accent-emerald)';
      btnDaily.style.fontWeight = '700';
    } else if (viewKey === 'progressAnalytics' && btnProgress) {
      btnProgress.style.background = 'rgba(139, 92, 246, 0.2)';
      btnProgress.style.color = 'var(--accent-violet)';
      btnProgress.style.fontWeight = '700';
    } else if (viewKey === 'techNews' && btnNews) {
      btnNews.style.background = 'rgba(245, 158, 11, 0.2)';
      btnNews.style.color = 'var(--accent-amber)';
      btnNews.style.fontWeight = '700';
    } else if (viewKey === 'internships' && btnInternships) {
      btnInternships.style.background = 'rgba(59, 130, 246, 0.2)';
      btnInternships.style.color = 'var(--accent-blue)';
      btnInternships.style.fontWeight = '700';
    }
  }

  function switchView(viewKey) {
    Object.keys(views).forEach(k => {
      if (views[k]) {
        views[k].classList.remove('active');
      }
    });
    if (views[viewKey]) {
      views[viewKey].classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateNavActiveState(viewKey);

    if (viewKey === 'progressAnalytics' || viewKey === 'roadmap') {
      fetchAndRenderUserProgress();
    }

    // Asynchronously persist last_route in MongoDB Atlas for authenticated users
    const activeSession = supervisor.authAgent.getActiveSession();
    if (activeSession && activeSession.user_id && viewKey !== 'onboarding' && viewKey !== 'diagnostic' && viewKey !== 'domainSelection') {
      fetch('http://localhost:5000/api/user/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: activeSession.user_id, last_route: viewKey })
      }).catch(e => console.warn('Could not persist last_route to DB:', e));
    }
  }

  document.getElementById('nav-roadmap-btn')?.addEventListener('click', () => {
    switchView('roadmap');
  });

  document.getElementById('nav-daily-hub-btn')?.addEventListener('click', () => {
    let savedSpec = null;
    try {
      const raw = localStorage.getItem('placify_selected_day_spec');
      if (raw) savedSpec = JSON.parse(raw);
    } catch (e) {}
    if (!savedSpec) {
      const userState = supervisor.progressTracker.getUserState();
      const activeDay = (userState && userState.currentDayIndex !== undefined) ? userState.currentDayIndex + 1 : (window.currentActiveDay || 1);
      savedSpec = { day: activeDay };
    }
    renderDailyHub(savedSpec);
    switchView('dailyHub');
  });

  document.getElementById('nav-progress-btn')?.addEventListener('click', () => {
    switchView('progressAnalytics');
  });

  document.getElementById('nav-tech-news-btn')?.addEventListener('click', () => {
    renderTechNewsView();
    switchView('techNews');
  });

  document.getElementById('nav-internships-btn')?.addEventListener('click', () => {
    renderInternshipsView();
    switchView('internships');
  });

  document.querySelectorAll('.stat-pill').forEach(pill => {
    pill.style.cursor = 'pointer';
    pill.title = 'Click to view Progress & Analytics Studio';
    pill.addEventListener('click', () => {
      switchView('progressAnalytics');
    });
  });

  function updateHeaderStats() {
    const state = supervisor.progressTracker.getUserState();
    document.getElementById('user-level-val').textContent = state.level || 1;
    document.getElementById('user-xp-val').textContent = state.xp || 0;
    document.getElementById('user-streak-val').textContent = state.streak || 1;

    // Badges
    const badgeGrid = document.getElementById('user-badge-grid');
    if (badgeGrid) {
      badgeGrid.innerHTML = state.badges.map(b => `<div class="badge-item">${b}</div>`).join('');
      document.getElementById('badge-count-num').textContent = state.badges.length;
    }

    // Mastery bar
    const bar = document.getElementById('mastery-bar-fill');
    if (bar) {
      bar.style.width = `${state.masteryPct || 0}%`;
    }
    const num = document.getElementById('mastery-pct-num');
    if (num) {
      num.textContent = `${state.masteryPct || 0}%`;
    }
  }

  // Update Header User Profile Pill
  function updateHeaderUserPill(profile) {
    const badge = document.getElementById('header-user-badge');
    const nameEl = document.getElementById('user-display-name');
    const domainEl = document.getElementById('user-display-domain');

    if (profile) {
      const domainObj = window.PLACIFY_DATA.findDomain(profile.chosen_domain || profile.domainId || profile);
      badge.style.display = 'flex';
      nameEl.textContent = profile.name || 'User';
      domainEl.textContent = domainObj ? domainObj.name : 'Full-Stack Web Development';
    } else {
      badge.style.display = 'none';
    }
  }

  // Domain Selection Screen Renderer (used post-registration and for login when domain is missing)
  let selectedDomainId = null;
  let selectedDsaLanguage = null;

  function isDSADomain(rawDomain) {
    if (!rawDomain || typeof rawDomain !== 'string') return false;
    const clean = rawDomain.trim().toLowerCase();
    return clean === 'dsa' ||
           clean === 'data structures & algorithms' ||
           clean === 'data-structures-algorithms' ||
           clean === 'datastructures' ||
           clean.includes('dsa') ||
           clean.includes('algorithm') ||
           clean.includes('data structure');
  }

  function renderDomainSelectionScreen(userName) {
    const grid = document.getElementById('domain-selection-grid');
    const subtitle = document.getElementById('domain-selection-subtitle');
    const dsaLangCard = document.getElementById('dsa-language-selection-card');
    const confirmBtn = document.getElementById('confirm-domain-btn');
    if (!grid) return;

    selectedDomainId = null;
    selectedDsaLanguage = null;

    if (dsaLangCard) dsaLangCard.style.display = 'none';
    if (confirmBtn) confirmBtn.disabled = true;

    if (subtitle && userName) {
      subtitle.textContent = `Welcome, ${userName}! Select the tech domain you want to master. Your personalized roadmap will be built around this choice.`;
    }

    const domainsList = (window.PLACIFY_DATA && window.PLACIFY_DATA.domains) ? window.PLACIFY_DATA.domains : [];
    grid.innerHTML = domainsList.map(d => `
      <div class="domain-card" data-id="${d.id}" id="dsc-${d.id}">
        <div class="domain-icon"><i class="ph ${d.icon}"></i></div>
        <h3>${d.name}</h3>
        <p>${d.description}</p>
      </div>
    `).join('');

    // Pre-select saved language from profile if available
    const activeSession = supervisor.authAgent ? supervisor.authAgent.getActiveSession() : null;
    const savedLang = (activeSession && activeSession.dsa_programming_language) || (window.currentDraftProfile && window.currentDraftProfile.dsa_programming_language);
    if (savedLang) {
      selectedDsaLanguage = savedLang;
    }

    // Bind DSA language option cards
    const langOptions = document.querySelectorAll('.dsa-lang-option');
    langOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        langOptions.forEach(o => {
          o.style.borderColor = 'var(--border-glass)';
          o.style.background = 'rgba(255, 255, 255, 0.04)';
          const check = o.querySelector('.dsa-lang-check');
          if (check) check.style.display = 'none';
        });

        opt.style.borderColor = '#38bdf8';
        opt.style.background = 'rgba(56, 189, 248, 0.15)';
        const check = opt.querySelector('.dsa-lang-check');
        if (check) check.style.display = 'inline-block';

        selectedDsaLanguage = opt.dataset.lang;
        const errEl = document.getElementById('domain-select-error');
        if (errEl) errEl.style.display = 'none';

        if (confirmBtn) confirmBtn.disabled = false;
      });
    });

    grid.querySelectorAll('.domain-card').forEach(card => {
      card.addEventListener('click', () => {
        grid.querySelectorAll('.domain-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedDomainId = card.dataset.id;
        const errEl = document.getElementById('domain-select-error');
        if (errEl) errEl.style.display = 'none';

        if (isDSADomain(selectedDomainId)) {
          if (dsaLangCard) dsaLangCard.style.display = 'block';

          // If language was already selected, restore highlight
          if (selectedDsaLanguage) {
            const matchedOpt = Array.from(langOptions).find(o => o.dataset.lang.toLowerCase() === selectedDsaLanguage.toLowerCase());
            if (matchedOpt) {
              matchedOpt.click();
            } else {
              if (confirmBtn) confirmBtn.disabled = true;
            }
          } else {
            if (confirmBtn) confirmBtn.disabled = true;
          }
        } else {
          if (dsaLangCard) dsaLangCard.style.display = 'none';
          if (confirmBtn) confirmBtn.disabled = false;
        }
      });
    });

    // Initialize AI Domain Selection Chatbot
    initDomainAssistantChatbot();
  }

  // =========================================================================
  // AI DOMAIN ASSISTANT CHATBOT CONTROLLER
  // =========================================================================
  let chatHistoryMessages = [];
  let isChatbotInitialized = false;

  function initDomainAssistantChatbot() {
    const historyEl = document.getElementById('domain-chat-history');
    const formEl = document.getElementById('domain-chat-form');
    const inputEl = document.getElementById('domain-chat-input');
    const typingEl = document.getElementById('domain-chat-typing');
    const resetBtn = document.getElementById('domain-chat-reset-btn');
    const fabBtn = document.getElementById('domain-chat-fab');
    const closeBtn = document.getElementById('domain-chat-close-btn');
    const wrapper = document.querySelector('.domain-assistant-wrapper');

    if (!historyEl || !formEl || !inputEl) return;

    // Helper: Select card programmatically using existing selection mechanism
    function selectDomainCardProgrammatically(domainId) {
      const targetCard = document.getElementById(`dsc-${domainId}`);
      const grid = document.getElementById('domain-selection-grid');
      if (grid && targetCard) {
        grid.querySelectorAll('.domain-card').forEach(c => c.classList.remove('selected'));
        targetCard.classList.add('selected');
        selectedDomainId = domainId;
        const errEl = document.getElementById('domain-select-error');
        if (errEl) errEl.style.display = 'none';
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Helper: Append Chat Message to UI & State
    function appendMessage(role, text, recommendation = null) {
      chatHistoryMessages.push({ role, content: text });

      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-message ${role}-message`;

      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'message-avatar';
      avatarDiv.innerHTML = role === 'user' ? '<i class="ph ph-user"></i>' : '<i class="ph ph-sparkle"></i>';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';

      // Parse bold/markdown bullet formatting cleanly
      let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formattedText = formattedText.replace(/• (.*?)(\n|$)/g, '<li>$1</li>');
      if (formattedText.includes('<li>')) {
        formattedText = formattedText.replace(/(<li>.*?<\/li>)/gs, '<ul style="margin-top:0.3rem; padding-left:1.2rem;">$1</ul>');
      }
      formattedText = formattedText.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
      contentDiv.innerHTML = formattedText;

      // If structured recommendation is attached, render interactive widget
      if (recommendation && recommendation.recommendedDomain) {
        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'recommendation-card-widget';
        widgetDiv.innerHTML = `
          <div class="recommendation-badge">
            <i class="ph ph-check-circle"></i> Recommended Match (${Math.round((recommendation.confidence || 0.9) * 100)}%)
          </div>
          <div class="recommendation-title">
            <i class="ph ${recommendation.icon || 'ph-compass'}"></i> ${recommendation.recommendedDomain}
          </div>
          <div class="recommendation-reason">${recommendation.reason || ''}</div>
          <button type="button" class="btn-select-recommended" data-id="${recommendation.recommendedDomainId}">
            <i class="ph ph-check"></i> Select ${recommendation.recommendedDomain}
          </button>
          ${recommendation.alternatives && recommendation.alternatives.length > 0 ? `
            <div class="recommendation-alternatives">
              <div class="alternatives-label">Also consider:</div>
              <div class="alternatives-chips">
                ${recommendation.alternatives.map(alt => `<button type="button" class="alternative-chip" data-id="${alt.id}">${alt.name}</button>`).join('')}
              </div>
            </div>
          ` : ''}
        `;

        // Wire Select This Domain button
        const selectBtn = widgetDiv.querySelector('.btn-select-recommended');
        if (selectBtn) {
          selectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            selectDomainCardProgrammatically(recommendation.recommendedDomainId);
            widgetDiv.querySelectorAll('.btn-select-recommended').forEach(b => {
              b.classList.add('selected-active');
              b.innerHTML = `<i class="ph ph-check-circle"></i> Selected ${recommendation.recommendedDomain}`;
            });
          });
        }

        // Wire Alternative Domain buttons
        widgetDiv.querySelectorAll('.alternative-chip').forEach(altBtn => {
          altBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const altId = altBtn.dataset.id;
            selectDomainCardProgrammatically(altId);
            const domObj = window.PLACIFY_DATA ? window.PLACIFY_DATA.findDomain(altId) : null;
            const domName = domObj ? domObj.name : altId;
            if (selectBtn) {
              selectBtn.classList.add('selected-active');
              selectBtn.innerHTML = `<i class="ph ph-check-circle"></i> Selected ${domName}`;
            }
          });
        });

        contentDiv.appendChild(widgetDiv);
      }

      msgDiv.appendChild(avatarDiv);
      msgDiv.appendChild(contentDiv);
      historyEl.appendChild(msgDiv);
      historyEl.scrollTop = historyEl.scrollHeight;
    }

    // Reset Chatbot State
    function resetChat() {
      chatHistoryMessages = [];
      historyEl.innerHTML = `
        <div class="chat-message assistant-message">
          <div class="message-avatar"><i class="ph ph-sparkle"></i></div>
          <div class="message-content">
            <p>Hi! I can help you choose the right learning domain. What are you hoping to build or become good at?</p>
          </div>
        </div>
        <div id="domain-chat-chips" class="chat-chips-container">
          <button type="button" class="chat-chip" data-prompt="I want to build websites and web applications.">🌐 Build Websites & Web Apps</button>
          <button type="button" class="chat-chip" data-prompt="I want to analyze data and build machine learning models.">📊 Data & AI Models</button>
          <button type="button" class="chat-chip" data-prompt="I want to learn ethical hacking and penetration testing.">🛡️ Ethical Hacking & Cyber</button>
          <button type="button" class="chat-chip" data-prompt="I want to manage AWS cloud systems and DevOps pipelines.">☁️ AWS Cloud & DevOps</button>
          <button type="button" class="chat-chip" data-prompt="I want to build mobile apps for iOS and Android.">📱 Mobile Apps (React Native/Flutter)</button>
        </div>
      `;
      bindChipListeners();
      if (inputEl) inputEl.value = '';
    }

    // Send User Input to Backend AI Endpoint
    async function handleSendUserMessage(userText) {
      const text = (userText || inputEl.value || '').trim();
      if (!text) return;

      // Remove chips container if visible
      const chipsEl = document.getElementById('domain-chat-chips');
      if (chipsEl) chipsEl.style.display = 'none';

      inputEl.value = '';
      appendMessage('user', text);

      if (typingEl) typingEl.style.display = 'flex';
      historyEl.scrollTop = historyEl.scrollHeight;

      try {
        const response = await fetch('http://localhost:5000/api/domain-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatHistoryMessages,
            availableDomains: (window.PLACIFY_DATA && window.PLACIFY_DATA.domains) ? window.PLACIFY_DATA.domains : []
          })
        });

        const data = await response.json();
        if (typingEl) typingEl.style.display = 'none';

        if (!response.ok || !data) {
          throw new Error(data.error || 'Failed to communicate with AI Assistant.');
        }

        appendMessage('assistant', data.reply || 'Here is my recommendation:', data.recommendation || null);

      } catch (err) {
        if (typingEl) typingEl.style.display = 'none';
        appendMessage('assistant', "I'm having trouble connecting right now. You can still choose a domain manually from the options on the screen.");
      }
    }

    // Bind Chip Click Events
    function bindChipListeners() {
      const chips = historyEl.querySelectorAll('.chat-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          const prompt = chip.dataset.prompt;
          handleSendUserMessage(prompt);
        });
      });
    }

    if (!isChatbotInitialized) {
      isChatbotInitialized = true;

      bindChipListeners();

      if (formEl) {
        formEl.addEventListener('submit', (e) => {
          e.preventDefault();
          handleSendUserMessage();
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', () => resetChat());
      }

      if (fabBtn && wrapper) {
        fabBtn.addEventListener('click', () => {
          wrapper.classList.toggle('active');
        });
      }

      if (closeBtn && wrapper) {
        closeBtn.addEventListener('click', () => {
          wrapper.classList.remove('active');
        });
      }
    }
  }

  // (legacy: keep renderDomainGrid as no-op since domain grid removed from reg form)
  function renderDomainGrid() {}

  // Render Domain Grid immediately (no-op now)
  renderDomainGrid();

  // Restore Active Session on Load
  const activeSession = supervisor.authAgent.getActiveSession();
  if (activeSession && activeSession.user_id) {
    updateHeaderUserPill(activeSession);
    window.currentDraftProfile = {
      user_id: activeSession.user_id,
      name: activeSession.name,
      domainId: activeSession.chosen_domain,
      chosen_domain: activeSession.chosen_domain,
      timelineMonths: activeSession.timeline_months || 4,
      dailyHours: activeSession.daily_hours || 2.0
    };

    supervisor.checkUserOnboardingState(activeSession.user_id).then(async (state) => {
      if (state.action === 'DOMAIN_SELECT') {
        renderDomainSelectionScreen(activeSession.name);
        switchView('domainSelection');
      } else if (state.action === 'QUIZ') {
        renderDiagnosticQuiz(activeSession.chosen_domain);
        switchView('diagnostic');
      } else {
        if (state.roadmap) {
          await renderRoadmapView(state.roadmap);
        }
        switchView(state.route || 'roadmap');
      }
    }).catch(err => {
      console.warn('Session restore check error:', err);
    });
  }

  // Logout Handler
  document.getElementById('logout-btn').addEventListener('click', () => {
    supervisor.authAgent.clearSession();
    updateHeaderUserPill(null);
    switchView('onboarding');
    supervisor.logAgentAction('auth_specialist', 'User Signed Out', 'Cleared active session credentials.');
  });

  // =========================================================================
  // VIEW 1: AUTH & ONBOARDING SPECIALIST
  // =========================================================================
  
  // Auth Tab Switchers
  const tabRegBtn = document.getElementById('tab-register-btn');
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const panelReg = document.getElementById('auth-register-panel');
  const panelLogin = document.getElementById('auth-login-panel');

  tabRegBtn.addEventListener('click', (e) => {
    e.preventDefault();
    tabRegBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    panelReg.style.display = 'block';
    panelReg.classList.add('active');
    panelLogin.style.display = 'none';
    panelLogin.classList.remove('active');
  });

  tabLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    tabLoginBtn.classList.add('active');
    tabRegBtn.classList.remove('active');
    panelLogin.style.display = 'block';
    panelLogin.classList.add('active');
    panelReg.style.display = 'none';
    panelReg.classList.remove('active');
  });

  // Registration Form Handler
  const registrationForm = document.getElementById('registration-form');
  const regAlert = document.getElementById('reg-error-alert');

  registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regAlert.style.display = 'none';

    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
      // 1. Authenticate / Register via AuthAgent (no domain yet)
      const profile = await supervisor.registerUser({
        name,
        email,
        password
      });

      updateHeaderUserPill(profile);

      // Save active draft profile for Supervisor
      window.currentDraftProfile = {
        user_id: profile.user_id,
        name: profile.name,
        domainId: null,
        chosen_domain: null,
        timelineMonths: profile.timeline_months || 4,
        dailyHours: profile.daily_hours || 2.0
      };

      // 2. NEW USER: Go to domain selection screen
      renderDomainSelectionScreen(profile.name);
      switchView('domainSelection');

    } catch (err) {
      if (err.status === 409 || (err.message && err.message.toLowerCase().includes('already exists'))) {
        regAlert.innerHTML = `
          <i class="ph ph-warning" style="font-size: 1.2rem; color: #f87171;"></i>
          <div>
            <strong>${err.message || 'An account with this email address already exists.'}</strong><br>
            <a href="#" id="switch-to-login-link" style="color: var(--accent-cyan); font-weight: 700; text-decoration: underline; font-size: 0.85rem; margin-top: 0.3rem; display: inline-block;">Click here to switch to Existing User Sign In</a>
          </div>
        `;
        regAlert.style.display = 'flex';
        const link = document.getElementById('switch-to-login-link');
        if (link) {
          link.addEventListener('click', (ev) => {
            ev.preventDefault();
            tabLoginBtn.click();
          });
        }
      } else {
        regAlert.textContent = err.message || 'Registration failed.';
        regAlert.style.display = 'flex';
      }
    }
  });

  // Login Form Handler
  const loginForm = document.getElementById('login-form');
  const loginAlert = document.getElementById('login-error-alert');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginAlert.style.display = 'none';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      // 1. Authenticate credentials via AuthAgent
      const profile = await supervisor.authenticateUser(email, password);

      updateHeaderUserPill(profile);

      // Save active draft profile for Supervisor
      window.currentDraftProfile = {
        user_id: profile.user_id,
        name: profile.name,
        domainId: profile.chosen_domain,
        chosen_domain: profile.chosen_domain,
        timelineMonths: profile.timeline_months,
        dailyHours: profile.daily_hours
      };

      // 2. CHECK AUTHORITATIVE MONGODB ONBOARDING STATE
      const onboardingState = await supervisor.checkUserOnboardingState(profile.user_id);

      if (onboardingState.action === 'DOMAIN_SELECT') {
        // User has no domain yet — show domain selection
        renderDomainSelectionScreen(profile.name);
        switchView('domainSelection');
      } else if (onboardingState.action === 'QUIZ') {
        // New user / incomplete quiz -> Diagnostic Quiz
        renderDiagnosticQuiz(profile.chosen_domain);
        switchView('diagnostic');
      } else {
        // Returning user with quiz_completed = true!
        // DO NOT SHOW DIAGNOSTIC QUIZ AGAIN.
        if (onboardingState.roadmap) {
          await renderRoadmapView(onboardingState.roadmap);
        }
        const routeToSwitch = onboardingState.route || 'roadmap';
        if (routeToSwitch === 'dailyHub') {
          let savedSpec = null;
          try {
            const raw = localStorage.getItem('placify_selected_day_spec');
            if (raw) savedSpec = JSON.parse(raw);
          } catch(e) {}
          if (!savedSpec) {
            const userState = supervisor.progressTracker.getUserState();
            const activeDay = (userState && userState.currentDayIndex !== undefined) ? userState.currentDayIndex + 1 : 1;
            savedSpec = { day: activeDay };
          }
          renderDailyHub(savedSpec);
        }
        switchView(routeToSwitch);
      }

    } catch (err) {
      const isFetchError = err.message && err.message.includes('Failed to fetch');
      loginAlert.innerHTML = `
        <i class="ph ph-warning-octagon" style="font-size: 1.5rem; color: #f87171;"></i>
        <div>
          <strong style="color: #ef4444;">${isFetchError ? 'Server Connection Error' : (err.status === 401 ? 'HTTP 401 Unauthorized' : 'Authentication Error')}</strong><br>
          <span style="font-size: 0.85rem;">${isFetchError ? 'Placify backend server is offline. Please run "node server.js" in PowerShell terminal to start port 5000.' : (err.message || 'Invalid email or password credentials.')}</span>
        </div>
      `;
      loginAlert.style.display = 'flex';
    }
  });

  // =========================================================================
  // VIEW 1b: DOMAIN SELECTION SCREEN HANDLER
  // =========================================================================
  const confirmDomainBtn = document.getElementById('confirm-domain-btn');
  const domainSelectError = document.getElementById('domain-select-error');

  if (confirmDomainBtn) {
    confirmDomainBtn.addEventListener('click', async () => {
      if (domainSelectError) domainSelectError.style.display = 'none';

      if (!selectedDomainId) {
        if (domainSelectError) {
          domainSelectError.textContent = 'Please click to select a domain before continuing.';
          domainSelectError.style.display = 'flex';
        }
        return;
      }

      if (isDSADomain(selectedDomainId) && !selectedDsaLanguage) {
        if (domainSelectError) {
          domainSelectError.textContent = 'Please select a programming language for your DSA roadmap.';
          domainSelectError.style.display = 'flex';
        }
        return;
      }

      const activeSession = supervisor.authAgent.getActiveSession() || window.currentDraftProfile;
      const userId = activeSession ? activeSession.user_id : null;

      if (!userId) {
        if (domainSelectError) {
          domainSelectError.textContent = 'User session not found. Please register or sign in again.';
          domainSelectError.style.display = 'flex';
        }
        return;
      }

      try {
        confirmDomainBtn.disabled = true;
        confirmDomainBtn.innerHTML = '<i class="ph ph-spinner spinner"></i> Saving Domain...';

        const payload = { chosen_domain: selectedDomainId };
        if (isDSADomain(selectedDomainId) && selectedDsaLanguage) {
          payload.dsa_programming_language = selectedDsaLanguage;
        }

        const res = await fetch(`http://localhost:5000/api/user/${userId}/domain`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok || !data.profile) {
          throw new Error(data.error || 'Failed to save selected domain.');
        }

        const updatedProfile = data.profile;
        supervisor.authAgent.setActiveSession(updatedProfile);
        updateHeaderUserPill(updatedProfile);

        window.currentDraftProfile = {
          user_id: updatedProfile.user_id,
          name: updatedProfile.name,
          domainId: updatedProfile.chosen_domain,
          chosen_domain: updatedProfile.chosen_domain,
          dsa_programming_language: updatedProfile.dsa_programming_language || selectedDsaLanguage,
          timelineMonths: updatedProfile.timeline_months,
          dailyHours: updatedProfile.daily_hours
        };

        // Render Phase 2: Diagnostic Quiz Phase
        renderDiagnosticQuiz(selectedDomainId);
        switchView('diagnostic');

      } catch (err) {
        if (domainSelectError) {
          domainSelectError.textContent = err.message || 'Failed to save domain. Please try again.';
          domainSelectError.style.display = 'flex';
        }
      } finally {
        confirmDomainBtn.disabled = false;
        confirmDomainBtn.innerHTML = '<i class="ph ph-arrow-right"></i> Continue with Selected Domain';
      }
    });
  }

  // =========================================================================
  // =========================================================================
  // VIEW 2: NPTEL-STYLE DIAGNOSTIC QUIZ RUNNER
  // =========================================================================
  let currentDiagnosticIndex = 0;
  let currentDiagnosticDomainObj = null;
  let diagnosticUserAnswers = {};

  function shuffleArray(array) {
    const arr = [...(array || [])];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function renderDiagnosticQuiz(domainId, customQuestions = null) {
    const domain = window.PLACIFY_DATA.findDomain(domainId);
    currentDiagnosticDomainObj = domain || { id: domainId, name: domainId, diagnostics: [] };
    currentDiagnosticIndex = 0;
    diagnosticUserAnswers = {};

    const allDiagnostics = (domain && domain.diagnostics) ? domain.diagnostics : [];
    let activeDiagnostics = [];
    if (Array.isArray(customQuestions) && customQuestions.length > 0) {
      activeDiagnostics = customQuestions;
    } else {
      // Level-Filtered & Topic-Balanced Controlled Randomization Fallback
      const targetLevel = (selectedSelfLevel || 'BEGINNER').toUpperCase();
      
      // 1. Filter candidate pool by difficulty matching requested level
      let candidatePool = allDiagnostics.filter(d => {
        const diff = (d.difficulty || 'BEGINNER').toUpperCase();
        if (targetLevel === 'BEGINNER') {
          return diff === 'BEGINNER' || diff === 'EASY';
        } else if (targetLevel === 'INTERMEDIATE') {
          return diff === 'INTERMEDIATE' || diff === 'MEDIUM';
        } else if (targetLevel === 'ADVANCED' || targetLevel === 'EXPERT') {
          return diff === 'ADVANCED' || diff === 'HARD' || diff === 'EXPERT';
        }
        return true;
      });

      if (candidatePool.length < selectedQuestionCount) {
        candidatePool = [...allDiagnostics];
      }

      // 2. Group candidate questions by topic for balanced topic coverage
      const topicsMap = {};
      candidatePool.forEach(q => {
        const t = q.topic || 'Core Knowledge';
        if (!topicsMap[t]) topicsMap[t] = [];
        topicsMap[t].push(q);
      });

      // 3. Randomly shuffle each topic pool using per-attempt non-deterministic sampling
      Object.keys(topicsMap).forEach(t => {
        topicsMap[t] = shuffleArray(topicsMap[t]);
      });

      // 4. Round-robin topic sampling to guarantee topic diversity & distinct sets per attempt
      const topicKeys = Object.keys(topicsMap);
      const selected = [];
      const selectedIds = new Set();
      let topicIdx = 0;
      let passes = 0;

      while (selected.length < selectedQuestionCount && candidatePool.length > 0 && passes < 100) {
        passes++;
        const currentTopic = topicKeys[topicIdx % topicKeys.length];
        const topicPool = topicsMap[currentTopic];

        if (topicPool && topicPool.length > 0) {
          const item = topicPool.pop();
          if (item && !selectedIds.has(item.id)) {
            selected.push(item);
            selectedIds.add(item.id);
          }
        }
        topicIdx++;

        if (selected.length < selectedQuestionCount && topicKeys.every(k => !topicsMap[k] || topicsMap[k].length === 0)) {
          const remainingCandidates = shuffleArray(candidatePool.filter(c => !selectedIds.has(c.id)));
          for (const item of remainingCandidates) {
            if (selected.length >= selectedQuestionCount) break;
            selected.push(item);
            selectedIds.add(item.id);
          }
          break;
        }
      }

      activeDiagnostics = selected.slice(0, selectedQuestionCount);
    }
    currentDiagnosticDomainObj.activeDiagnostics = activeDiagnostics;
    window.currentDiagnosticDomainObj = currentDiagnosticDomainObj;

    const container = document.getElementById('diagnostic-questions-container');
    const paletteContainer = document.getElementById('diagnostic-palette-container');
    const countBadge = document.getElementById('diagnostic-concept-count-badge');

    if (countBadge) {
      countBadge.textContent = 'Technical Diagnostic Quiz';
    }

    const domainNameText = domain ? domain.name : domainId;

    // Populate Manual Self-Assessment Header & Topic Grid
    const headerDomainName = document.getElementById('diagnostic-domain-name-header');
    if (headerDomainName) headerDomainName.textContent = domainNameText;

    const manualDomainTitle = document.getElementById('manual-domain-title');
    if (manualDomainTitle) manualDomainTitle.textContent = domainNameText;

    const quizDomainTitle = document.getElementById('quiz-domain-title');
    if (quizDomainTitle) quizDomainTitle.textContent = domainNameText;

    // Reset Quiz Wrapper to hidden initially
    const quizWrapper = document.getElementById('diagnostic-quiz-wrapper');
    if (quizWrapper) quizWrapper.style.display = 'none';

    const topicGrid = document.getElementById('manual-topic-grid');
    if (topicGrid) {
      const topicSource = activeDiagnostics.length > 0 ? activeDiagnostics : allDiagnostics;
      const domainTopics = (domain && domain.topics && domain.topics.length > 0)
        ? domain.topics
        : Array.from(new Set(topicSource.map(d => d.topic))).filter(Boolean);
      topicGrid.innerHTML = domainTopics.map((topic, idx) => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.7rem 0.9rem; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.82rem; font-weight: 600; color: #fff;">${topic}</span>
          <label style="font-size: 0.75rem; color: var(--accent-rose); display: flex; align-items: center; gap: 0.3rem; cursor: pointer;">
            <input type="checkbox" class="manual-weak-topic-cb" data-topic="${topic}" style="accent-color: var(--accent-rose);">
            Need Practice
          </label>
        </div>
      `).join('');
    }

    // Render Palette Buttons for the 10 active randomized questions
    if (paletteContainer) {
      paletteContainer.innerHTML = activeDiagnostics.map((q, idx) => `
        <button type="button" class="palette-btn ${idx === 0 ? 'active' : ''}" data-qidx="${idx}" id="palette-btn-${idx}" style="min-width: 32px; height: 32px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.05); color: #fff; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          ${idx + 1}
        </button>
      `).join('');

      paletteContainer.onclick = function(e) {
        const btn = e.target.closest('.palette-btn');
        if (btn) {
          const targetIdx = parseInt(btn.dataset.qidx, 10);
          if (!isNaN(targetIdx)) {
            showDiagnosticQuestion(targetIdx);
          }
        }
      };
    }

    function escapeHTML(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Render Question Cards for active randomized questions
    container.innerHTML = activeDiagnostics.map((q, idx) => {
      const qType = (q.type || 'MCQ').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      const isMSQ = qType === 'MSQ' || qType === 'MULTIPLE_SELECT' || qType === 'MULTIPLE_CHOICE_MULTI';
      const isTextOrNumerical = (qType === 'NUMERICAL' || qType === 'FILL_BLANK' || qType === 'FILL_IN_THE_BLANK' || qType === 'SHORT_ANSWER') && (!Array.isArray(q.options) || q.options.length === 0);

      let typeBadgeColor = 'var(--accent-violet)';
      if (isMSQ) typeBadgeColor = '#f59e0b';
      else if (isTextOrNumerical) typeBadgeColor = '#3b82f6';
      else if (qType === 'CODE_OUTPUT') typeBadgeColor = '#ec4899';
      else if (qType === 'SCENARIO_BASED') typeBadgeColor = '#10b981';

      const safeQuestion = escapeHTML(q.question);
      const safeTopic = escapeHTML(q.topic);
      const safeSubtopic = escapeHTML(q.subtopic || 'Core Concept');
      const safeCodeSnippet = q.codeSnippet ? escapeHTML(q.codeSnippet) : null;

      return `
        <div class="quiz-question-card" data-qid="${q.id}" data-qidx="${idx}" style="display: ${idx === 0 ? 'block' : 'none'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
              <span class="question-badge" style="background: rgba(139, 92, 246, 0.2); color: var(--accent-violet); padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.8rem;">Q${idx + 1} / ${activeDiagnostics.length}</span>
              <span style="font-size: 0.75rem; background: rgba(255, 255, 255, 0.1); color: var(--text-muted); padding: 0.2rem 0.5rem; border-radius: 4px;">${safeTopic}</span>
              <span style="font-size: 0.75rem; background: rgba(255, 255, 255, 0.05); color: var(--text-muted); padding: 0.2rem 0.5rem; border-radius: 4px;">${safeSubtopic}</span>
            </div>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <span style="font-size: 0.75rem; background: rgba(255,255,255,0.08); color: ${typeBadgeColor}; padding: 0.2rem 0.6rem; border-radius: 50px; font-weight: 700;">${qType}</span>
              <span class="tier-badge ${q.difficulty}" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">${q.difficulty}</span>
            </div>
          </div>

          <div class="quiz-question-title" style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; line-height: 1.5;">
            ${safeQuestion}
          </div>

          ${safeCodeSnippet ? `
            <pre style="background: rgba(0,0,0,0.5); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); overflow-x: auto; font-family: monospace; font-size: 0.85rem; color: #a7f3d0; margin-bottom: 1rem;"><code>${safeCodeSnippet}</code></pre>
          ` : ''}

          <!-- OPTIONS OR NUMERICAL / TEXT INPUT -->
          <div class="quiz-options">
            ${isTextOrNumerical ? `
              <div style="margin-top: 0.5rem;">
                <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.4rem;">
                  ${qType === 'NUMERICAL' ? 'Enter Numerical Answer:' : 'Enter Your Answer:'}
                </label>
                <input type="${qType === 'NUMERICAL' ? 'number' : 'text'}" step="any" class="form-input text-answer-input numerical-input" data-qid="${q.id}" placeholder="${qType === 'NUMERICAL' ? 'e.g. 10 or 0.5' : 'Type your answer here...'}" style="max-width: 400px; width: 100%;">
              </div>
            ` : (isMSQ ? `
              <div style="font-size: 0.8rem; color: #f59e0b; font-weight: 600; margin-bottom: 0.6rem;">Select ALL correct answers:</div>
              ${(q.options || []).map((opt, oIdx) => `
                <label class="option-btn msq-option-btn" data-qid="${q.id}" data-oidx="${oIdx}" style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; padding: 0.7rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); margin-bottom: 0.5rem;">
                  <input type="checkbox" class="msq-checkbox" data-qid="${q.id}" data-oidx="${oIdx}" style="width: 18px; height: 18px; accent-color: var(--accent-violet);">
                  <span class="opt-text">${escapeHTML(opt)}</span>
                </label>
              `).join('')}
            ` : `
              ${(q.options || []).map((opt, oIdx) => `
                <div class="option-btn" data-qid="${q.id}" data-oidx="${oIdx}">
                  <i class="ph ph-circle"></i> <span class="opt-text">${escapeHTML(opt)}</span>
                </div>
              `).join('')}
            `)}
          </div>
        </div>
      `;
    }).join('');

    updateDiagnosticControls();

    // Attach Event Handlers for Options / Numerical / Text / MSQ
    const handleInputChange = function(e) {
      if (e.target.classList.contains('text-answer-input') || e.target.classList.contains('numerical-input')) {
        const qid = e.target.dataset.qid;
        const val = e.target.value.trim();
        if (val !== '') {
          diagnosticUserAnswers[qid] = val;
        } else {
          delete diagnosticUserAnswers[qid];
        }
        updatePaletteStatus();
      }
      if (e.target.classList.contains('msq-checkbox')) {
        const qid = e.target.dataset.qid;
        const card = container.querySelector(`.quiz-question-card[data-qid="${qid}"]`);
        const checkboxes = card.querySelectorAll('.msq-checkbox:checked');
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.oidx, 10));
        if (selectedIndices.length > 0) {
          diagnosticUserAnswers[qid] = selectedIndices;
        } else {
          delete diagnosticUserAnswers[qid];
        }
        updatePaletteStatus();
      }
    };

    container.onchange = handleInputChange;
    container.oninput = handleInputChange;

    container.onclick = function(e) {
      const btn = e.target.closest('.option-btn:not(.msq-option-btn)');
      if (!btn) return;

      const qid = btn.dataset.qid;
      const oidx = parseInt(btn.dataset.oidx, 10);
      diagnosticUserAnswers[qid] = oidx;

      container.querySelectorAll(`.option-btn[data-qid="${qid}"]`).forEach(b => {
        b.classList.remove('selected');
        const icon = b.querySelector('i');
        if (icon) icon.className = 'ph ph-circle';
      });

      btn.classList.add('selected');
      const icon = btn.querySelector('i');
      if (icon) icon.className = 'ph ph-check-circle';

      updatePaletteStatus();
    };
  }

  function getActiveDiagnosticList() {
    if (currentDiagnosticDomainObj && currentDiagnosticDomainObj.activeDiagnostics) {
      return currentDiagnosticDomainObj.activeDiagnostics;
    }
    return (currentDiagnosticDomainObj && currentDiagnosticDomainObj.diagnostics) ? currentDiagnosticDomainObj.diagnostics : [];
  }

  function showDiagnosticQuestion(index) {
    const list = getActiveDiagnosticList();
    if (!currentDiagnosticDomainObj || index < 0 || index >= list.length) return;
    currentDiagnosticIndex = index;

    const cards = document.querySelectorAll('#diagnostic-questions-container .quiz-question-card');
    cards.forEach((card, idx) => {
      card.style.display = (idx === index) ? 'block' : 'none';
    });

    updateDiagnosticControls();
  }

  function updateDiagnosticControls() {
    if (!currentDiagnosticDomainObj) return;
    const list = getActiveDiagnosticList();
    const total = list.length;
    const prevBtn = document.getElementById('quiz-prev-btn');
    const nextBtn = document.getElementById('quiz-next-btn');

    if (prevBtn) prevBtn.style.display = currentDiagnosticIndex > 0 ? 'inline-flex' : 'none';
    if (nextBtn) nextBtn.style.display = currentDiagnosticIndex < total - 1 ? 'inline-flex' : 'none';

    // Update Palette Buttons
    const paletteBtns = document.querySelectorAll('#diagnostic-palette-container .palette-btn');
    paletteBtns.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === currentDiagnosticIndex);
      const q = list[idx];
      const isAnswered = q && diagnosticUserAnswers[q.id] !== undefined && diagnosticUserAnswers[q.id] !== '' && diagnosticUserAnswers[q.id] !== -1;

      if (idx === currentDiagnosticIndex) {
        btn.style.background = 'var(--accent-violet)';
        btn.style.borderColor = 'var(--accent-violet)';
        btn.style.color = '#fff';
      } else if (isAnswered) {
        btn.style.background = 'rgba(16, 185, 129, 0.2)';
        btn.style.borderColor = 'var(--accent-emerald)';
        btn.style.color = '#a7f3d0';
      } else {
        btn.style.background = 'rgba(255, 255, 255, 0.05)';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        btn.style.color = 'var(--text-muted)';
      }
    });
  }

  function updatePaletteStatus() {
    updateDiagnosticControls();
  }

  window.renderDiagnosticQuiz = renderDiagnosticQuiz;

  // Prev / Next button listeners
  const prevBtn = document.getElementById('quiz-prev-btn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => showDiagnosticQuestion(currentDiagnosticIndex - 1));
  }
  const nextBtn = document.getElementById('quiz-next-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => showDiagnosticQuestion(currentDiagnosticIndex + 1));
  }

  const diagnosticForm = document.getElementById('diagnostic-quiz-form');
  diagnosticForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentDiagnosticDomainObj) return;

    const list = getActiveDiagnosticList();
    const totalQuestions = list.length;
    let unansweredCount = 0;

    list.forEach(q => {
      if (diagnosticUserAnswers[q.id] === undefined || diagnosticUserAnswers[q.id] === '' || diagnosticUserAnswers[q.id] === -1) {
        unansweredCount++;
      }
    });

    if (unansweredCount > 0) {
      const confirmSubmit = confirm(`⚠️ You have ${unansweredCount} unanswered questions out of ${totalQuestions}.\n\nDo you want to submit your assessment anyway? (Unanswered questions will be evaluated as incorrect).`);
      if (!confirmSubmit) return;
    }

    if (!window.currentDraftProfile) {
      const activeSession = supervisor.authAgent.getActiveSession();
      if (activeSession) {
        window.currentDraftProfile = {
          user_id: activeSession.user_id,
          name: activeSession.name,
          domainId: activeSession.chosen_domain,
          chosen_domain: activeSession.chosen_domain,
          timelineMonths: activeSession.timeline_months || 4,
          dailyHours: activeSession.daily_hours || 2.0
        };
      }
    }

    const overlay = document.getElementById('roadmap-loading-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
      // Evaluate diagnostic answers first
      const quizPayload = {
        answers: diagnosticUserAnswers,
        declaredSelfLevel: selectedSelfLevel,
        quizAttemptId: window.currentQuizAttemptId
      };

      const evaluation = await supervisor.quizEvaluator.evaluateDiagnostic(
        currentDiagnosticDomainObj.id,
        quizPayload,
        window.currentDraftProfile.user_id
      );

      window.activeQuizEvaluation = evaluation;

      if (overlay) overlay.style.display = 'none';

      // Render Assessment Report & AI Plan Recommendation
      renderAssessmentReport(evaluation);
      await fetchAndRenderPlanRecommendation(evaluation);
      updateHeaderStats();

      // Display Phase 2 Diagnostic Report & Recommended Plan step!
      switchView('assessmentReport');

    } catch (err) {
      if (overlay) overlay.style.display = 'none';
      console.error('Error during quiz evaluation:', err);
      alert('Error evaluating diagnostic quiz: ' + err.message);
    }
  });

  let selectedSelfLevel = 'BEGINNER';
  let selectedQuestionCount = 10;

  // Handle Question Count Pill Clicks
  document.querySelectorAll('.quiz-count-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.quiz-count-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedQuestionCount = parseInt(pill.dataset.count, 10) || 10;
      const btnLabel = document.getElementById('quiz-count-btn-label');
      if (btnLabel) btnLabel.textContent = `${selectedQuestionCount}-Question`;
    });
  });

  function updateDeclaredLevelUI(level) {
    selectedSelfLevel = level;
    if (window.currentDraftProfile) {
      window.currentDraftProfile.currentSkillLevel = level;
      window.currentDraftProfile.current_skill_level = level;
    }
    const pill = document.getElementById('selected-level-pill');
    if (pill) {
      pill.textContent = `${level} SELECTED`;
      pill.className = `tier-label ${level}`;
      if (level === 'INTERMEDIATE') {
        pill.style.background = 'rgba(245, 158, 11, 0.2)';
        pill.style.color = '#f59e0b';
      } else {
        pill.style.background = '';
        pill.style.color = '';
      }
    }
    const summary = document.getElementById('declared-level-summary');
    if (summary) {
      summary.textContent = level;
      summary.style.color = level === 'INTERMEDIATE' ? '#f59e0b' : (level === 'ADVANCED' ? 'var(--accent-violet)' : 'var(--accent-emerald)');
    }
    const tag = document.getElementById('quiz-declared-level-tag');
    if (tag) {
      tag.textContent = level;
      tag.className = `tier-label ${level}`;
      if (level === 'INTERMEDIATE') {
        tag.style.background = 'rgba(245, 158, 11, 0.2)';
        tag.style.color = '#f59e0b';
      } else {
        tag.style.background = '';
        tag.style.color = '';
      }
    }
  }

  // Handle Level Card Clicks (Step 1)
  document.querySelectorAll('.manual-level-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.manual-level-card').forEach(c => {
        c.classList.remove('active');
        c.style.border = '1px solid rgba(255, 255, 255, 0.12)';
        const icon = c.querySelector('.manual-card-icon');
        if (icon) {
          icon.className = 'ph ph-circle';
          icon.style.color = 'var(--text-muted)';
        }
      });
      card.classList.add('active');
      const level = card.dataset.level || 'BEGINNER';

      let borderColor = 'var(--accent-emerald)';
      let iconColor = 'var(--accent-emerald)';
      if (level === 'INTERMEDIATE') {
        borderColor = '#f59e0b';
        iconColor = '#f59e0b';
      } else if (level === 'ADVANCED') {
        borderColor = 'var(--accent-violet)';
        iconColor = 'var(--accent-violet)';
      }
      card.style.border = `2px solid ${borderColor}`;
      const icon = card.querySelector('.manual-card-icon');
      if (icon) {
        icon.className = 'ph ph-check-circle';
        icon.style.color = iconColor;
      }
      updateDeclaredLevelUI(level);
    });
  });

  // Step 2 Option A: Start Quiz Button (Generates Dynamic AI Quiz via Backend)
  const startQuizBtn = document.getElementById('start-diagnostic-quiz-btn');
  if (startQuizBtn) {
    startQuizBtn.addEventListener('click', async () => {
      const quizWrapper = document.getElementById('diagnostic-quiz-wrapper');

      const activeSession = supervisor.authAgent.getActiveSession();
      const currentUserId = (window.currentDraftProfile && window.currentDraftProfile.user_id) || (activeSession && activeSession.user_id) || 'guest';
      const chosenDomain = (window.currentDraftProfile && window.currentDraftProfile.chosen_domain) || (activeSession && activeSession.chosen_domain) || selectedDomainId || 'fullstack';

      startQuizBtn.disabled = true;
      startQuizBtn.innerHTML = `<i class="ph ph-circle-notch ph-spin"></i> Generating ${selectedQuestionCount} AI Questions...`;

      // Generate a fresh unique quizAttemptId for every new quiz attempt
      const quizAttemptId = `quiz_attempt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      window.currentQuizAttemptId = quizAttemptId;

      try {
        console.log(`[Frontend Quiz Gen] Requesting attempt ${quizAttemptId} (${selectedQuestionCount} questions) for domain ${chosenDomain} at level ${selectedSelfLevel}...`);
        const res = await fetch('http://localhost:5000/api/quiz/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            quizAttemptId: quizAttemptId,
            questionCount: selectedQuestionCount,
            domain: chosenDomain,
            level: selectedSelfLevel,
            forceNew: true
          })
        });

        const quizData = await res.json();
        if (!res.ok || !quizData || !Array.isArray(quizData.questions)) {
          throw new Error(quizData.error || 'Failed to generate dynamic quiz.');
        }

        console.log(`✅ [Frontend Quiz Gen] Received ${quizData.questions.length} questions from backend!`, quizData);

        // Render Quiz with backend-generated dynamic questions
        renderDiagnosticQuiz(chosenDomain, quizData.questions);

        if (quizWrapper) {
          quizWrapper.style.display = 'block';
          quizWrapper.scrollIntoView({ behavior: 'smooth' });
        }

      } catch (err) {
        console.error('Quiz Generation error:', err);
        alert('Assessment Generation Error: ' + err.message + '\n\nPlease click "Generate Quiz" to try again.');
        if (quizWrapper) {
          quizWrapper.style.display = 'none';
        }
      } finally {
        startQuizBtn.disabled = false;
        startQuizBtn.innerHTML = `<i class="ph ph-play"></i> Generate <span id="quiz-count-btn-label">${selectedQuestionCount}-Question</span> Quiz`;
      }
    });
  }

  // In-Quiz Skip Button
  const quizSkipBtn = document.getElementById('quiz-skip-btn');
  if (quizSkipBtn) {
    quizSkipBtn.addEventListener('click', () => {
      const submitBtn = document.getElementById('submit-self-assessment-btn');
      if (submitBtn) submitBtn.click();
    });
  }

  const submitSelfAssessmentBtn = document.getElementById('submit-self-assessment-btn');
  if (submitSelfAssessmentBtn) {
    submitSelfAssessmentBtn.addEventListener('click', async () => {
      if (!currentDiagnosticDomainObj) return;

      if (!window.currentDraftProfile) {
        const activeSession = supervisor.authAgent.getActiveSession();
        if (activeSession) {
          window.currentDraftProfile = {
            user_id: activeSession.user_id,
            name: activeSession.name,
            domainId: activeSession.chosen_domain,
            chosen_domain: activeSession.chosen_domain,
            timelineMonths: activeSession.timeline_months || 4,
            dailyHours: activeSession.daily_hours || 2.0
          };
        }
      }

      const checkedWeakTopics = [];
      document.querySelectorAll('.manual-weak-topic-cb:checked').forEach(cb => {
        if (cb.dataset.topic) checkedWeakTopics.push(cb.dataset.topic);
      });

      const selfAssessmentPayload = {
        isSelfAssessed: true,
        skillTier: selectedSelfLevel,
        skill_level: selectedSelfLevel,
        weakTopicNames: checkedWeakTopics,
        domainId: currentDiagnosticDomainObj.id,
        domain: currentDiagnosticDomainObj.name
      };

      const overlay = document.getElementById('roadmap-loading-overlay');
      if (overlay) overlay.style.display = 'flex';

      try {
        const evaluation = await supervisor.quizEvaluator.evaluateDiagnostic(
          currentDiagnosticDomainObj.id,
          selfAssessmentPayload,
          window.currentDraftProfile.user_id
        );

        window.activeQuizEvaluation = evaluation;

        if (overlay) overlay.style.display = 'none';

        renderAssessmentReport(evaluation);
        await fetchAndRenderPlanRecommendation(evaluation);
        updateHeaderStats();

        switchView('assessmentReport');
      } catch (err) {
        if (overlay) overlay.style.display = 'none';
        console.error('Error submitting self assessment:', err);
        alert('Error setting up assessment report: ' + err.message);
      }
    });
  }

  // =========================================================================
  // VIEW 3: ASSESSMENT REPORT & TOPIC PROFICIENCY
  // =========================================================================
  function renderAssessmentReport(evaluation, roadmap) {
    const scoreDisplay = document.getElementById('tier-score-display');
    const summaryDisplay = document.getElementById('tier-summary-text');
    const tierLabel = document.getElementById('tier-label-display');
    
    const skillTierVal = evaluation.skillTier || evaluation.skill_level || evaluation.skillLevel || 'BEGINNER';
    const scoreVal = evaluation.scorePct !== undefined ? evaluation.scorePct : (evaluation.score_pct !== undefined ? evaluation.score_pct : 0);
    const correctVal = evaluation.correctCount !== undefined ? evaluation.correctCount : (evaluation.correct_count !== undefined ? evaluation.correct_count : 0);
    const totalVal = evaluation.totalQuestions !== undefined ? evaluation.totalQuestions : (evaluation.total_questions !== undefined ? evaluation.total_questions : 0);
    const levelDesc = evaluation.levelDescription || evaluation.level_description || '';

    tierLabel.textContent = skillTierVal;
    tierLabel.className = `tier-label ${skillTierVal}`;

    const isSelf = !!(evaluation.isSelfAssessed || evaluation.is_self_assessed || evaluation.assessmentStatus === 'not_attempted' || evaluation.assessment_status === 'not_attempted');

    if (isSelf) {
      if (scoreDisplay) {
        scoreDisplay.textContent = 'SELF';
        scoreDisplay.style.fontSize = '1.3rem';
      }
      if (summaryDisplay) {
        summaryDisplay.textContent = `Baseline established via User Self-Assessment (${skillTierVal}). Dynamic roadmap configured to match declared proficiency. Diagnostic quiz not attempted.`;
      }
    } else {
      if (scoreDisplay) {
        scoreDisplay.textContent = `${scoreVal}%`;
        scoreDisplay.style.fontSize = '2rem';
      }
      if (summaryDisplay) {
        summaryDisplay.textContent = `Evaluated by Placify Quiz Performance Evaluator Agent. Score: ${scoreVal}%. Correct: ${correctVal}/${totalVal}. ${levelDesc}`;
      }
    }

    // WEAK Topics / Gaps
    const gapContainer = document.getElementById('gaps-list-container');
    const weakList = evaluation.weakTopics || evaluation.knowledgeGaps || [];
    document.getElementById('gap-count-num').textContent = weakList.length;

    if (isSelf) {
      gapContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">Diagnostic evaluation not attempted. No gaps evaluated.</div>`;
    } else if (weakList.length === 0) {
      gapContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--accent-emerald);">No critical knowledge gaps detected! Prerequisites satisfied.</div>`;
    } else {
      gapContainer.innerHTML = weakList.map(item => `
        <div class="gap-item" style="border-left: 3px solid var(--accent-rose);">
          <h4><i class="ph ph-warning"></i> ${item.topic} <span style="font-size: 0.75rem; background: rgba(239,68,68,0.15); color: #ef4444; padding: 0.2rem 0.5rem; border-radius: 4px; float: right;">WEAK (${item.score_pct !== undefined ? item.score_pct : (item.accuracy || 0)}%)</span></h4>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem;">
            ${item.reason || 'Needs targeted remedial practice.'}
          </div>
          ${item.weakConcepts && item.weakConcepts.length > 0 ? `
            <div style="font-size: 0.75rem; color: var(--accent-rose); margin-top: 0.2rem;">Weak concepts: ${item.weakConcepts.join(', ')}</div>
          ` : ''}
        </div>
      `).join('');
    }

    // INTERMEDIATE Topics
    const intermediateContainer = document.getElementById('intermediate-list-container');
    const intermediateList = evaluation.intermediateTopics || [];
    const interCountEl = document.getElementById('intermediate-count-num');
    if (interCountEl) interCountEl.textContent = intermediateList.length;

    if (intermediateContainer) {
      if (isSelf) {
        if (intermediateList.length > 0) {
          intermediateContainer.innerHTML = intermediateList.map(item => {
            const topicName = typeof item === 'string' ? item : (item.topic || item.skillName || item.skillId);
            const scoreLabel = item.score_pct !== undefined ? `${item.score_pct}%` : (item.status === 'active_target' ? 'DECLARED BASELINE' : 'ASSUMED');
            return `
              <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; margin-bottom: 0.5rem; font-size: 0.85rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong style="color: #f59e0b;"><i class="ph ph-chart-bar"></i> ${topicName}</strong>
                  <span style="font-size: 0.75rem; background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700;">INTERMEDIATE (${scoreLabel})</span>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">${item.reason || 'Declared starting level. Dynamic roadmap configured for active intermediate training.'}</div>
              </div>
            `;
          }).join('');
        } else {
          intermediateContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">Diagnostic evaluation not attempted.</div>`;
        }
      } else if (intermediateList.length === 0) {
        intermediateContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">No intermediate topics recorded.</div>`;
      } else {
        intermediateContainer.innerHTML = intermediateList.map(item => `
          <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; margin-bottom: 0.5rem; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: #f59e0b;"><i class="ph ph-chart-bar"></i> ${item.topic}</strong>
              <span style="font-size: 0.75rem; background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700;">INTERMEDIATE (${item.score_pct !== undefined ? item.score_pct : item.accuracy}%)</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">${item.reason || 'Solid applied foundation. Ready for guided project implementation.'}</div>
          </div>
        `).join('');
      }
    }

    // STRONG Topics / Mastered
    const masteredContainer = document.getElementById('mastered-list-container');
    const strongList = evaluation.strongTopics || evaluation.masteredTopics || [];
    const assumedPrereqs = evaluation.assumedMasteredPrerequisites || evaluation.assumed_mastered_prerequisites || evaluation.declaredLevelPrerequisites || [];

    if (masteredContainer) {
      if (isSelf) {
        if (assumedPrereqs.length > 0) {
          const countEl = document.getElementById('mastered-count-num');
          if (countEl) countEl.textContent = assumedPrereqs.length;
          masteredContainer.innerHTML = assumedPrereqs.map(item => {
            const topicName = typeof item === 'string' ? item : (item.topic || item.skillName || item.skillId);
            const itemReason = (typeof item === 'object' && item.reason) ? item.reason : `Strong — assumed from self-assessed ${skillTierVal} level`;
            return `
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; margin-bottom: 0.5rem; font-size: 0.85rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong style="color: var(--accent-emerald);"><i class="ph ph-check-circle"></i> ${topicName}</strong>
                  <span style="font-size: 0.75rem; background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700;">STRONG (ASSUMED)</span>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">${itemReason}</div>
              </div>
            `;
          }).join('');
        } else {
          const countEl = document.getElementById('mastered-count-num');
          if (countEl) countEl.textContent = '0';
          masteredContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">Starting at Beginning level. All foundational topics included in roadmap.</div>`;
        }
      } else if (strongList.length === 0) {
        const countEl = document.getElementById('mastered-count-num');
        if (countEl) countEl.textContent = '0';
        masteredContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">No topics marked as strong/mastered yet.</div>`;
      } else {
        const countEl = document.getElementById('mastered-count-num');
        if (countEl) countEl.textContent = strongList.length;
        masteredContainer.innerHTML = strongList.map(item => `
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; margin-bottom: 0.5rem; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: var(--accent-emerald);"><i class="ph ph-check-circle"></i> ${item.topic}</strong>
              <span style="font-size: 0.75rem; background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700;">STRONG (${item.score_pct !== undefined ? item.score_pct : (item.accuracy_pct || 100)}%)</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">Verified Prerequisite (Diagnostic Quiz). Ready for advanced topics.</div>
          </div>
        `).join('');
      }
    }

    // TOPIC PROFICIENCY TABLE
    const tableContainer = document.getElementById('topic-proficiency-table-container');
    if (tableContainer) {
      if (isSelf || !evaluation.topicEvaluations || evaluation.topicEvaluations.length === 0) {
        tableContainer.innerHTML = `
          <div style="font-size: 0.85rem; color: var(--text-muted); padding: 1.5rem; text-align: center; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm); border: 1px dashed rgba(255,255,255,0.1);">
            <i class="ph ph-info" style="font-size: 1.3rem; color: var(--accent-amber); margin-bottom: 0.3rem;"></i><br>
            Diagnostic quiz was not taken for this roadmap. Topic-wise proficiency breakdown is unavailable.
          </div>
        `;
      } else {
        tableContainer.innerHTML = `
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 0.5rem;">
            <thead>
              <tr style="background: rgba(255,255,255,0.06); text-align: left; border-bottom: 1px solid rgba(255,255,255,0.12);">
                <th style="padding: 0.7rem 0.8rem; color: var(--text-muted);">Topic</th>
                <th style="padding: 0.7rem 0.8rem; color: var(--text-muted);">Questions</th>
                <th style="padding: 0.7rem 0.8rem; color: var(--text-muted);">Accuracy</th>
                <th style="padding: 0.7rem 0.8rem; color: var(--text-muted);">Difficulty Breakdown (Beg / Int / Adv)</th>
                <th style="padding: 0.7rem 0.8rem; color: var(--text-muted);">Proficiency</th>
                <th style="padding: 0.7rem 0.8rem; color: var(--text-muted);">Evaluation Insight</th>
              </tr>
            </thead>
            <tbody>
              ${evaluation.topicEvaluations.map(t => {
                let badgeColor = 'var(--accent-rose)';
                let badgeBg = 'rgba(239, 68, 68, 0.15)';
                if (t.proficiencyLevel === 'STRONG' || t.proficiency_level === 'STRONG') {
                  badgeColor = 'var(--accent-emerald)';
                  badgeBg = 'rgba(16, 185, 129, 0.15)';
                } else if (t.proficiencyLevel === 'INTERMEDIATE' || t.proficiency_level === 'INTERMEDIATE') {
                  badgeColor = '#f59e0b';
                  badgeBg = 'rgba(245, 158, 11, 0.15)';
                }
                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.7rem 0.8rem; font-weight: 600;">${t.topic}</td>
                    <td style="padding: 0.7rem 0.8rem;">${t.correctAnswers !== undefined ? t.correctAnswers : (t.correct_count || 0)}/${t.totalQuestions !== undefined ? t.totalQuestions : (t.total_questions || 0)}</td>
                    <td style="padding: 0.7rem 0.8rem; font-weight: 700;">${t.accuracy !== undefined ? t.accuracy : (t.score_pct || 0)}%</td>
                    <td style="padding: 0.7rem 0.8rem; font-size: 0.8rem; color: var(--text-muted);">
                      Beg: <span style="color: #fff;">${t.beginnerAccuracy !== undefined ? t.beginnerAccuracy : 100}%</span> | 
                      Int: <span style="color: #fff;">${t.intermediateAccuracy !== undefined ? t.intermediateAccuracy : 100}%</span> | 
                      Adv: <span style="color: #fff;">${t.advancedAccuracy !== undefined ? t.advancedAccuracy : 0}%</span>
                    </td>
                    <td style="padding: 0.7rem 0.8rem;">
                      <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">${t.proficiencyLevel || t.proficiency_level || 'INTERMEDIATE'}</span>
                    </td>
                    <td style="padding: 0.7rem 0.8rem; font-size: 0.8rem; color: var(--text-muted);">${t.reason || 'Evaluated'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      }
    }
  }

  async function fetchAndRenderPlanRecommendation(evaluation) {
    const reasonEl = document.getElementById('plan-recommendation-reason');
    const recHoursEl = document.getElementById('rec-daily-hours-display');
    const recMonthsEl = document.getElementById('rec-timeline-months-display');
    const inputMonths = document.getElementById('plan-timeline-months');
    const inputHours = document.getElementById('plan-daily-hours');

    const domain = (window.currentDraftProfile && (window.currentDraftProfile.domainId || window.currentDraftProfile.chosen_domain)) || (currentDiagnosticDomainObj && currentDiagnosticDomainObj.id) || 'fullstack';
    const targetLevel = selectedSelfLevel || 'BEGINNER';
    const isSelf = !!(evaluation && (evaluation.isSelfAssessed || evaluation.is_self_assessed));

    try {
      const res = await fetch('http://localhost:5000/api/learning-plan/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          targetLevel,
          quizEvaluation: evaluation,
          is_self_assessed: isSelf
        })
      });
      const data = await res.json();
      if (res.ok && data) {
        if (reasonEl) reasonEl.textContent = data.reason || 'Based on your profile, we recommend the following learning plan:';
        if (recHoursEl) recHoursEl.textContent = `${data.recommended_daily_hours || 2.0} Hours / Day`;
        if (recMonthsEl) recMonthsEl.textContent = `${data.recommended_months || 4} Months`;
        if (inputMonths) inputMonths.value = data.recommended_months || 4;
        if (inputHours) inputHours.value = data.recommended_daily_hours || 2.0;
        return data;
      }
    } catch (e) {
      console.warn('[Recommendation API] fallback notice:', e.message);
    }

    // Client-side fallback if offline
    let fallbackMonths = 4;
    let fallbackHours = 2.0;
    let fallbackReason = 'Based on standard domain curriculum complexity, we recommend a 4-month preparation plan at 2.0 hours/day.';
    if (!isSelf && evaluation && typeof evaluation.score_pct === 'number') {
      if (evaluation.score_pct < 50) {
        fallbackMonths = 5;
        fallbackHours = 2.5;
        fallbackReason = `Based on your diagnostic score (${evaluation.score_pct}%), we recommend a 5-month preparation timeline at 2.5 hours/day to solidify fundamental topics.`;
      } else if (evaluation.score_pct >= 80) {
        fallbackMonths = 3;
        fallbackHours = 1.5;
        fallbackReason = `Based on your strong diagnostic score (${evaluation.score_pct}%), we recommend an accelerated 3-month timeline at 1.5 hours/day.`;
      }
    }
    if (reasonEl) reasonEl.textContent = fallbackReason;
    if (recHoursEl) recHoursEl.textContent = `${fallbackHours} Hours / Day`;
    if (recMonthsEl) recMonthsEl.textContent = `${fallbackMonths} Months`;
    if (inputMonths) inputMonths.value = fallbackMonths;
    if (inputHours) inputHours.value = fallbackHours;
  }

  // Build Personalized Roadmap Button (Fired after User Confirms / Edits Timeline & Daily Hours)
  const buildRoadmapBtn = document.getElementById('build-roadmap-btn');
  if (buildRoadmapBtn) {
    buildRoadmapBtn.addEventListener('click', async () => {
      const inputMonths = document.getElementById('plan-timeline-months');
      const inputHours = document.getElementById('plan-daily-hours');

      let finalMonths = parseInt(inputMonths ? inputMonths.value : 4, 10);
      let finalHours = parseFloat(inputHours ? inputHours.value : 2.0);

      if (isNaN(finalMonths) || finalMonths < 1) finalMonths = 4;
      if (isNaN(finalHours) || finalHours <= 0) finalHours = 2.0;

      if (!window.currentDraftProfile) {
        const activeSession = supervisor.authAgent.getActiveSession();
        if (activeSession) {
          window.currentDraftProfile = {
            user_id: activeSession.user_id,
            name: activeSession.name,
            domainId: activeSession.chosen_domain,
            chosen_domain: activeSession.chosen_domain
          };
        }
      }

      if (window.currentDraftProfile) {
        window.currentDraftProfile.timelineMonths = finalMonths;
        window.currentDraftProfile.dailyHours = finalHours;
      }

      const overlay = document.getElementById('roadmap-loading-overlay');
      if (overlay) overlay.style.display = 'flex';

      try {
        const evalToUse = window.activeQuizEvaluation || { is_self_assessed: true, skill_level: selectedSelfLevel };
        const result = await supervisor.generatePersonalizedRoadmap(
          window.currentDraftProfile,
          evalToUse,
          { timeline_months: finalMonths, daily_hours: finalHours }
        );

        if (overlay) overlay.style.display = 'none';

        if (result && result.personalizedRoadmap) {
          await renderRoadmapView(result.personalizedRoadmap);
          updateHeaderStats();
          switchView('roadmap');
        }
      } catch (err) {
        if (overlay) overlay.style.display = 'none';
        console.error('Error building roadmap:', err);
        alert('Error generating roadmap: ' + err.message);
      }
    });
  }


  // =========================================================================
  // VIEW 4: PERSONALIZED DYNAMIC ROADMAP VISUALIZATION (3-LEVEL HIERARCHY)
  // =========================================================================
  let currentSelectedMonthObj = null;
  let currentSelectedWeekObj = null;
  let isStartingJourney = false;

  // =========================================================================
  // CALENDAR DATE & JOURNEY PROGRESSION HELPERS
  // =========================================================================
  function addDaysToDate(dateInput, daysToAdd) {
    const d = new Date(dateInput);
    d.setDate(d.getDate() + daysToAdd);
    return d;
  }

  function formatDateLong(dateInput) {
    const d = new Date(dateInput);
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-US', options);
  }

  function formatDateShort(dateInput) {
    const d = new Date(dateInput);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-US', options);
  }

  function formatDateRange(startDateInput, endDateInput) {
    const s = new Date(startDateInput);
    const e = new Date(endDateInput);
    const sMonth = s.toLocaleDateString('en-US', { month: 'short' });
    const eMonth = e.toLocaleDateString('en-US', { month: 'short' });
    const sYear = s.getFullYear();
    const eYear = e.getFullYear();

    if (sYear === eYear && sMonth === eMonth) {
      return `${sMonth} ${s.getDate()} – ${e.getDate()}, ${sYear}`;
    } else if (sYear === eYear) {
      return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${sYear}`;
    } else {
      return `${sMonth} ${s.getDate()}, ${sYear} – ${eMonth} ${e.getDate()}, ${eYear}`;
    }
  }

  function isSameCalendarDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    const cleanStr = String(dateStr).split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
    return new Date(dateStr);
  }

  function isDayCompleted(day) {
    if (!day) return false;
    if (day.completed === true) return true;
    if (day.assessment) {
      if (day.assessment.status === 'completed' || day.assessment.assessmentStatus === 'completed') return true;
      if (day.assessment.completedManually === true) return true;
    }
    return false;
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderQuizQuestionCardHTML(q, idx) {
    const hasOptions = Array.isArray(q.options) && q.options.length > 0;
    const isCodeOrPre = hasOptions && q.options.some(opt => typeof opt === 'string' && (opt.includes('\n') || opt.includes('  ') || opt.length > 25));

    return `
      <div class="quiz-question-card" data-cqid="${q.id}" style="margin-bottom: 1.2rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 1rem; border-radius: 8px;">
        <div class="quiz-question-title" style="font-weight: 700; color: #fff; margin-bottom: 0.6rem; display: flex; align-items: flex-start; gap: 0.6rem;">
          <span class="question-badge" style="background: var(--accent-cyan); color: #000; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.78rem;">Q${idx + 1}</span>
          <span>${escapeHTML(q.question)}</span>
        </div>
        ${q.codeSnippet ? `<pre style="background: rgba(0,0,0,0.5); padding: 0.8rem; border-radius: 6px; color: var(--accent-cyan); font-family: monospace; font-size: 0.84rem; margin: 0.6rem 0; white-space: pre-wrap; word-break: break-word; overflow-x: auto;"><code>${escapeHTML(q.codeSnippet)}</code></pre>` : ''}
        <div class="quiz-options" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.6rem;">
          ${hasOptions ? q.options.map((opt, oIdx) => `
            <div class="option-btn" data-cqid="${q.id}" data-coidx="${oIdx}" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 0.9rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; color: #e2e8f0; font-size: 0.88rem; transition: all 0.2s ease; white-space: pre-wrap; word-break: break-word; ${isCodeOrPre ? 'font-family: monospace; font-size: 0.84rem;' : ''}">
              <i class="ph ph-circle"></i> <span>${escapeHTML(opt)}</span>
            </div>
          `).join('') : `
            <div class="quiz-text-input-box" style="margin-top: 0.4rem;">
              <input type="text" class="quiz-text-input" data-cqid="${q.id}" placeholder="Type your answer here..." style="width: 100%; padding: 0.75rem 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.18); background: rgba(0,0,0,0.4); color: #fff; font-size: 0.9rem;" />
            </div>
          `}
        </div>
      </div>
    `;
  }

  function addDaysToLocalDate(dateInput, daysToAdd) {
    const dt = parseLocalDate(dateInput);
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + daysToAdd);
  }

  function getCalendarDateDetails(startDateInput, dayOffset = 0) {
    const dt = addDaysToLocalDate(startDateInput, dayOffset);
    const year = dt.getFullYear();
    const monthNum = dt.getMonth() + 1;
    const monthName = dt.toLocaleString('en-US', { month: 'long' });
    const shortMonth = dt.toLocaleString('en-US', { month: 'short' });
    const dayOfMonth = dt.getDate();
    const dayOfWeek = dt.toLocaleString('en-US', { weekday: 'long' });
    const shortDayOfWeek = dt.toLocaleString('en-US', { weekday: 'short' });
    const calendarDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

    return {
      calendarDate,
      year,
      month: monthName,
      shortMonth,
      monthNum,
      dayOfMonth,
      dayOfWeek,
      shortDayOfWeek,
      formattedDateStr: `${dayOfWeek}, ${monthName} ${dayOfMonth}, ${year}`,
      shortDateStr: `${shortMonth} ${dayOfMonth} — ${shortDayOfWeek}`,
      dateObj: dt
    };
  }

  function enrichRoadmapWithCalendarDates(roadmap) {
    if (!roadmap || !Array.isArray(roadmap.monthly_roadmap)) return roadmap;
    const activeSession = supervisor.authAgent.getActiveSession();
    const startDateInput = roadmap.journey_start_date || (activeSession ? activeSession.journey_start_date : null) || getDeviceLocalDate();

    let overallDayIndex = 0;

    roadmap.monthly_roadmap.forEach((m) => {
      let monthStartDetails = null;
      let monthEndDetails = null;

      if (Array.isArray(m.weeks)) {
        m.weeks.forEach((w) => {
          let weekStartDetails = null;
          let weekEndDetails = null;

          if (Array.isArray(w.days)) {
            w.days.forEach((d) => {
              const dNum = parseInt(d.day_number, 10) || (overallDayIndex + 1);
              const dateDetails = getCalendarDateDetails(startDateInput, dNum - 1);

              d.calendarDate = dateDetails.calendarDate;
              d.year = dateDetails.year;
              d.month = dateDetails.month;
              d.dayOfMonth = dateDetails.dayOfMonth;
              d.dayOfWeek = dateDetails.dayOfWeek;
              d.shortDateStr = dateDetails.shortDateStr;
              d.formattedDateStr = dateDetails.formattedDateStr;

              if (dateDetails.dayOfWeek === 'Sunday') {
                d.isSundayRevision = true;
                if (!d.topic || !d.topic.toLowerCase().includes('sunday')) {
                  d.topic = `Sunday Weekly Revision (${d.topic || 'Weekly Review'})`;
                }
              } else {
                d.isSundayRevision = false;
              }

              if (!weekStartDetails) weekStartDetails = dateDetails;
              weekEndDetails = dateDetails;

              if (!monthStartDetails) monthStartDetails = dateDetails;
              monthEndDetails = dateDetails;

              overallDayIndex++;
            });
          }

          if (weekStartDetails && weekEndDetails) {
            w.startDate = weekStartDetails.calendarDate;
            w.endDate = weekEndDetails.calendarDate;
            w.formattedRange = `${weekStartDetails.shortMonth} ${weekStartDetails.dayOfMonth} – ${weekEndDetails.shortMonth} ${weekEndDetails.dayOfMonth}, ${weekEndDetails.year}`;
          }
        });
      }

      if (monthStartDetails) {
        m.calendarMonth = `${monthStartDetails.month} ${monthStartDetails.year}`;
        m.formattedMonthTitle = `Month ${m.month_number} — ${monthStartDetails.month} ${monthStartDetails.year}`;
      }
    });

    return roadmap;
  }

  function getDeviceLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getNextDeviceLocalDate() {
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const y = nextDate.getFullYear();
    const m = String(nextDate.getMonth() + 1).padStart(2, '0');
    const d = String(nextDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getUpcomingSundayDate(dateInput) {
    if (!dateInput) return null;
    const dt = parseLocalDate(dateInput);
    const dayOfWeek = dt.getDay(); // 0 = Sunday, 1 = Mon, ..., 6 = Sat
    const daysUntilSunday = (dayOfWeek === 0) ? 0 : (7 - dayOfWeek);
    const sundayDt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + daysUntilSunday);
    const y = sundayDt.getFullYear();
    const m = String(sundayDt.getMonth() + 1).padStart(2, '0');
    const d = String(sundayDt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function calculateClientSundayRevision(weekObj, sundayDayObj) {
    const DAILY_REVISION_THRESHOLD = 70;
    const roadmap = window.activePersonalizedRoadmap;
    if (!weekObj || !Array.isArray(weekObj.days)) {
      return { day: "Sunday", weekNumber: weekObj ? weekObj.week_number : 1, topics: [], hasQuizRevisions: false, message: "No quiz-based revision items for this week." };
    }

    const targetSundayDateStr = sundayDayObj && sundayDayObj.calendarDate
      ? sundayDayObj.calendarDate
      : (weekObj.days[0]?.calendarDate ? getUpcomingSundayDate(weekObj.days[0].calendarDate) : null);

    const weakTopicMap = new Map();
    let quizCountInWeek = 0;

    const daysToScan = (roadmap && Array.isArray(roadmap.monthly_roadmap))
      ? roadmap.monthly_roadmap.flatMap(m => (m.weeks || []).flatMap(w => w.days || []))
      : weekObj.days;

    daysToScan.forEach(day => {
      const dCalDate = day.calendarDate || (day.day_number ? getDayScheduledLocalDate(roadmap ? roadmap.journey_start_date : null, day.day_number) : null);
      if (!dCalDate) return;

      const upcomingSunday = getUpcomingSundayDate(dCalDate);
      const isSundaySelf = (day.dayOfWeek === 'Sunday') || (dCalDate && parseLocalDate(dCalDate).getDay() === 0);

      if (targetSundayDateStr) {
        if (upcomingSunday !== targetSundayDateStr || isSundaySelf) return;
      } else if (isSundaySelf) {
        return;
      }

      const ass = day.assessment;
      if (ass && ass.assessmentMode === 'quiz' && (ass.assessmentStatus === 'completed' || ass.status === 'completed')) {
        quizCountInWeek++;

        if (Array.isArray(ass.topicResults) && ass.topicResults.length > 0) {
          ass.topicResults.forEach(tr => {
            const tName = tr.topic || day.topic || 'Core Concept';
            const tScore = tr.score !== undefined && tr.score !== null ? tr.score : (ass.score || 0);
            if (tScore < DAILY_REVISION_THRESHOLD || tr.needsRevision) {
              if (weakTopicMap.has(tName)) {
                const existing = weakTopicMap.get(tName);
                existing.count += 1;
                existing.lowestScore = Math.min(existing.lowestScore, tScore);
              } else {
                weakTopicMap.set(tName, {
                  topic: tName,
                  score: tScore,
                  lowestScore: tScore,
                  reason: `Daily quiz score ${tScore}%`,
                  source: 'quiz',
                  count: 1
                });
              }
            }
          });
        } else {
          const score = ass.score !== undefined && ass.score !== null ? ass.score : 0;
          if (score < DAILY_REVISION_THRESHOLD || ass.needsRevision) {
            const topicsToAdd = (Array.isArray(ass.weakTopics) && ass.weakTopics.length > 0) ? ass.weakTopics : [day.topic || 'Core Concept'];
            topicsToAdd.forEach(tName => {
              if (weakTopicMap.has(tName)) {
                const existing = weakTopicMap.get(tName);
                existing.count += 1;
                existing.lowestScore = Math.min(existing.lowestScore, score);
              } else {
                weakTopicMap.set(tName, {
                  topic: tName,
                  score: score,
                  lowestScore: score,
                  reason: `Daily quiz score ${score}%`,
                  source: 'quiz',
                  count: 1
                });
              }
            });
          }
        }
      }
    });

    const topics = [];
    weakTopicMap.forEach((val) => {
      let priority = 'LOWER';
      if (val.lowestScore < 40 || val.count >= 2) priority = 'VERY HIGH';
      else if (val.lowestScore < 50) priority = 'HIGH';
      else if (val.lowestScore < 60) priority = 'MEDIUM';
      else priority = 'LOWER';

      topics.push({
        topic: val.topic,
        reason: val.count > 1 ? `Repeated weak performance (${val.count}x, lowest ${val.lowestScore}%)` : val.reason,
        source: 'quiz',
        score: val.lowestScore,
        priority,
        occurrences: val.count
      });
    });

    const priorityRank = { 'VERY HIGH': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOWER': 1 };
    topics.sort((a, b) => {
      if (priorityRank[b.priority] !== priorityRank[a.priority]) {
        return priorityRank[b.priority] - priorityRank[a.priority];
      }
      return a.score - b.score;
    });

    let message = "No quiz-based revision items for this week.";
    if (topics.length > 0) {
      message = `Weekly Revision: ${topics.length} topic(s) need review based on quiz performance.`;
    } else if (quizCountInWeek > 0) {
      message = "Great work! No quiz-based revisions required this week.";
    }

    return {
      day: "Sunday",
      weekNumber: weekObj.week_number,
      sundayDate: targetSundayDateStr,
      topics,
      hasQuizRevisions: topics.length > 0,
      quizCountInWeek,
      message
    };
  }

  function getDeviceTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    } catch(e) {
      return 'Asia/Kolkata';
    }
  }

  function getDayScheduledLocalDate(journeyStartDateStr, dayNumber) {
    const baseDate = journeyStartDateStr || getDeviceLocalDate();
    const dayOffset = parseInt(dayNumber, 10) - 1;
    const details = getCalendarDateDetails(baseDate, dayOffset);
    return details ? details.calendarDate : null;
  }

  function evaluateDayStatus(roadmap, dayObj) {
    if (!dayObj) return 'TODAY_ACTIVE';
    const todayLocal = getDeviceLocalDate();

    const isDone = dayObj.completed || dayObj.completedManually ||
      (dayObj.assessment && (
        dayObj.assessment.completionStatus === 'completed' ||
        dayObj.assessment.assessmentStatus === 'completed' ||
        dayObj.assessment.status === 'completed' ||
        dayObj.assessment.completedManually
      ));

    if (isDone) {
      const compDate = dayObj.completedDateLocal || (dayObj.assessment ? dayObj.assessment.completedDateLocal : null);
      if (compDate === todayLocal) {
        return 'TODAY_COMPLETED';
      }
      return 'COMPLETED';
    }

    // Locking system disabled for testing - all uncompleted days are active
    return 'TODAY_ACTIVE';
  }

  function getActiveOrTodayDaySpec(roadmap) {
    if (!roadmap || !Array.isArray(roadmap.monthly_roadmap)) {
      return { month: 1, week: 1, day: 1 };
    }

    let todayCompletedSpec = null;
    let todayActiveSpec = null;
    let firstIncompleteSpec = null;

    for (const m of roadmap.monthly_roadmap) {
      if (Array.isArray(m.weeks)) {
        for (const w of m.weeks) {
          if (Array.isArray(w.days)) {
            for (const d of w.days) {
              const status = evaluateDayStatus(roadmap, d);
              const spec = {
                roadmapId: roadmap.roadmap_id || roadmap._id || roadmap.id || '',
                month: m.month_number,
                week: w.week_number,
                day: d.day_number,
                dayId: d.id || d.day_id || ''
              };
              if (status === 'TODAY_COMPLETED' && !todayCompletedSpec) {
                todayCompletedSpec = spec;
              } else if (status === 'TODAY_ACTIVE' && !todayActiveSpec) {
                todayActiveSpec = spec;
              } else if (status !== 'COMPLETED' && status !== 'TODAY_COMPLETED' && !firstIncompleteSpec) {
                firstIncompleteSpec = spec;
              }
            }
          }
        }
      }
    }

    if (todayCompletedSpec) return todayCompletedSpec;
    if (todayActiveSpec) return todayActiveSpec;
    if (firstIncompleteSpec) return firstIncompleteSpec;
    return { month: 1, week: 1, day: 1 };
  }

  function getFirstUncompletedDaySpec(roadmap) {
    return getActiveOrTodayDaySpec(roadmap);
  }

  function getNextDaySpec(roadmap, currentDayNum) {
    const targetDayNum = parseInt(currentDayNum, 10) + 1;
    if (roadmap && Array.isArray(roadmap.monthly_roadmap)) {
      for (const month of roadmap.monthly_roadmap) {
        if (Array.isArray(month.weeks)) {
          for (const week of month.weeks) {
            if (Array.isArray(week.days)) {
              for (const day of week.days) {
                if (parseInt(day.day_number, 10) === targetDayNum) {
                  return {
                    roadmapId: roadmap.roadmap_id || roadmap._id || roadmap.id || '',
                    month: month.month_number,
                    week: week.week_number,
                    day: day.day_number,
                    dayId: day.id || day.day_id || ''
                  };
                }
              }
            }
          }
        }
      }
    }
    return { day: targetDayNum };
  }

  function setupMidnightAndVisibilityListeners() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && window.activePersonalizedRoadmap) {
        const state = supervisor.progressTracker.getUserState();
        if (state && state.personalizedRoadmap) {
          renderRoadmapView(state.personalizedRoadmap);
        }
      }
    });
    window.addEventListener('focus', () => {
      if (window.activePersonalizedRoadmap) {
        const state = supervisor.progressTracker.getUserState();
        if (state && state.personalizedRoadmap) {
          renderRoadmapView(state.personalizedRoadmap);
        }
      }
    });

    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const msUntilMidnight = midnight.getTime() - now.getTime();
    setTimeout(() => {
      console.log('[LOCAL MIDNIGHT REACHED] Triggering local date refresh for next day unlock...');
      if (window.activePersonalizedRoadmap) {
        renderRoadmapView(window.activePersonalizedRoadmap);
      }
      setupMidnightAndVisibilityListeners();
    }, Math.max(1000, msUntilMidnight));
  }

  setupMidnightAndVisibilityListeners();

  // =========================================================================
  // VIEW 4: PERSONALIZED DYNAMIC ROADMAP VISUALIZATION (3-LEVEL HIERARCHY)
  // =========================================================================
  async function renderRoadmapView(roadmapData) {
    let roadmap = roadmapData;
    const activeSession = supervisor.authAgent.getActiveSession();
    const userId = activeSession ? activeSession.user_id : (window.currentDraftProfile ? window.currentDraftProfile.user_id : null);

    if (!roadmap && userId) {
      try {
        const res = await fetch(`http://localhost:5000/api/roadmap/user/${userId}`);
        const json = await res.json();
        if (json.success && json.roadmap) {
          roadmap = json.roadmap;
        }
      } catch (err) {
        console.warn('Could not fetch server roadmap:', err);
      }
    }

    if (!roadmap) {
      const state = supervisor.progressTracker.getUserState();
      roadmap = state.personalizedRoadmap;
    }

    if (!roadmap) {
      document.getElementById('roadmap-nodes-container').innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <i class="ph ph-warning-circle" style="font-size: 2.5rem; color: var(--accent-amber); margin-bottom: 0.8rem;"></i>
          <h3>No Active Roadmap Found</h3>
          <p style="font-size: 0.9rem; margin-top: 0.4rem;">Complete the diagnostic quiz or click <strong>Regenerate Roadmap</strong> to generate your personalized learning plan.</p>
        </div>
      `;
      return;
    }

    enrichRoadmapWithCalendarDates(roadmap);
    window.activePersonalizedRoadmap = roadmap;

    // Check journey started status
    const journeyStarted = roadmap.journey_started || (activeSession && activeSession.journey_started);
    const journeyStartDate = roadmap.journey_start_date || (activeSession && activeSession.journey_start_date);

    const bannerEl = document.getElementById('start-journey-banner');
    if (bannerEl) {
      if (!journeyStarted) {
        bannerEl.style.display = 'flex';
        const startBtn = document.getElementById('start-journey-btn');
        if (startBtn) {
          // Explicitly sync UI with initial isStartingJourney state (false on initial render)
          if (isStartingJourney) {
            startBtn.disabled = true;
            startBtn.innerHTML = `<i class="ph ph-spinner spinner"></i> Starting...`;
          } else {
            startBtn.disabled = false;
            startBtn.innerHTML = `<i class="ph ph-rocket-launch"></i> Start My Journey`;
          }

          startBtn.onclick = async () => {
            if (isStartingJourney) return;
            isStartingJourney = true;
            startBtn.disabled = true;
            startBtn.innerHTML = `<i class="ph ph-spinner spinner"></i> Starting...`;

            try {
              const clientSystemDate = new Date().toISOString();
              const clientLocalDate = getDeviceLocalDate();
              const timezone = getDeviceTimezone();
              const res = await fetch('http://localhost:5000/api/roadmap/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: userId,
                  start_date: clientSystemDate,
                  start_date_local: clientLocalDate,
                  timezone: timezone
                })
              });
              const data = await res.json();
              if (data.success) {
                roadmap.journey_started = true;
                roadmap.journey_start_date = data.journey_start_date || clientLocalDate;
                enrichRoadmapWithCalendarDates(roadmap);
                if (activeSession) {
                  activeSession.journey_started = true;
                  activeSession.journey_start_date = data.journey_start_date || clientLocalDate;
                  supervisor.authAgent.setActiveSession(activeSession);
                }
                const state = supervisor.progressTracker.getUserState();
                state.personalizedRoadmap = roadmap;
                supervisor.progressTracker.saveUserState(state);
                isStartingJourney = false;
                renderRoadmapView(roadmap);
              } else {
                alert(data.error || 'Failed to start journey.');
              }
            } catch (err) {
              console.error('Error starting journey:', err);
              alert('Error starting journey: ' + err.message);
            } finally {
              isStartingJourney = false;
              if (!roadmap.journey_started && startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = `<i class="ph ph-rocket-launch"></i> Start My Journey`;
              }
            }
          };
        }
      } else {
        bannerEl.style.display = 'none';
      }
    }

    const domainTag = document.getElementById('roadmap-domain-tag');
    if (domainTag) domainTag.textContent = roadmap.domain_id || 'DOM';
    
    document.getElementById('rm-summary-domain').textContent = roadmap.domain || 'Full-Stack Web Development';

    const langContainer = document.getElementById('rm-summary-lang-container');
    const langEl = document.getElementById('rm-summary-lang');
    const dsaLang = roadmap.dsa_programming_language || roadmap.dsaProgrammingLanguage || (window.currentDraftProfile && window.currentDraftProfile.dsa_programming_language);
    if (isDSADomain(roadmap.domain || roadmap.domainId) && langContainer && langEl) {
      langContainer.style.display = 'block';
      langEl.textContent = dsaLang || 'Python';
    } else if (langContainer) {
      langContainer.style.display = 'none';
    }

    document.getElementById('rm-summary-timeline').textContent = `${roadmap.timeline_months || 4} Months`;
    document.getElementById('rm-summary-hours').textContent = `${roadmap.daily_hours || 2.0} Hours / Day`;
    
    // Diagnostic Score Resolution: Quiz mode displays percentage score, Direct mode displays Unassessed
    const isDirectRoadmap = (roadmap && roadmap.generation_mode === 'direct') || (roadmap && (roadmap.quiz_score === null || roadmap.quiz_score === undefined));
    let rawScoreVal = null;
    if (!isDirectRoadmap && roadmap && roadmap.quiz_score !== null && roadmap.quiz_score !== undefined) {
      rawScoreVal = roadmap.quiz_score;
    }

    function formatScoreValue(val) {
      if (val === null || val === undefined) return 'Unassessed';
      if (typeof val === 'number') {
        if (val >= 0 && val <= 1) {
          return `${Math.round(val * 100)}%`;
        }
        return `${Math.round(val)}%`;
      }
      if (typeof val === 'string') {
        const clean = val.trim().replace(/%+$/, '');
        const num = parseFloat(clean);
        if (!isNaN(num)) {
          return formatScoreValue(num);
        }
        return val;
      }
      return 'Unassessed';
    }

    let scoreDisplay = formatScoreValue(rawScoreVal);
    if (journeyStarted && journeyStartDate) {
      scoreDisplay += ` • 🚀 Started: ${formatDateShort(journeyStartDate)}`;
    }
    document.getElementById('rm-summary-score').textContent = scoreDisplay;

    renderMonthlyView(roadmap);
  }

  function renderMonthlyView(roadmap) {
    currentSelectedMonthObj = null;
    currentSelectedWeekObj = null;

    document.getElementById('roadmap-level-indicator').textContent = 'Level 1: Monthly Roadmap';
    const navMonths = document.getElementById('nav-level-months');
    const navWeeks = document.getElementById('nav-level-weeks');
    const navDays = document.getElementById('nav-level-days');

    navMonths.classList.add('active');
    navWeeks.classList.remove('active');
    navWeeks.disabled = true;
    navDays.classList.remove('active');
    navDays.disabled = true;

    const container = document.getElementById('roadmap-nodes-container');
    const monthlyList = roadmap.monthly_roadmap || [];
    if (!container) return;
    if (monthlyList.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 3rem;">No personalized roadmap data available. Please generate your roadmap.</div>`;
      return;
    }

    const isStarted = (roadmap.journey_started || (supervisor.authAgent.getActiveSession() && supervisor.authAgent.getActiveSession().journey_started)) && (roadmap.journey_start_date || (supervisor.authAgent.getActiveSession() && supervisor.authAgent.getActiveSession().journey_start_date));
    const startDate = roadmap.journey_start_date || (supervisor.authAgent.getActiveSession() ? supervisor.authAgent.getActiveSession().journey_start_date : null);

    container.innerHTML = monthlyList.map((m, idx) => {
      let priorityColor = 'var(--accent-cyan)';
      if (m.priority === 'HIGH') priorityColor = 'var(--accent-rose)';
      else if (m.priority === 'MEDIUM') priorityColor = '#f59e0b';

      const monthStartDate = isStarted && startDate ? addDaysToDate(startDate, (m.month_number - 1) * 28) : null;
      const monthEndDate = isStarted && startDate ? addDaysToDate(startDate, m.month_number * 28 - 1) : null;
      const monthBadgeText = m.formattedMonthTitle || (m.calendarMonth ? `Month ${m.month_number} — ${m.calendarMonth}` : `Month ${m.month_number}`);
      const dateRangeBadge = m.formattedMonthTitle || (monthStartDate && monthEndDate ? formatDateRange(monthStartDate, monthEndDate) : '');

      return `
        <div class="glass-card month-card" data-midx="${idx}" style="margin-bottom: 1.2rem; border-left: 4px solid ${priorityColor}; cursor: pointer; transition: transform 0.2s, border-color 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.6rem;">
            <div>
              <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.3rem; flex-wrap: wrap;">
                <span class="node-tag ${m.priority === 'HIGH' ? 'REMEDIAL' : 'STANDARD'}">${monthBadgeText}</span>
                <span class="tier-badge ${m.difficulty || 'INTERMEDIATE'}">${m.difficulty || 'INTERMEDIATE'}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${m.weeks ? m.weeks.length : 4} Weeks</span>
                ${dateRangeBadge ? `
                  <span style="font-size: 0.78rem; font-weight: 700; color: var(--accent-cyan); background: rgba(6, 182, 212, 0.12); padding: 0.15rem 0.6rem; border-radius: 4px;">
                    📅 ${dateRangeBadge}
                  </span>
                ` : ''}
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 700; color: #fff; margin: 0.3rem 0;">${m.title}</h3>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.6rem; line-height: 1.4;">${m.objective}</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.9rem; font-weight: 700; color: var(--accent-cyan);">${m.estimated_hours} Hours</div>
              <button class="btn btn-secondary btn-view-weeks" data-midx="${idx}" style="font-size: 0.78rem; padding: 0.3rem 0.7rem; margin-top: 0.5rem;">
                Explore Weeks <i class="ph ph-arrow-right"></i>
              </button>
            </div>
          </div>

          <div style="margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 0.6rem; flex-wrap: wrap;">
            ${(m.topics || []).map(t => `<span style="font-size: 0.75rem; background: rgba(255,255,255,0.06); color: var(--accent-emerald); padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 600;">📌 ${t}</span>`).join('')}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.month-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const midx = parseInt(card.dataset.midx, 10);
        const monthObj = monthlyList[midx];
        if (monthObj) {
          renderWeeklyView(roadmap, monthObj);
        }
      });
    });
  }

  function renderWeeklyView(roadmap, monthObj) {
    currentSelectedMonthObj = monthObj;
    currentSelectedWeekObj = null;

    document.getElementById('roadmap-level-indicator').textContent = `Level 2: Month ${monthObj.month_number} Weekly Roadmap`;
    const navMonths = document.getElementById('nav-level-months');
    const navWeeks = document.getElementById('nav-level-weeks');
    const navDays = document.getElementById('nav-level-days');

    navMonths.classList.remove('active');
    navWeeks.classList.add('active');
    navWeeks.disabled = false;
    navWeeks.textContent = `Month ${monthObj.month_number} Weeks`;
    navDays.classList.remove('active');
    navDays.disabled = true;

    const container = document.getElementById('roadmap-nodes-container');
    const weeklyList = monthObj.weeks || [];

    if (weeklyList.length === 0) {
      container.innerHTML = `<div style="padding: 2rem; color: var(--text-muted);">No weeks found for Month ${monthObj.month_number}.</div>`;
      return;
    }

    const isStarted = (roadmap.journey_started || (supervisor.authAgent.getActiveSession() && supervisor.authAgent.getActiveSession().journey_started)) && (roadmap.journey_start_date || (supervisor.authAgent.getActiveSession() && supervisor.authAgent.getActiveSession().journey_start_date));
    const startDate = roadmap.journey_start_date || (supervisor.authAgent.getActiveSession() ? supervisor.authAgent.getActiveSession().journey_start_date : null);

    container.innerHTML = `
      <div style="margin-bottom: 1rem; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); padding: 0.8rem 1rem; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem;">
        <div>
          <strong style="color: var(--accent-violet);">Parent Month ${monthObj.month_number}:</strong> ${monthObj.title}
        </div>
        <button id="back-to-months-btn" class="btn btn-secondary" style="font-size: 0.78rem; padding: 0.3rem 0.6rem;">
          <i class="ph ph-arrow-left"></i> Back to Monthly View
        </button>
      </div>

      ${weeklyList.map((w, idx) => {
        const weekStartDate = isStarted && startDate ? addDaysToDate(startDate, (w.week_number - 1) * 7) : null;
        const weekEndDate = isStarted && startDate ? addDaysToDate(startDate, w.week_number * 7 - 1) : null;
        const weekRangeStr = w.formattedRange || (weekStartDate && weekEndDate ? formatDateRange(weekStartDate, weekEndDate) : '');

        return `
          <div class="glass-card week-card" data-widx="${idx}" style="margin-bottom: 1rem; cursor: pointer; border-left: 4px solid var(--accent-violet);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.6rem;">
              <div>
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.3rem; flex-wrap: wrap;">
                  <span class="node-tag STANDARD">Week ${w.week_number}</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">${w.days ? w.days.length : 7} Days</span>
                  ${weekRangeStr ? `
                    <span style="font-size: 0.78rem; font-weight: 700; color: var(--accent-violet); background: rgba(139, 92, 246, 0.15); padding: 0.15rem 0.6rem; border-radius: 4px;">
                      📅 ${weekRangeStr}
                    </span>
                  ` : ''}
                </div>
                <h4 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin: 0.2rem 0;">${w.title}</h4>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.5rem;">${w.objective}</p>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent-cyan);">${w.estimated_hours} Hours</div>
                <button class="btn btn-secondary btn-view-days" data-widx="${idx}" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; margin-top: 0.4rem;">
                  View Day Tasks <i class="ph ph-caret-right"></i>
                </button>
              </div>
            </div>

            <div style="margin-top: 0.6rem; display: flex; gap: 0.4rem; flex-wrap: wrap;">
              ${(w.days || []).map(d => `<span style="font-size: 0.72rem; background: rgba(255,255,255,0.06); color: ${d.isSundayRevision ? 'var(--accent-amber)' : 'var(--text-muted)'}; padding: 0.15rem 0.5rem; border-radius: 4px;">📅 ${d.shortDateStr || ('Day ' + d.day_number)}</span>`).join('')}
            </div>

            <div style="margin-top: 0.6rem; font-size: 0.8rem; color: var(--text-muted); display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.6rem; border-radius: 6px;">
              <div><strong>Practice Focus:</strong> ${w.practice || 'Coding drills'}</div>
              <div><strong>Revision Focus:</strong> ${w.revision || 'Concept recap'}</div>
              <div><strong>Assessment:</strong> ${w.assessment || 'Weekly quiz'}</div>
            </div>
          </div>
        `;
      }).join('')}
    `;

    document.getElementById('back-to-months-btn').addEventListener('click', () => {
      renderMonthlyView(roadmap);
    });

    container.querySelectorAll('.week-card').forEach(card => {
      card.addEventListener('click', () => {
        const widx = parseInt(card.dataset.widx, 10);
        const weekObj = weeklyList[widx];
        if (weekObj) {
          renderDayView(roadmap, monthObj, weekObj);
        }
      });
    });
  }

  function renderDayView(roadmap, monthObj, weekObj) {
    currentSelectedWeekObj = weekObj;

    document.getElementById('roadmap-level-indicator').textContent = `Level 3: Week ${weekObj.week_number} Day-Wise Tasks`;
    const navMonths = document.getElementById('nav-level-months');
    const navWeeks = document.getElementById('nav-level-weeks');
    const navDays = document.getElementById('nav-level-days');

    navMonths.classList.remove('active');
    navWeeks.classList.remove('active');
    navDays.classList.add('active');
    navDays.disabled = false;
    navDays.textContent = `Week ${weekObj.week_number} Days`;

    const container = document.getElementById('roadmap-nodes-container');
    const daysList = weekObj.days || [];

    const isStarted = (roadmap.journey_started || (supervisor.authAgent.getActiveSession() && supervisor.authAgent.getActiveSession().journey_started)) && (roadmap.journey_start_date || (supervisor.authAgent.getActiveSession() && supervisor.authAgent.getActiveSession().journey_start_date));
    const startDate = roadmap.journey_start_date || (supervisor.authAgent.getActiveSession() ? supervisor.authAgent.getActiveSession().journey_start_date : null);

    const sundayRevisionObj = weekObj.sunday_revision || calculateClientSundayRevision(weekObj);

    container.innerHTML = `
      <div style="margin-bottom: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.8rem 1rem; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem;">
        <div>
          <strong style="color: var(--accent-emerald);">Parent Week ${weekObj.week_number}:</strong> ${weekObj.title}
        </div>
        <button id="back-to-weeks-btn" class="btn btn-secondary" style="font-size: 0.78rem; padding: 0.3rem 0.6rem;">
          <i class="ph ph-arrow-left"></i> Back to Weeks
        </button>
      </div>

      ${daysList.map(d => {
        const normDayMinutes = d.total_minutes || d.estimated_minutes || 120;
        const overallDayOffset = (weekObj.week_number - 1) * 7 + (d.day_number - 1);
        const dayDateObj = isStarted && startDate ? addDaysToDate(startDate, overallDayOffset) : null;
        const dayFormatted = d.formattedDateStr || (dayDateObj ? formatDateLong(dayDateObj) : (d.day_name || 'Day ' + d.day_number));
        const isSunday = (d.dayOfWeek === 'Sunday') || (dayDateObj && dayDateObj.getDay() === 0) || (d.calendarDate && parseLocalDate(d.calendarDate).getDay() === 0);
        const curSundayRevObj = isSunday ? calculateClientSundayRevision(weekObj, d) : null;

        const dayStatus = evaluateDayStatus(roadmap, d);

        let statusBadgeHTML = '';
        if (dayStatus === 'TODAY_COMPLETED') {
          statusBadgeHTML = `
            <span style="font-size: 0.75rem; font-weight: 800; background: rgba(16, 185, 129, 0.25); color: var(--accent-emerald); padding: 0.2rem 0.6rem; border-radius: 4px;">
              ✓ Today's Work Completed
            </span>
          `;
        } else if (dayStatus === 'COMPLETED') {
          if (d.assessment && d.assessment.assessmentMode === 'quiz') {
            const score = d.assessment.score !== undefined ? d.assessment.score : 0;
            const isWeak = d.assessment.needsRevision;
            statusBadgeHTML = `
              <span style="font-size: 0.75rem; font-weight: 700; background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); padding: 0.2rem 0.5rem; border-radius: 4px;">
                Quiz Score: ${score}%
              </span>
              <span style="font-size: 0.75rem; font-weight: 700; background: ${isWeak ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${isWeak ? '#f87171' : 'var(--accent-emerald)'}; padding: 0.2rem 0.5rem; border-radius: 4px;">
                ${isWeak ? '🔴 Sunday Revision' : '✓ Passed'}
              </span>
            `;
          } else {
            statusBadgeHTML = `
              <span style="font-size: 0.75rem; font-weight: 700; background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); padding: 0.2rem 0.5rem; border-radius: 4px;">
                ✓ Completed
              </span>
            `;
          }
        } else if (dayStatus === 'TODAY_ACTIVE') {
          statusBadgeHTML = `
            <span style="font-size: 0.72rem; font-weight: 800; background: var(--accent-cyan); color: #000; padding: 0.15rem 0.6rem; border-radius: 4px;">
              👉 TODAY'S LEARNING
            </span>
          `;
        } else if (dayStatus === 'LOCKED') {
          statusBadgeHTML = `
            <span style="font-size: 0.72rem; font-weight: 700; background: rgba(255,255,255,0.06); color: var(--text-muted); padding: 0.15rem 0.5rem; border-radius: 4px;">
              🔒 Available ${d.formattedDateStr || d.calendarDate || 'Tomorrow'}
            </span>
          `;
        }

        return `
          <div class="glass-card" style="margin-bottom: 1.2rem; border-left: 4px solid ${dayStatus === 'TODAY_ACTIVE' ? 'var(--accent-cyan)' : (dayStatus === 'TODAY_COMPLETED' || dayStatus === 'COMPLETED' ? 'var(--accent-emerald)' : (isSunday ? 'var(--accent-violet)' : 'rgba(255,255,255,0.2)'))}; ${dayStatus === 'TODAY_ACTIVE' ? 'box-shadow: 0 0 15px rgba(6, 182, 212, 0.2);' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <span style="font-size: 0.85rem; font-weight: 700; background: ${isSunday ? 'rgba(139, 92, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${isSunday ? 'var(--accent-violet)' : 'var(--accent-emerald)'}; padding: 0.2rem 0.6rem; border-radius: 4px;">
                  Day ${d.day_number} ${isSunday ? '(Sunday Revision)' : ''}
                </span>
                <strong style="font-size: 1rem; color: #fff;">${dayFormatted}</strong>
                <span style="font-size: 0.85rem; color: var(--text-muted);">(${d.topic || weekObj.topics[0]})</span>
                ${statusBadgeHTML}
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="font-size: 0.82rem; font-weight: 700; color: var(--accent-cyan);">
                  ⏱️ ${normDayMinutes} Mins
                </span>
                ${(() => {
                  if (dayStatus === 'TODAY_COMPLETED') {
                    return `
                      <span style="font-size: 0.76rem; font-weight: 700; color: var(--accent-emerald); background: rgba(16, 185, 129, 0.15); padding: 0.3rem 0.65rem; border-radius: 4px;">
                        ✓ Today Completed
                      </span>
                      <button class="btn btn-secondary launch-day-hub-btn" 
                        data-roadmap-id="${roadmap.roadmap_id || roadmap._id || roadmap.id || ''}" 
                        data-month="${monthObj.month_number || 1}" 
                        data-week="${weekObj.week_number || 1}" 
                        data-day="${d.day_number}" 
                        data-day-id="${d.id || d.day_id || ''}" 
                        style="padding: 0.3rem 0.65rem; font-size: 0.76rem;">
                        Tasks <i class="ph ph-arrow-right"></i>
                      </button>
                    `;
                  }
                  if (dayStatus === 'COMPLETED') {
                    return `
                      <span style="font-size: 0.76rem; font-weight: 700; color: var(--accent-emerald); background: rgba(16, 185, 129, 0.15); padding: 0.3rem 0.65rem; border-radius: 4px;">
                        ✓ Day ${d.day_number} Completed
                      </span>
                      <button class="btn btn-secondary" disabled style="padding: 0.3rem 0.65rem; font-size: 0.76rem; opacity: 0.45; cursor: not-allowed;" title="Day completed and locked">
                        <i class="ph ph-lock"></i> Locked
                      </button>
                    `;
                  }
                  if (dayStatus === 'LOCKED') {
                    return `
                      <button class="btn btn-secondary" disabled style="padding: 0.3rem 0.65rem; font-size: 0.76rem; opacity: 0.4; cursor: not-allowed;" title="Available tomorrow on scheduled date">
                        <i class="ph ph-lock-key"></i> Available Tomorrow
                      </button>
                    `;
                  }
                  return `
                    <button class="btn btn-secondary launch-day-hub-btn" 
                      data-roadmap-id="${roadmap.roadmap_id || roadmap._id || roadmap.id || ''}" 
                      data-month="${monthObj.month_number || 1}" 
                      data-week="${weekObj.week_number || 1}" 
                      data-day="${d.day_number}" 
                      data-day-id="${d.id || d.day_id || ''}" 
                      style="padding: 0.35rem 0.8rem; font-size: 0.78rem; font-weight: 700;">
                      Tasks <i class="ph ph-arrow-right"></i>
                    </button>
                  `;
                })()}
              </div>
            </div>

            <!-- SUNDAY REVISION DYNAMIC BOX FOR DAY 7 -->
            ${(isSunday && curSundayRevObj) ? `
              <div style="margin-bottom: 0.8rem; background: ${curSundayRevObj.hasQuizRevisions ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'}; border: 1px solid ${curSundayRevObj.hasQuizRevisions ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}; border-radius: 6px; padding: 0.9rem;">
                <div style="font-weight: 700; color: ${curSundayRevObj.hasQuizRevisions ? '#f87171' : 'var(--accent-emerald)'}; font-size: 0.9rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
                  <i class="ph ${curSundayRevObj.hasQuizRevisions ? 'ph-warning-circle' : 'ph-check-circle'}"></i> Weekly Revision Summary:
                </div>
                ${curSundayRevObj.hasQuizRevisions ? `
                  <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.4rem;">
                    ${curSundayRevObj.topics.map(t => `
                      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 0.5rem 0.8rem; border-radius: 4px; flex-wrap: wrap; gap: 0.4rem;">
                        <div>
                          <span style="color: #fff; font-weight: 700; font-size: 0.85rem;">🔴 ${t.topic}</span>
                          <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 0.6rem;">(${t.reason})</span>
                        </div>
                        <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                          Priority: ${t.priority}
                        </span>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div style="font-size: 0.82rem; color: var(--text-muted);">
                    ${curSundayRevObj.message}
                  </div>
                `}
              </div>
            ` : ''}

            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
              ${(d.tasks || []).map((rawT, idx) => {
                const normTask = window.normalizeDailyTask ? window.normalizeDailyTask(rawT, {
                  domain: roadmap.domain || 'fullstack',
                  monthNumber: monthObj.month_number,
                  weekNumber: weekObj.week_number,
                  dayNumber: d.day_number,
                  topic: d.topic,
                  taskSeq: idx + 1
                }) : rawT;

                let typeClass = 'STANDARD';
                if (normTask.taskType === 'PRACTICE' || normTask.taskType === 'IMPLEMENT') typeClass = 'REMEDIAL';
                else if (normTask.taskType === 'PROBLEM_SOLVING' || normTask.taskType === 'PROJECT') typeClass = 'SKIPPED';

                return `
                  <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.7rem 0.9rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                      <div style="display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.2rem;">
                        <span class="node-tag ${typeClass}" style="font-size: 0.7rem; padding: 0.1rem 0.4rem;">${normTask.taskType}</span>
                        <span class="tier-badge ${normTask.difficulty || 'INTERMEDIATE'}" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">${normTask.difficulty || 'INT'}</span>
                        <span style="font-size: 0.85rem; font-weight: 700; color: #fff;">${normTask.taskTitle}</span>
                      </div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">
                        ${normTask.description || 'Core daily learning task.'}
                      </div>
                    </div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-amber);">
                      ⏱️ ${normTask.durationMinutes} mins
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    `;

  container.querySelectorAll('.launch-day-hub-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const daySpec = {
          roadmapId: btn.dataset.roadmapId || '',
          month: parseInt(btn.dataset.month, 10),
          week: parseInt(btn.dataset.week, 10),
          day: parseInt(btn.dataset.day, 10),
          dayId: btn.dataset.dayId || ''
        };

        console.log('[DAY NAVIGATION]', {
          Clicked: true,
          roadmapId: daySpec.roadmapId,
          month: daySpec.month,
          week: daySpec.week,
          day: daySpec.day,
          dayId: daySpec.dayId
        });

        renderDailyHub(daySpec);
        switchView('dailyHub');
      });
    });

    document.getElementById('back-to-weeks-btn').addEventListener('click', () => {
      renderWeeklyView(roadmap, monthObj);
    });
  }

  document.getElementById('nav-level-months').addEventListener('click', () => {
    if (window.activePersonalizedRoadmap) {
      renderMonthlyView(window.activePersonalizedRoadmap);
    }
  });

  document.getElementById('nav-level-weeks').addEventListener('click', () => {
    if (window.activePersonalizedRoadmap && currentSelectedMonthObj) {
      renderWeeklyView(window.activePersonalizedRoadmap, currentSelectedMonthObj);
    }
  });

  document.getElementById('regenerate-roadmap-btn').addEventListener('click', async () => {
    const activeSession = supervisor.authAgent.getActiveSession();
    const userId = activeSession ? activeSession.user_id : (window.currentDraftProfile ? window.currentDraftProfile.user_id : null);

    if (!userId) {
      alert('Please log in or register first to generate a personalized roadmap.');
      return;
    }

    try {
      const btn = document.getElementById('regenerate-roadmap-btn');
      btn.disabled = true;
      btn.innerHTML = `<i class="ph ph-spinner spinner"></i> Regenerating...`;

      const currentRm = window.activePersonalizedRoadmap;
      const currentMode = currentRm ? (currentRm.generation_mode || (currentRm.quiz_score !== null && currentRm.quiz_score !== undefined ? 'quiz' : 'direct')) : 'direct';

      const res = await fetch('http://localhost:5000/api/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, generation_mode: currentMode })
      });

      const data = await res.json();
      btn.disabled = false;
      btn.innerHTML = `<i class="ph ph-arrows-counter-clockwise"></i> Regenerate Roadmap`;

      if (data.success && data.roadmap) {
        await renderRoadmapView(data.roadmap);
        alert('✅ Roadmap successfully regenerated and updated from your latest MongoDB Atlas profile and quiz performance!');
      } else {
        alert(data.error || 'Failed to regenerate roadmap.');
      }
    } catch (err) {
      console.error('Roadmap regeneration error:', err);
      alert('Error regenerating roadmap: ' + err.message);
      const btn = document.getElementById('regenerate-roadmap-btn');
      btn.disabled = false;
      btn.innerHTML = `<i class="ph ph-arrows-counter-clockwise"></i> Regenerate Roadmap`;
    }
  });

  document.getElementById('enter-daily-hub-btn').addEventListener('click', () => {
    const roadmap = window.activePersonalizedRoadmap;
    let targetSpec = getFirstUncompletedDaySpec(roadmap);
    renderDailyHub(targetSpec);
    switchView('dailyHub');
  });

  // =========================================================================
  // VIEW 5: DAILY HUB & WORKBOOK EXECUTION VIEW
  // =========================================================================
  async function renderDailyHub(targetSpecOrNumber) {
    let daySpec = {};
    if (typeof targetSpecOrNumber === 'object' && targetSpecOrNumber !== null) {
      daySpec = targetSpecOrNumber;
    } else {
      const parsedNum = parseInt(targetSpecOrNumber, 10) || 1;
      daySpec = { day: parsedNum };
    }

    const requestedMonth = daySpec.month !== undefined && daySpec.month !== null ? parseInt(daySpec.month, 10) : null;
    const requestedWeek = daySpec.week !== undefined && daySpec.week !== null ? parseInt(daySpec.week, 10) : null;
    const requestedDay = daySpec.day !== undefined && daySpec.day !== null ? parseInt(daySpec.day, 10) : 1;
    const requestedDayId = daySpec.dayId || null;
    const requestedRoadmapId = daySpec.roadmapId || null;

    window.currentSelectedDaySpec = {
      roadmapId: requestedRoadmapId,
      month: requestedMonth,
      week: requestedWeek,
      day: requestedDay,
      dayId: requestedDayId
    };

    try {
      localStorage.setItem('placify_selected_day_spec', JSON.stringify(window.currentSelectedDaySpec));
    } catch (e) {}

    // Bulletproof roadmap resolution from memory, state, or backend database
    let roadmap = window.activePersonalizedRoadmap;
    if (!roadmap) {
      const state = supervisor.progressTracker.getUserState();
      roadmap = state ? state.personalizedRoadmap : null;
    }
    if (!roadmap) {
      const activeSession = supervisor.authAgent.getActiveSession();
      const userId = activeSession ? activeSession.user_id : null;
      if (userId) {
        try {
          const res = await fetch(`http://localhost:5000/api/roadmap/user/${userId}`);
          const data = await res.json();
          if (data.success && data.roadmap) {
            roadmap = data.roadmap;
            window.activePersonalizedRoadmap = roadmap;
          } else {
            console.log(`[DAILY HUB] No roadmap found for user ${userId}. Auto-generating personalized roadmap...`);
            const domain = activeSession ? (activeSession.chosen_domain || 'datascience') : 'datascience';
            const genRes = await fetch('http://localhost:5000/api/roadmap/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                chosen_domain: domain,
                level: 'BEGINNER',
                timeline_months: 4,
                daily_hours: 2.0
              })
            });
            const genData = await genRes.json();
            if (genData.success && genData.roadmap) {
              roadmap = genData.roadmap;
              window.activePersonalizedRoadmap = roadmap;
            }
          }
        } catch (e) {
          console.warn('Could not fetch roadmap for daily hub:', e);
        }
      }
    }

    let dayObj = null;
    let parentMonthObj = null;
    let parentWeekObj = null;
    let dayTasksList = [];

    if (roadmap && Array.isArray(roadmap.monthly_roadmap)) {
      // Step 1: Attempt strict match on month, week, day
      for (const month of roadmap.monthly_roadmap) {
        const mNum = parseInt(month.month_number, 10);
        if (requestedMonth !== null && mNum !== requestedMonth) continue;

        if (Array.isArray(month.weeks)) {
          for (const week of month.weeks) {
            const wNum = parseInt(week.week_number, 10);
            if (requestedWeek !== null && wNum !== requestedWeek) continue;

            if (Array.isArray(week.days)) {
              for (const day of week.days) {
                const dNum = parseInt(day.day_number, 10);
                const dId = day.id || day.day_id || '';
                if (
                  (requestedDayId && dId === requestedDayId) ||
                  dNum === requestedDay
                ) {
                  dayObj = day;
                  parentMonthObj = month;
                  parentWeekObj = week;
                  dayTasksList = Array.isArray(day.tasks) ? day.tasks : [];
                  break;
                }
              }
            }
            if (dayObj) break;
          }
        }
        if (dayObj) break;
      }

      // Step 2: Fallback search across all months/weeks if strict filter didn't match
      if (!dayObj) {
        for (const month of roadmap.monthly_roadmap) {
          if (Array.isArray(month.weeks)) {
            for (const week of month.weeks) {
              if (Array.isArray(week.days)) {
                for (const day of week.days) {
                  const dNum = parseInt(day.day_number, 10);
                  const dId = day.id || day.day_id || '';
                  if (
                    (requestedDayId && dId === requestedDayId) ||
                    dNum === requestedDay
                  ) {
                    dayObj = day;
                    parentMonthObj = month;
                    parentWeekObj = week;
                    dayTasksList = Array.isArray(day.tasks) ? day.tasks : [];
                    break;
                  }
                }
              }
              if (dayObj) break;
            }
          }
          if (dayObj) break;
        }
      }
    }

    const targetDayNum = dayObj ? parseInt(dayObj.day_number, 10) : requestedDay;
    window.currentActiveDay = targetDayNum;

    const dailyData = supervisor.getDailyTaskAndResources(daySpec);
    const activeSession = supervisor.authAgent.getActiveSession();
    const domainKey = roadmap ? (roadmap.domain_id || roadmap.domain || roadmap.chosen_domain) : 
      (activeSession ? activeSession.chosen_domain : (window.currentDraftProfile ? window.currentDraftProfile.chosen_domain : 'cybersecurity'));

    const userLevel = (dayObj && dayObj.difficulty) ? dayObj.difficulty : (roadmap ? (roadmap.overall_level || roadmap.skillTier || 'BEGINNER') : 'BEGINNER');

    if (dayTasksList.length === 0 && dailyData && dailyData.task && Array.isArray(dailyData.task.tasks) && dailyData.task.tasks.length > 0) {
      dayTasksList = dailyData.task.tasks;
    }

    const dayTopic = dayObj ? (dayObj.topic || 'Core Learning') : (dailyData && dailyData.task ? dailyData.task.topic : 'Core Learning');

    if (dayTasksList.length === 0) {
      const isSundayRev = (parentWeekObj && parentWeekObj.sunday_revision) || 
                          (dayObj && (dayObj.is_sunday_revision || dayObj.isSundayRevision)) ||
                          (dayTopic && (dayTopic.toLowerCase().includes('sunday') || dayTopic.toLowerCase().includes('revision')));
      
      const cleanTopic = dayTopic || 'Core Learning Topics';

      if (isSundayRev) {
        dayTasksList = [
          {
            id: `task_rev_${targetDayNum}_1`,
            taskId: `task_rev_${targetDayNum}_1`,
            taskTitle: `Remedial Theory: ${cleanTopic}`,
            title: `Remedial Theory: ${cleanTopic}`,
            taskType: 'PRACTICE',
            type: 'PRACTICE',
            difficulty: userLevel,
            estimated_minutes: 48,
            durationMinutes: 48,
            description: `Study fundamental principles and syntax for ${cleanTopic}.`
          },
          {
            id: `task_rev_${targetDayNum}_2`,
            taskId: `task_rev_${targetDayNum}_2`,
            taskTitle: `Implement: ${cleanTopic} Practical Coding`,
            title: `Implement: ${cleanTopic} Practical Coding`,
            taskType: 'IMPLEMENT',
            type: 'IMPLEMENT',
            difficulty: userLevel,
            estimated_minutes: 48,
            durationMinutes: 48,
            description: `Hands-on module implementation for ${cleanTopic}.`
          },
          {
            id: `task_rev_${targetDayNum}_3`,
            taskId: `task_rev_${targetDayNum}_3`,
            taskTitle: `Remedial Drills & Exercises: ${cleanTopic}`,
            title: `Remedial Drills & Exercises: ${cleanTopic}`,
            taskType: 'PRACTICE',
            type: 'PRACTICE',
            difficulty: userLevel,
            estimated_minutes: 24,
            durationMinutes: 24,
            description: `Execute tests and consolidate key concepts for ${cleanTopic}.`
          }
        ];
      } else {
        dayTasksList = [
          {
            id: `task_std_${targetDayNum}_1`,
            taskId: `task_std_${targetDayNum}_1`,
            taskTitle: `Conceptual Overview: ${cleanTopic}`,
            title: `Conceptual Overview: ${cleanTopic}`,
            taskType: 'LEARN',
            type: 'LEARN',
            difficulty: userLevel,
            estimated_minutes: 45,
            durationMinutes: 45,
            description: `Read conceptual documentation, study architecture patterns, and review examples for ${cleanTopic}.`
          },
          {
            id: `task_std_${targetDayNum}_2`,
            taskId: `task_std_${targetDayNum}_2`,
            taskTitle: `Hands-on Implementation: ${cleanTopic}`,
            title: `Hands-on Implementation: ${cleanTopic}`,
            taskType: 'IMPLEMENT',
            type: 'IMPLEMENT',
            difficulty: userLevel,
            estimated_minutes: 60,
            durationMinutes: 60,
            description: `Build functional code modules and implement core logic for ${cleanTopic}.`
          },
          {
            id: `task_std_${targetDayNum}_3`,
            taskId: `task_std_${targetDayNum}_3`,
            taskTitle: `Practice Drills & Problem Solving: ${cleanTopic}`,
            title: `Practice Drills & Problem Solving: ${cleanTopic}`,
            taskType: 'PRACTICE',
            type: 'PRACTICE',
            difficulty: userLevel,
            estimated_minutes: 45,
            durationMinutes: 45,
            description: `Execute code exercises, test edge cases, and solve problem sets for ${cleanTopic}.`
          }
        ];
      }
    }

    const isStarted = (roadmap && (roadmap.journey_started || (activeSession && activeSession.journey_started))) &&
      (roadmap.journey_start_date || (activeSession ? activeSession.journey_start_date : null));
    const startDate = roadmap ? (roadmap.journey_start_date || (activeSession ? activeSession.journey_start_date : null)) : null;

    let dayFormatted = dayObj ? (dayObj.day_name || `Day ${targetDayNum}`) : `Day ${targetDayNum}`;
    if (parentWeekObj && isStarted && startDate) {
      const overallDayOffset = (parentWeekObj.week_number - 1) * 7 + (targetDayNum - 1);
      const dayDateObj = addDaysToDate(startDate, overallDayOffset);
      if (dayDateObj) {
        dayFormatted = formatDateLong(dayDateObj);
      }
    }

    const dayWorkload = dayObj ? (dayObj.total_minutes || (dayTasksList.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0) || 150)) : (dailyData && dailyData.task && dailyData.task.estHours ? Math.round(dailyData.task.estHours * 60) : 150);

    console.log('[DAY RESOLUTION]', {
      Requested: {
        roadmapId: requestedRoadmapId || (roadmap ? roadmap.roadmap_id || roadmap.id : null),
        month: requestedMonth,
        week: requestedWeek,
        day: requestedDay,
        dayId: requestedDayId
      },
      Resolved: {
        date: dayFormatted,
        topic: dayTopic,
        taskCount: dayTasksList.length,
        taskIds: dayTasksList.map(t => t.id || t.taskId || t.title)
      }
    });

    console.log('[EXECUTION PAGE]', {
      Rendering: true,
      dayNumber: targetDayNum,
      date: dayFormatted,
      topic: dayTopic,
      taskIds: dayTasksList.map(t => t.id || t.taskId || t.title)
    });

    // 1. RENDER HEADER & BADGES
    const dayBadgeEl = document.getElementById('current-day-badge');
    if (dayBadgeEl) dayBadgeEl.textContent = `Day ${targetDayNum} Task Execution`;

    const titleEl = document.getElementById('current-task-title');
    if (titleEl) titleEl.textContent = `${dayFormatted} — ${dayTopic}`;

    const workloadEl = document.getElementById('current-day-workload-badge');
    if (workloadEl) workloadEl.textContent = `⏱️ ${dayWorkload} Mins Workload`;

    const typeBadgeEl = document.getElementById('task-type-badge');
    if (typeBadgeEl) {
      typeBadgeEl.textContent = `${domainKey.toUpperCase()} • ${userLevel}`;
      typeBadgeEl.className = `node-tag STANDARD`;
    }

    const dayIsCompleted = dayObj && isDayCompleted(dayObj);

    // 2. RENDER COMPLETED & LOCKED BANNER
    const lockedBannerEl = document.getElementById('daily-hub-completed-locked-banner');
    if (lockedBannerEl) {
      if (dayIsCompleted) {
        lockedBannerEl.style.display = 'block';
        lockedBannerEl.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 1.2rem; margin-bottom: 1.5rem; text-align: center;">
            <h4 style="color: #f87171; font-size: 1.1rem; font-weight: 700; margin: 0 0 0.4rem 0; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
              <i class="ph ph-lock-key" style="font-size: 1.4rem;"></i> Day ${targetDayNum} Assessment Completed & Locked
            </h4>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0 0 1rem 0;">
              You have already completed Day ${targetDayNum}'s assessment. Re-assessing or modifying completed days is disabled.
            </p>
            <button id="hub-go-to-next-day-btn" class="btn btn-emerald" style="font-weight: 700; font-size: 0.88rem; padding: 0.5rem 1.2rem; display: inline-flex; align-items: center; gap: 0.5rem;">
              Go to Active Day (Day ${targetDayNum + 1}) <i class="ph ph-arrow-right"></i>
            </button>
          </div>
        `;
        const hubNextBtn = document.getElementById('hub-go-to-next-day-btn');
        if (hubNextBtn) {
          hubNextBtn.onclick = () => {
            const nextSpec = getNextDaySpec(roadmap, targetDayNum);
            renderDailyHub(nextSpec);
          };
        }
      } else {
        lockedBannerEl.style.display = 'none';
        lockedBannerEl.innerHTML = '';
      }
    }

    // 2.5 RENDER SUNDAY REVISION SUMMARY BANNER IF APPLICABLE
    const sundayBannerEl = document.getElementById('sunday-revision-summary-banner');
    if (sundayBannerEl) {
      const isSundayRev = (parentWeekObj && parentWeekObj.sunday_revision) || 
                          (dayObj && (dayObj.is_sunday_revision || dayObj.isSundayRevision)) ||
                          (dayTopic && (dayTopic.toLowerCase().includes('sunday') || dayTopic.toLowerCase().includes('revision')));
      
      if (isSundayRev) {
        let revTopics = [];
        if (parentWeekObj && parentWeekObj.sunday_revision && Array.isArray(parentWeekObj.sunday_revision.topics)) {
          revTopics = parentWeekObj.sunday_revision.topics;
        }
        
        sundayBannerEl.style.display = 'block';
        if (revTopics.length > 0) {
          sundayBannerEl.innerHTML = `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; padding: 1.2rem; margin-bottom: 1.5rem;">
              <h4 style="color: var(--accent-amber); font-size: 1rem; font-weight: 700; margin: 0 0 0.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <i class="ph ph-arrows-clockwise" style="font-size: 1.3rem;"></i> Sunday Weekly Remedial Revision Session
              </h4>
              <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0 0 0.8rem 0; line-height: 1.4;">
                Today is dedicated to reinforcing specific concepts flagged from your daily assessment performance this week:
              </p>
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${revTopics.map(t => {
                  const name = typeof t === 'string' ? t : (t.topic || t.name || 'Weak Topic');
                  const score = typeof t === 'object' && t.score !== undefined ? t.score : null;
                  const reason = typeof t === 'object' && t.reason ? t.reason : '';
                  return `
                    <div style="background: rgba(0,0,0,0.25); border-left: 3px solid var(--accent-amber); padding: 0.5rem 0.8rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem;">
                      <span style="font-size: 0.86rem; font-weight: 700; color: #fff;">${name}</span>
                      <span style="font-size: 0.76rem; color: var(--accent-amber); font-weight: 600;">
                        ${score !== null ? `Score: ${score}% • ` : ''}${reason || 'Needs Revision'} (Priority: HIGH)
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        } else {
          sundayBannerEl.innerHTML = `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 1.2rem; margin-bottom: 1.5rem;">
              <h4 style="color: var(--accent-emerald); font-size: 1rem; font-weight: 700; margin: 0 0 0.3rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <i class="ph ph-check-circle" style="font-size: 1.3rem;"></i> Sunday Weekly Consolidation & Review
              </h4>
              <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
                All daily assessments this week met or exceeded mastery thresholds! Today's session offers comprehensive consolidation exercises across this week's topics.
              </p>
            </div>
          `;
        }
      } else {
        sundayBannerEl.style.display = 'none';
        sundayBannerEl.innerHTML = '';
      }
    }

    // 3. RENDER ASSESSMENT STATUS BADGE
    const statusBadgeEl = document.getElementById('daily-hub-assessment-status-badge');
    if (statusBadgeEl && dayObj) {
      if (dayIsCompleted) {
        if (dayObj.assessment && dayObj.assessment.assessmentMode === 'quiz') {
          const score = dayObj.assessment.score !== undefined ? dayObj.assessment.score : 0;
          const isWeak = dayObj.assessment.needsRevision;
          statusBadgeEl.innerHTML = `
            <span style="font-size: 0.8rem; font-weight: 700; background: rgba(6, 182, 212, 0.2); color: var(--accent-cyan); padding: 0.25rem 0.6rem; border-radius: 4px;">
              Quiz Score: ${score}% (${isWeak ? '🔴 Sunday Revision' : '✓ Passed'}) • Locked
            </span>
          `;
        } else {
          statusBadgeEl.innerHTML = `
            <span style="font-size: 0.8rem; font-weight: 700; background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); padding: 0.25rem 0.6rem; border-radius: 4px;">
              ✓ Completed Manually • Locked
            </span>
          `;
        }
      } else {
        statusBadgeEl.innerHTML = `<span style="font-size: 0.78rem; color: var(--text-muted);">Status: Pending</span>`;
      }
    }

    // 4. ATTACH ALL INTERACTIVE BUTTON EVENT LISTENERS IMMEDIATELY
    const takeQuizBtn = document.getElementById('daily-hub-take-quiz-btn');
    const manualBtn = document.getElementById('daily-hub-manual-complete-btn');
    const confirmBox = document.getElementById('manual-completion-confirm-box');
    const checkbox = document.getElementById('manual-completion-checkbox');
    const cancelManualBtn = document.getElementById('cancel-manual-confirm-btn');
    const submitManualBtn = document.getElementById('submit-manual-confirm-btn');
    const startConceptQuizBtn = document.getElementById('start-concept-quiz-btn');
    const viewAllRoadmapBtn = document.getElementById('view-all-roadmap-btn');

    if (viewAllRoadmapBtn) {
      viewAllRoadmapBtn.onclick = () => {
        const state = supervisor.progressTracker.getUserState();
        renderRoadmapView(state ? state.personalizedRoadmap : window.activePersonalizedRoadmap);
        switchView('roadmap');
      };
    }

    // SHARED QUIZ GENERATION HANDLER
    const executeTakeQuizFlow = async () => {
      if (dayIsCompleted) return;
      try {
        if (takeQuizBtn) {
          takeQuizBtn.disabled = true;
          takeQuizBtn.innerHTML = `<i class="ph ph-spinner spinner"></i> Generating Quiz...`;
        }
        if (startConceptQuizBtn) {
          startConceptQuizBtn.disabled = true;
          startConceptQuizBtn.innerHTML = `<i class="ph ph-spinner spinner"></i> Generating...`;
        }

        const userId = activeSession ? activeSession.user_id : (window.currentDraftProfile ? window.currentDraftProfile.user_id : 'guest');
        const roadmapId = roadmap ? (roadmap.roadmap_id || roadmap._id || roadmap.id || '') : '';

        // Collect subtopics/topics for quiz generation
        let subtopicsList = [];
        if (dayObj && Array.isArray(dayObj.subtopics) && dayObj.subtopics.length > 0) {
          subtopicsList = dayObj.subtopics;
        } else if (dayTasksList.length > 0) {
          subtopicsList = dayTasksList.map(t => t.taskTopic || t.topic || t.taskSubtopic || t.title || dayTopic);
        } else {
          subtopicsList = [dayTopic];
        }

        // Sunday Revision topics check
        const isSundayRev = (parentWeekObj && parentWeekObj.sunday_revision) || (dayObj && (dayObj.is_sunday_revision || dayObj.isSundayRevision));
        if (isSundayRev && parentWeekObj && parentWeekObj.sunday_revision && Array.isArray(parentWeekObj.sunday_revision.topics)) {
          if (parentWeekObj.sunday_revision.topics.length > 0) {
            subtopicsList = parentWeekObj.sunday_revision.topics.map(t => typeof t === 'string' ? t : (t.topic || t.name || dayTopic));
          }
        }

        const res = await fetch('http://localhost:5000/api/roadmap/daily-assessment/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            roadmapId,
            monthNumber: parentMonthObj ? parentMonthObj.month_number : 1,
            weekNumber: parentWeekObj ? parentWeekObj.week_number : 1,
            dayNumber: targetDayNum,
            topic: dayTopic,
            subtopics: subtopicsList,
            domain: domainKey,
            level: userLevel,
            questionCount: 10
          })
        });

        const data = await res.json();

        if (takeQuizBtn) {
          takeQuizBtn.disabled = false;
          takeQuizBtn.innerHTML = `Take Quiz <i class="ph ph-arrow-right"></i>`;
        }
        if (startConceptQuizBtn) {
          startConceptQuizBtn.disabled = false;
          startConceptQuizBtn.innerHTML = `Take Day Assessment <i class="ph ph-note-pencil"></i>`;
        }

        if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
          window.currentDailyAssessmentContext = {
            dayObj,
            parentMonthObj,
            parentWeekObj,
            targetDayNum,
            dayTopic,
            assessmentId: data.assessmentId,
            questions: data.questions
          };

          const summaryEl = document.getElementById('quiz-grounded-summary');
          if (summaryEl) {
            summaryEl.textContent = `Dynamic Diagnostic Assessment for Day ${targetDayNum}: ${dayTopic} (${userLevel} Level). Grounded in today's curriculum content.`;
          }

          const container = document.getElementById('concept-quiz-questions-container');
          if (container) {
            container.innerHTML = data.questions.map((q, idx) => renderQuizQuestionCardHTML(q, idx)).join('');

            container.querySelectorAll('.option-btn').forEach(btn => {
              btn.addEventListener('click', () => {
                const qid = btn.dataset.cqid;
                container.querySelectorAll(`.option-btn[data-cqid="${qid}"]`).forEach(b => {
                  b.classList.remove('selected');
                  b.querySelector('i').className = 'ph ph-circle';
                });
                btn.classList.add('selected');
                btn.querySelector('i').className = 'ph ph-check-circle';
              });
            });
          }

          switchView('conceptQuiz');
        } else {
          alert(data.error || 'Could not generate dynamic quiz.');
        }
      } catch (genErr) {
        console.error('[QUIZ GENERATION ERROR]', genErr);
        alert('Error generating dynamic daily quiz: ' + genErr.message);
        if (takeQuizBtn) {
          takeQuizBtn.disabled = false;
          takeQuizBtn.innerHTML = `Take Quiz <i class="ph ph-arrow-right"></i>`;
        }
        if (startConceptQuizBtn) {
          startConceptQuizBtn.disabled = false;
          startConceptQuizBtn.innerHTML = `Take Day Assessment <i class="ph ph-note-pencil"></i>`;
        }
      }
    };

    // OPTION 1 BUTTON: TAKE QUIZ
    if (takeQuizBtn) {
      if (dayIsCompleted) {
        takeQuizBtn.disabled = true;
        takeQuizBtn.innerHTML = `<i class="ph ph-lock"></i> Day Completed`;
        takeQuizBtn.style.opacity = '0.5';
        takeQuizBtn.style.cursor = 'not-allowed';
        takeQuizBtn.onclick = null;
      } else {
        takeQuizBtn.disabled = false;
        takeQuizBtn.innerHTML = `Take Quiz <i class="ph ph-arrow-right"></i>`;
        takeQuizBtn.style.opacity = '1';
        takeQuizBtn.style.cursor = 'pointer';
        takeQuizBtn.onclick = executeTakeQuizFlow;
      }
    }

    // BOTTOM BUTTON: TAKE DAY ASSESSMENT
    if (startConceptQuizBtn) {
      if (dayIsCompleted) {
        startConceptQuizBtn.disabled = true;
        startConceptQuizBtn.innerHTML = `<i class="ph ph-lock"></i> Assessment Completed`;
        startConceptQuizBtn.style.opacity = '0.5';
        startConceptQuizBtn.style.cursor = 'not-allowed';
        startConceptQuizBtn.onclick = null;
      } else {
        startConceptQuizBtn.disabled = false;
        startConceptQuizBtn.innerHTML = `Take Day Assessment <i class="ph ph-note-pencil"></i>`;
        startConceptQuizBtn.style.opacity = '1';
        startConceptQuizBtn.style.cursor = 'pointer';
        startConceptQuizBtn.onclick = executeTakeQuizFlow;
      }
    }

    // OPTION 2 BUTTON: MARK COMPLETE MANUALLY
    if (manualBtn) {
      if (dayIsCompleted) {
        manualBtn.disabled = true;
        manualBtn.innerHTML = `<i class="ph ph-lock"></i> Day Completed`;
        manualBtn.style.opacity = '0.5';
        manualBtn.style.cursor = 'not-allowed';
        manualBtn.onclick = null;
      } else {
        manualBtn.disabled = false;
        manualBtn.innerHTML = `Mark Complete Manually <i class="ph ph-check"></i>`;
        manualBtn.style.opacity = '1';
        manualBtn.style.cursor = 'pointer';
        manualBtn.onclick = () => {
          if (dayIsCompleted) return;
          if (confirmBox) confirmBox.style.display = 'block';
        };
      }
    }

    if (checkbox && submitManualBtn) {
      checkbox.onchange = () => {
        submitManualBtn.disabled = !checkbox.checked;
      };
    }

    if (cancelManualBtn && confirmBox) {
      cancelManualBtn.onclick = () => {
        confirmBox.style.display = 'none';
        if (checkbox) checkbox.checked = false;
        if (submitManualBtn) submitManualBtn.disabled = true;
      };
    }

    if (submitManualBtn) {
      submitManualBtn.onclick = async () => {
        try {
          submitManualBtn.disabled = true;
          submitManualBtn.innerHTML = `<i class="ph ph-spinner spinner"></i> Confirming...`;

          const userId = activeSession ? activeSession.user_id : (window.currentDraftProfile ? window.currentDraftProfile.user_id : 'guest');
          const roadmapId = roadmap ? (roadmap.roadmap_id || roadmap._id || roadmap.id || '') : '';

          const res = await fetch('http://localhost:5000/api/roadmap/daily-assessment/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              roadmapId,
              monthNumber: parentMonthObj ? parentMonthObj.month_number : 1,
              weekNumber: parentWeekObj ? parentWeekObj.week_number : 1,
              dayNumber: targetDayNum,
              assessmentMode: 'manual',
              completedManually: true
            })
          });

          const data = await res.json();
          submitManualBtn.disabled = false;
          submitManualBtn.innerHTML = `Confirm Manual Completion <i class="ph ph-check-circle"></i>`;
          if (confirmBox) confirmBox.style.display = 'none';
          if (checkbox) checkbox.checked = false;

          if (data.success && data.dayAssessment) {
            if (dayObj) {
              dayObj.assessment = data.dayAssessment;
              dayObj.completed = true;
            }
            if (parentWeekObj && data.sundayRevision) {
              parentWeekObj.sunday_revision = data.sundayRevision;
            }

            if (statusBadgeEl) {
              statusBadgeEl.innerHTML = `
                <span style="font-size: 0.8rem; font-weight: 700; background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); padding: 0.25rem 0.6rem; border-radius: 4px;">
                  ✓ Completed Manually
                </span>
              `;
            }

            const nextDayNum = targetDayNum + 1;
            alert(`✓ Day ${targetDayNum} learning activities marked as completed manually!\n\nAuto-advancing to Day ${nextDayNum}...`);

            const nextSpec = getNextDaySpec(roadmap, targetDayNum);
            renderDailyHub(nextSpec);
            switchView('dailyHub');
          } else {
            alert(data.error || 'Failed to submit manual completion.');
          }
        } catch (mErr) {
          console.error('[MANUAL COMPLETION ERROR]', mErr);
          alert('Error marking manual completion: ' + mErr.message);
          if (submitManualBtn) {
            submitManualBtn.disabled = false;
            submitManualBtn.innerHTML = `Confirm Manual Completion <i class="ph ph-check-circle"></i>`;
          }
        }
      };
    }

    // 5. ASYNCHRONOUS RESOURCE AND TASK WORKBOOK LOADER (DECOUPLED FROM BUTTON LISTENERS)
    const resList = document.getElementById('suggested-resources-list');
    if (resList) {
      resList.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);"><i class="ph ph-spinner spinner"></i> Loading Day ${targetDayNum} tasks and curated learning resources...</div>`;

      const loadPageTasksAndResources = async () => {
        const userId = activeSession ? activeSession.user_id : (window.currentDraftProfile ? window.currentDraftProfile.user_id : null);

        if (dayTasksList.length === 0) {
          console.error('[ROADMAP TASK CONTRACT ERROR] Day has no tasks assigned:', { targetDayNum, dayTopic, domainKey });
          resList.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--accent-amber);"><i class="ph ph-warning-circle" style="font-size: 2rem;"></i><br/><br/>No tasks found for Day ${targetDayNum}. Please return to the roadmap and select a valid day.</div>`;
          return;
        }

        let fullHTML = '';

        for (let tIdx = 0; tIdx < dayTasksList.length; tIdx++) {
          const rawTaskItem = dayTasksList[tIdx];
          const taskItem = window.normalizeDailyTask ? window.normalizeDailyTask(rawTaskItem, {
            domain: domainKey,
            dayNumber: targetDayNum,
            topic: dayTopic,
            taskSeq: tIdx + 1
          }) : rawTaskItem;

          let typeClass = 'STANDARD';
          if (taskItem.taskType === 'PRACTICE' || taskItem.taskType === 'IMPLEMENT') typeClass = 'REMEDIAL';
          else if (taskItem.taskType === 'PROBLEM_SOLVING' || taskItem.taskType === 'PROJECT') typeClass = 'SKIPPED';

          const taskTopic =
            taskItem.taskTopic ||
            taskItem.topic ||
            taskItem.taskSubtopic ||
            taskItem.subtopic ||
            dayTopic;

          const taskContext = {
            id: taskItem.taskId || taskItem.id || `task_day_${targetDayNum}_${tIdx + 1}`,
            taskId: taskItem.taskId || taskItem.id || `task_day_${targetDayNum}_${tIdx + 1}`,
            dayNumber: targetDayNum,
            title: taskItem.taskTitle || taskItem.title || taskTopic,
            taskTitle: taskItem.taskTitle || taskItem.title || taskTopic,
            topic: taskTopic,
            taskTopic: taskTopic,
            subtopic:
              taskItem.taskSubtopic ||
              taskItem.subtopic ||
              taskItem.subskillName ||
              taskTopic,
            taskSubtopic:
              taskItem.taskSubtopic ||
              taskItem.subtopic ||
              taskItem.subskillName ||
              taskTopic,
            skillId: taskItem.skillId,
            subskillId: taskItem.subskillId,
            subskillName: taskItem.subskillName,
            parentSkillId: taskItem.parentSkillId,
            dayTopic: dayTopic,
            dailyTopic: taskTopic,
            type: taskItem.taskType || taskItem.type || 'LEARN',
            taskType: taskItem.taskType || taskItem.type || 'LEARN',
            estimated_minutes: taskItem.durationMinutes || taskItem.estimated_minutes || 45,
            taskDuration: taskItem.durationMinutes || taskItem.estimated_minutes || 45,
            durationMinutes: taskItem.durationMinutes || taskItem.estimated_minutes || 45,
            domain: domainKey,
            chosen_domain: domainKey,
            user_id: userId,
            userLevel: taskItem.difficulty || userLevel,
            difficulty: taskItem.difficulty || userLevel,
            description: taskItem.description || taskItem.practice_details || ''
          };

          let taskResources = [];
          try {
            taskResources = await supervisor.resourceSuggester.suggestResources(
              taskTopic,
              taskItem.difficulty || userLevel,
              taskContext
            );
          } catch (rErr) {
            console.error('[RESOURCE RECOMMENDATION ERROR for task ' + taskContext.taskId + ']:', rErr);
            taskResources = supervisor.resourceSuggester.suggestResourcesSync(
              taskTopic,
              taskItem.difficulty || userLevel,
              taskContext
            );
          }

          if (!Array.isArray(taskResources) || taskResources.length === 0) {
            taskResources = supervisor.resourceSuggester.suggestResourcesSync(
              taskTopic,
              taskItem.difficulty || userLevel,
              taskContext
            );
          }

          fullHTML += `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1.2rem; margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.6rem;">
                <div>
                  <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap;">
                    <span class="node-tag ${typeClass}" style="font-size: 0.75rem; padding: 0.15rem 0.5rem;">${taskItem.taskType || 'LEARN'}</span>
                    <span class="tier-badge ${taskItem.difficulty || userLevel}" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">${taskItem.difficulty || userLevel}</span>
                    <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff; margin: 0;">${taskItem.taskTitle || taskItem.title || 'Task'}</h3>
                  </div>
                  <div style="font-size: 0.84rem; color: var(--text-muted); line-height: 1.4;">
                    ${taskItem.description || 'Read conceptual overview, study examples, and execute practice code drills.'}
                  </div>
                </div>
                <div style="font-size: 0.88rem; font-weight: 700; color: var(--accent-amber); white-space: nowrap;">
                  ⏱️ ${taskItem.durationMinutes || taskItem.estimated_minutes || 30} mins
                </div>
              </div>

              <!-- RECOMMENDED RESOURCES FOR THIS SPECIFIC TASK -->
              <div style="margin-top: 1rem; padding-top: 0.8rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                <h4 style="font-size: 0.86rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.7rem; display: flex; align-items: center; gap: 0.4rem;">
                  <i class="ph ph-books"></i> Recommended Resources for Today's Task:
                </h4>

                <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                  ${(taskResources || []).map((r, idx) => `
                    <div class="resource-card" style="border-left: 4px solid ${idx === 0 ? 'var(--accent-emerald)' : (idx === 1 ? 'var(--accent-cyan)' : 'var(--accent-amber)')}; padding: 0.9rem; background: rgba(0,0,0,0.25); border-radius: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.4rem;">
                        <span class="node-tag ${r.category_label || (idx === 0 ? 'STANDARD' : 'REMEDIAL')}" style="font-size: 0.72rem; font-weight: 800;">
                          ⭐ ${r.category_label || (idx === 0 ? 'PRIMARY' : (idx === 1 ? 'ALTERNATIVE' : 'PRACTICE'))}
                        </span>
                        <span style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 600;">
                          ${r.is_official ? '🏛️ Official Documentation' : `Platform: ${r.platform || 'Web'}`}
                        </span>
                      </div>
                      <h5 style="font-size: 0.98rem; font-weight: 700; color: #fff; margin: 0.3rem 0;">${r.title}</h5>
                      <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 0.5rem;">${r.description}</p>
                      
                      ${r.recommended_section ? `
                        <div style="font-size: 0.76rem; color: var(--accent-amber); background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px; margin-bottom: 0.5rem;">
                          🎯 <strong>Recommended Section:</strong> ${r.recommended_section} (${r.estimated_minutes || 30} mins)
                        </div>
                      ` : ''}

                      <p style="font-size: 0.76rem; color: var(--text-dim); font-style: italic; margin-bottom: 0.6rem;">
                        💡 <strong>Why this resource:</strong> ${r.relevance_reason || 'Directly supports today\'s specific task.'}
                      </p>

                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${r.platform || 'Documentation'}</span>
                        <a href="${r.url || r.link || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-emerald" style="font-size: 0.78rem; padding: 0.3rem 0.75rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
                          Open Resource <i class="ph ph-arrow-square-out"></i>
                        </a>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }

        resList.innerHTML = fullHTML;
      };

      // Trigger background resource fetch non-blockingly
      loadPageTasksAndResources().catch(err => {
        console.error('[DAILY HUB TASK RESOURCE ERROR]', err);
        resList.innerHTML = `<div style="padding: 1rem; color: var(--text-muted);">Recommended resources are temporarily unavailable. You may continue with your task workbook below.</div>`;
      });
    }

    updateHeaderStats();
  }



  // =========================================================================
  // VIEW 6: CONCEPT ASSESSMENT (RESOURCE FETCHER & DYNAMIC DAILY QUIZ SUBMISSION)
  // =========================================================================
  function renderConceptQuiz(conceptTitle, topic) {
    const quizData = supervisor.fetchTaskAssessment(conceptTitle, topic);
    window.currentAssessmentData = quizData;

    document.getElementById('quiz-grounded-summary').textContent = quizData.retrievedContentSummary;

    const container = document.getElementById('concept-quiz-questions-container');
    container.innerHTML = quizData.questions.map((q, idx) => renderQuizQuestionCardHTML(q, idx)).join('');

    container.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.cqid;
        container.querySelectorAll(`.option-btn[data-cqid="${qid}"]`).forEach(b => {
          b.classList.remove('selected');
          b.querySelector('i').className = 'ph ph-circle';
        });
        btn.classList.add('selected');
        btn.querySelector('i').className = 'ph ph-check-circle';
      });
    });
  }

  const conceptQuizForm = document.getElementById('concept-assessment-form');
  conceptQuizForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check if submitting dynamic daily quiz
    const ctx = window.currentDailyAssessmentContext;
    if (ctx && Array.isArray(ctx.questions) && ctx.questions.length > 0) {
      const userAnswers = {};
      ctx.questions.forEach(q => {
        const selected = document.querySelector(`#concept-quiz-questions-container .option-btn.selected[data-cqid="${q.id}"]`);
        if (selected) {
          userAnswers[q.id] = parseInt(selected.dataset.coidx, 10);
        } else {
          const textInput = document.querySelector(`#concept-quiz-questions-container .quiz-text-input[data-cqid="${q.id}"]`);
          if (textInput && textInput.value.trim()) {
            userAnswers[q.id] = textInput.value.trim();
          } else {
            userAnswers[q.id] = -1;
          }
        }
      });

      try {
        const activeSession = supervisor.authAgent.getActiveSession();
        const userId = activeSession ? activeSession.user_id : (window.currentDraftProfile ? window.currentDraftProfile.user_id : 'guest');
        const roadmap = window.activePersonalizedRoadmap;
        const roadmapId = roadmap ? (roadmap.roadmap_id || roadmap._id || roadmap.id || '') : '';

        const res = await fetch('http://localhost:5000/api/roadmap/daily-assessment/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            roadmapId,
            monthNumber: ctx.parentMonthObj ? ctx.parentMonthObj.month_number : 1,
            weekNumber: ctx.parentWeekObj ? ctx.parentWeekObj.week_number : 1,
            dayNumber: ctx.targetDayNum,
            assessmentMode: 'quiz',
            userAnswers,
            questions: ctx.questions,
            assessmentId: ctx.assessmentId
          })
        });

        const data = await res.json();
        if (data.success && data.dayAssessment) {
          if (ctx.dayObj) {
            ctx.dayObj.assessment = data.dayAssessment;
            ctx.dayObj.completed = true;
          }
          if (ctx.parentWeekObj && data.sundayRevision) {
            ctx.parentWeekObj.sunday_revision = data.sundayRevision;
          }
          if (data.progress) {
            renderProgressAnalyticsFromBackend(data.progress);
          }

          const score = data.dayAssessment.score;
          const isWeak = data.dayAssessment.needsRevision;
          const nextDayNum = ctx.targetDayNum + 1;

          alert(`🎉 Day ${ctx.targetDayNum} Quiz Submitted!\n\nOverall Score: ${score}%\nResult: ${isWeak ? '🔴 Score below 70% threshold — topic added to Sunday Revision.' : '✓ Passed! Great job.'}\n\nAuto-advancing to Day ${nextDayNum}...`);

          window.currentDailyAssessmentContext = null;
          const nextSpec = getNextDaySpec(roadmap, ctx.targetDayNum);
          renderDailyHub(nextSpec);
          switchView('dailyHub');
        } else {
          alert(data.error || 'Failed to submit assessment.');
        }
      } catch (subErr) {
        console.error('Daily quiz submit error:', subErr);
        alert('Error submitting assessment: ' + subErr.message);
      }
      return;
    }

    // Fallback default form handler
    const userAnswers = {};
    const questions = (window.currentAssessmentData && window.currentAssessmentData.questions) ? window.currentAssessmentData.questions : [];

    questions.forEach(q => {
      const selected = document.querySelector(`#concept-quiz-questions-container .option-btn.selected[data-cqid="${q.id}"]`);
      if (selected) {
        userAnswers[q.id] = parseInt(selected.dataset.coidx, 10);
      } else {
        const textInput = document.querySelector(`#concept-quiz-questions-container .quiz-text-input[data-cqid="${q.id}"]`);
        if (textInput && textInput.value.trim()) {
          userAnswers[q.id] = textInput.value.trim();
        } else {
          userAnswers[q.id] = -1;
        }
      }
    });

    const result = supervisor.submitTaskAssessment(window.currentActiveDay || 1, questions, userAnswers);
    renderProgressAnalytics(result.grade, result.updatedState);
    updateHeaderStats();
    switchView('progressAnalytics');
  });

  // =========================================================================
  // VIEW 7: PROGRESS & ANALYTICS
  // =========================================================================
  async function fetchAndRenderUserProgress() {
    try {
      const activeSession = supervisor.authAgent.getActiveSession();
      const userId = activeSession ? activeSession.user_id : (window.currentDraftProfile ? window.currentDraftProfile.user_id : 'guest');
      const roadmap = window.activePersonalizedRoadmap;
      const roadmapId = roadmap ? (roadmap.roadmap_id || roadmap._id || roadmap.id || '') : '';
      const clientLocalDate = getDeviceLocalDate();
      const clientTimezone = getDeviceTimezone();

      const res = await fetch(`http://localhost:5000/api/roadmap/progress/${userId}/${roadmapId}?clientLocalDate=${clientLocalDate}&clientTimezone=${encodeURIComponent(clientTimezone)}`);
      const data = await res.json();

      if (data.success && data.progress) {
        renderProgressAnalyticsFromBackend(data.progress);
      }
    } catch (err) {
      console.warn('Could not fetch dynamic roadmap progress:', err.message);
    }
  }

  function renderProgressAnalyticsFromBackend(progress) {
    if (!progress) return;
    window.currentRoadmapProgress = progress;

    // Overall Progress %
    const overallPct = progress.overall ? progress.overall.percent : 0;
    const completedDays = progress.overall ? progress.overall.completedDays : 0;
    const totalDays = progress.overall ? progress.overall.totalDays : 0;
    const elMastery = document.getElementById('analytics-mastery-num');
    if (elMastery) elMastery.textContent = `${overallPct}%`;

    const elDays = document.getElementById('analytics-days-count');
    if (elDays) elDays.textContent = `${completedDays} / ${totalDays} Scheduled Days`;

    // Streak
    const streakDays = progress.streak ? progress.streak.currentStreakDays : 0;
    const elStreak = document.getElementById('analytics-streak-num');
    if (elStreak) elStreak.textContent = `${streakDays}`;

    const elUserStreakHeader = document.getElementById('user-streak-val');
    if (elUserStreakHeader) elUserStreakHeader.textContent = `${streakDays}`;

    try {
      const state = supervisor.progressTracker.getUserState();
      if (state) state.streak = streakDays;
    } catch (e) {}

    // Hours
    const plannedHrs = progress.hours ? progress.hours.plannedHours : "0.0";
    const completedHrs = progress.hours ? progress.hours.completedHours : "0.0";
    const elHours = document.getElementById('analytics-hours-num');
    if (elHours) elHours.textContent = `${completedHrs} / ${plannedHrs} hrs`;

    // Quiz Performance Average
    const avgScore = progress.assessment ? progress.assessment.averageScore : 0;
    const quizzesTaken = progress.assessment ? progress.assessment.quizzesTaken : 0;
    const elQuizScore = document.getElementById('analytics-quiz-score-num');
    if (elQuizScore) elQuizScore.textContent = `${avgScore}%`;

    const elQuizzesCount = document.getElementById('analytics-quizzes-count');
    if (elQuizzesCount) elQuizzesCount.textContent = `${quizzesTaken} Quiz Attempt${quizzesTaken === 1 ? '' : 's'}`;

    // Today's Status Card
    const todayData = progress.today || {};
    const elTodayBadge = document.getElementById('analytics-today-badge');
    if (elTodayBadge) {
      if (todayData.isCompleted) {
        elTodayBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        elTodayBadge.style.color = 'var(--accent-emerald)';
        elTodayBadge.textContent = '✓ Today\'s Work Completed';
      } else {
        elTodayBadge.style.background = 'rgba(6, 182, 212, 0.2)';
        elTodayBadge.style.color = 'var(--accent-cyan)';
        elTodayBadge.textContent = '👉 TODAY\'S LEARNING';
      }
    }

    const elTodayDate = document.getElementById('analytics-today-date');
    if (elTodayDate) elTodayDate.textContent = `Calendar Date: ${todayData.calendarDate || 'Today'}`;

    const elTodayTasks = document.getElementById('analytics-today-tasks');
    if (elTodayTasks) elTodayTasks.textContent = `Daily Tasks: ${todayData.tasksCompleted || 0} / ${todayData.tasksTotal || 3} completed`;

    const elTodayMode = document.getElementById('analytics-today-mode');
    if (elTodayMode) elTodayMode.textContent = `Completion Mode: ${todayData.completionMode ? (todayData.completionMode === 'quiz' ? 'Take Quiz' : 'Mark Complete Manually') : 'Not completed yet'}`;

    // Weekly Progression
    const weekData = progress.week || {};
    const elWeekLabel = document.getElementById('analytics-week-label');
    if (elWeekLabel) elWeekLabel.textContent = `Week ${weekData.weekNumber || 1} Progress (${weekData.completedDays || 0}/${weekData.totalDays || 0} days)`;
    const elWeekPct = document.getElementById('analytics-week-pct');
    if (elWeekPct) elWeekPct.textContent = `${weekData.percent || 0}%`;
    const elWeekFill = document.getElementById('analytics-week-fill');
    if (elWeekFill) elWeekFill.style.width = `${weekData.percent || 0}%`;

    // Monthly Progression
    const monthData = progress.month || {};
    const elMonthLabel = document.getElementById('analytics-month-label');
    if (elMonthLabel) elMonthLabel.textContent = `${monthData.monthName || 'Current Month'} (${monthData.completedDays || 0}/${monthData.totalDays || 0} days)`;
    const elMonthPct = document.getElementById('analytics-month-pct');
    if (elMonthPct) elMonthPct.textContent = `${monthData.percent || 0}%`;
    const elMonthFill = document.getElementById('analytics-month-fill');
    if (elMonthFill) elMonthFill.style.width = `${monthData.percent || 0}%`;

    // Sunday Revision Status
    const revData = progress.revision || {};
    const elRevCount = document.getElementById('analytics-revision-count');
    if (elRevCount) elRevCount.textContent = `Topics Needing Revision: ${revData.requiredTopicsCount || 0}`;

    const elRevMsg = document.getElementById('analytics-revision-status-msg');
    if (elRevMsg) {
      if (revData.requiredTopicsCount > 0) {
        elRevMsg.style.color = '#f87171';
        elRevMsg.textContent = `🔴 ${revData.requiredTopicsCount} weak topic(s) scheduled for Sunday revision based on quiz performance.`;
      } else {
        elRevMsg.style.color = 'var(--accent-emerald)';
        elRevMsg.textContent = `✓ Great job! No quiz-based revision required.`;
      }
    }
  }

  function renderProgressAnalytics(grade, state) {
    fetchAndRenderUserProgress();
  }

  document.getElementById('continue-learning-btn').addEventListener('click', () => {
    const curSpec = window.currentSelectedDaySpec || {};
    const nextSpec = {
      ...curSpec,
      day: (curSpec.day || window.currentActiveDay || 1) + 1
    };
    renderDailyHub(nextSpec);
    switchView('dailyHub');
  });

  // ==========================================
  // TECH NEWS VIEW RENDERER (UNPERSONALIZED)
  // ==========================================
  const TECH_NEWS_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'ai', label: 'Artificial Intelligence' },
    { id: 'machine-learning', label: 'Machine Learning' },
    { id: 'data-science', label: 'Data Science' },
    { id: 'full-stack', label: 'Full-Stack Web Development' },
    { id: 'cloud-devops', label: 'Cloud & DevOps' },
    { id: 'cybersecurity', label: 'Cybersecurity' },
    { id: 'mobile-development', label: 'Mobile Development' }
  ];

  let activeNewsFilter = 'all';
  let activeNewsSort = 'latest';

  async function renderTechNewsView(searchQuery = '', filterId = activeNewsFilter, sort = activeNewsSort) {
    activeNewsFilter = filterId;
    activeNewsSort = sort;

    const cardsGrid = document.getElementById('tech-news-grid-container');
    const categoryPillsContainer = document.getElementById('tech-news-category-pills');
    const sortSelect = document.getElementById('tech-news-sort-select');

    if (sortSelect && sortSelect.value !== activeNewsSort) {
      sortSelect.value = activeNewsSort;
    }

    // Render 8 Filter Pills Dynamically
    if (categoryPillsContainer) {
      categoryPillsContainer.innerHTML = TECH_NEWS_FILTERS.map(f => {
        const isActive = f.id === activeNewsFilter;
        return `
          <button class="pill-btn news-filter-pill ${isActive ? 'active' : ''}" data-filter="${f.id}" style="padding: 0.4rem 0.95rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; border: 1px solid ${isActive ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.12)'}; background: ${isActive ? 'rgba(245, 158, 11, 0.22)' : 'rgba(255,255,255,0.05)'}; color: ${isActive ? 'var(--accent-amber)' : 'var(--text-muted)'}; cursor: pointer; transition: all 0.2s;">
            ${f.label}
          </button>
        `;
      }).join('');

      categoryPillsContainer.querySelectorAll('.news-filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          categoryPillsContainer.querySelectorAll('.news-filter-pill').forEach(p => {
            p.style.background = 'rgba(255,255,255,0.05)';
            p.style.color = 'var(--text-muted)';
            p.style.borderColor = 'rgba(255,255,255,0.12)';
            p.classList.remove('active');
          });
          pill.style.background = 'rgba(245, 158, 11, 0.22)';
          pill.style.color = 'var(--accent-amber)';
          pill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
          pill.classList.add('active');
          const fId = pill.getAttribute('data-filter') || 'all';
          const q = document.getElementById('tech-news-search-input')?.value.trim() || '';
          renderTechNewsView(q, fId, activeNewsSort);
        });
      });
    }

    if (!cardsGrid) return;

    const currentFilterLabel = TECH_NEWS_FILTERS.find(f => f.id === activeNewsFilter)?.label || 'All';

    // Loading State
    cardsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted);">
        <i class="ph ph-spinner spinner" style="font-size: 2.5rem; color: var(--accent-amber); display: block; margin: 0 auto 1rem;"></i>
        <p style="font-size: 1.05rem;">Fetching ${currentFilterLabel === 'All' ? 'real-world tech news' : `${currentFilterLabel} news`}...</p>
      </div>
    `;

    try {
      const queryParams = new URLSearchParams({
        domain: activeNewsFilter,
        sort: sort
      });

      if (searchQuery) queryParams.append('q', searchQuery);

      const apiHost = window.location.port === '5000' ? '' : 'http://localhost:5000';
      const res = await fetch(`${apiHost}/api/tech-news?${queryParams.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success || !Array.isArray(data.articles)) {
        const errorMsg = (data && data.error) ? data.error : 'Tech News is temporarily unavailable.';
        cardsGrid.innerHTML = `
          <div class="glass-card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(245, 158, 11, 0.3); border-radius: var(--radius-md);">
            <i class="ph ph-newspaper-clipping" style="font-size: 3rem; color: var(--accent-amber); margin-bottom: 0.8rem;"></i>
            <h3 style="font-size: 1.2rem; margin-bottom: 0.5rem;">Tech News is temporarily unavailable.</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 500px; margin: 0 auto 1.2rem;">${errorMsg} Please try again.</p>
            <button class="btn btn-primary" id="retry-tech-news-btn" style="background: var(--accent-amber); color: #000; border: none; font-weight: 700;">
              <i class="ph ph-arrows-clockwise"></i> Retry Fetching News
            </button>
          </div>
        `;
        document.getElementById('retry-tech-news-btn')?.addEventListener('click', () => {
          renderTechNewsView(searchQuery, filterId, sort);
        });
        return;
      }

      if (data.articles.length === 0) {
        cardsGrid.innerHTML = `
          <div class="glass-card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(255, 255, 255, 0.12); border-radius: var(--radius-md);">
            <i class="ph ph-magnifying-glass" style="font-size: 2.5rem; color: var(--accent-amber); margin-bottom: 0.8rem;"></i>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.4rem;">No relevant tech news found for this filter.</h3>
            <p style="color: var(--text-muted); font-size: 0.88rem;">Try another filter or search query.</p>
          </div>
        `;
        return;
      }

      cardsGrid.innerHTML = data.articles.map(article => {
        const timeDisplay = article.relativeTime || 'Recently';
        const imgHtml = article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" style="width: 100%; height: 160px; object-fit: cover; border-radius: var(--radius-sm); margin-bottom: 0.8rem;" onerror="this.style.display='none'"/>` : '';

        const topicBadgeHtml = article.topic ? `
          <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: var(--accent-amber); border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 20px;">
            Topic: ${article.topic}
          </span>
        ` : '';

        return `
          <div class="glass-card news-card" style="display: flex; flex-direction: column; justify-content: space-between; padding: 1.2rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); transition: transform 0.2s, border-color 0.2s;">
            <div>
              ${imgHtml}
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.78rem; color: var(--text-muted);">
                <span style="font-weight: 700; color: var(--accent-amber);"><i class="ph ph-newspaper"></i> ${article.source || 'Tech Publisher'}</span>
                <span><i class="ph ph-clock"></i> ${timeDisplay}</span>
              </div>
              <h4 style="font-size: 1.05rem; font-weight: 700; line-height: 1.35; margin-bottom: 0.6rem; color: var(--text-primary);">${article.title}</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.8rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                ${article.description || 'Click Read Article to view full story from original publisher.'}
              </p>
            </div>
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.8rem; flex-wrap: wrap; gap: 0.3rem;">
                ${topicBadgeHtml}
              </div>
              <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="width: 100%; text-align: center; justify-content: center; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; padding: 0.55rem; background: rgba(245, 158, 11, 0.1); color: var(--accent-amber); border: 1px solid rgba(245, 158, 11, 0.3);">
                Read Article <i class="ph ph-arrow-square-out"></i>
              </a>
            </div>
          </div>
        `;
      }).join('');

    } catch (e) {
      console.error('[Tech News Error]', e);
      cardsGrid.innerHTML = `
        <div class="glass-card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center;">
          <i class="ph ph-warning-circle" style="font-size: 3rem; color: var(--accent-rose); margin-bottom: 0.8rem;"></i>
          <h3 style="font-size: 1.2rem; margin-bottom: 0.5rem;">Tech News is temporarily unavailable.</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 500px; margin: 0 auto 1.2rem;">${e.message || 'Unable to connect to backend service.'} Please try again.</p>
          <button class="btn btn-primary" id="retry-tech-news-btn" style="background: var(--accent-amber); color: #000; border: none; font-weight: 700;">
            <i class="ph ph-arrows-clockwise"></i> Retry Fetching News
          </button>
        </div>
      `;
      document.getElementById('retry-tech-news-btn')?.addEventListener('click', () => {
        renderTechNewsView(searchQuery, filterId, sort);
      });
    }
  }

  // Bind News Search & Sort
  document.getElementById('tech-news-search-btn')?.addEventListener('click', () => {
    const q = document.getElementById('tech-news-search-input')?.value.trim() || '';
    renderTechNewsView(q, activeNewsFilter, activeNewsSort);
  });

  document.getElementById('tech-news-search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      renderTechNewsView(q, activeNewsFilter, activeNewsSort);
    }
  });

  document.getElementById('tech-news-sort-select')?.addEventListener('change', (e) => {
    const sortVal = e.target.value;
    const q = document.getElementById('tech-news-search-input')?.value.trim() || '';
    renderTechNewsView(q, activeNewsFilter, sortVal);
  });

  // ==========================================
  // INTERNSHIPS VIEW RENDERER
  // ==========================================
  let internshipCache = null;
  let activeInternshipFilter = 'All';

  async function renderInternshipsView(searchQuery = '', filterType = activeInternshipFilter) {
    activeInternshipFilter = filterType;
    const cardsGrid = document.getElementById('internships-grid-container');
    const domainBadge = document.getElementById('internship-domain-badge');
    const filterPillsContainer = document.getElementById('internship-filter-pills');

    const activeSession = supervisor.authAgent.getActiveSession();
    const domainKey = (activeSession && (activeSession.chosen_domain || activeSession.domainId)) ||
                      (window.currentDraftProfile && window.currentDraftProfile.chosen_domain) ||
                      'fullstack';

    const domainObj = window.PLACIFY_DATA ? window.PLACIFY_DATA.findDomain(domainKey) : null;
    const domainDisplayName = domainObj ? domainObj.name : domainKey.replace(/_/g, ' ').toUpperCase();

    if (domainBadge) {
      domainBadge.textContent = domainDisplayName;
    }

    // Render filter pills if container is empty
    if (filterPillsContainer && filterPillsContainer.children.length === 0) {
      const filters = ['All', 'Remote', 'Latest', 'Relevant'];
      filterPillsContainer.innerHTML = filters.map(f => `
        <button class="pill-btn internship-filter-pill ${f === activeInternshipFilter ? 'active' : ''}" data-filter="${f}" style="padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.78rem; font-weight: 600; border: 1px solid rgba(255,255,255,0.12); background: ${f === activeInternshipFilter ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.05)'}; color: ${f === activeInternshipFilter ? 'var(--accent-blue)' : 'var(--text-muted)'}; cursor: pointer;">
          ${f}
        </button>
      `).join('');

      filterPillsContainer.querySelectorAll('.internship-filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          filterPillsContainer.querySelectorAll('.internship-filter-pill').forEach(p => {
            p.style.background = 'rgba(255,255,255,0.05)';
            p.style.color = 'var(--text-muted)';
            p.classList.remove('active');
          });
          pill.style.background = 'rgba(59, 130, 246, 0.25)';
          pill.style.color = 'var(--accent-blue)';
          pill.classList.add('active');
          const f = pill.getAttribute('data-filter') || 'All';
          const q = document.getElementById('internship-search-input')?.value.trim() || '';
          renderInternshipsView(q, f);
        });
      });
    }

    if (!cardsGrid) return;

    cardsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted);">
        <i class="ph ph-spinner spinner" style="font-size: 2.5rem; color: var(--accent-blue); display: block; margin: 0 auto 1rem;"></i>
        <p style="font-size: 1.05rem;">Fetching verified internship listings personalized for <strong>${domainDisplayName}</strong>...</p>
      </div>
    `;

    try {
      const queryParams = new URLSearchParams({ domain: domainKey });
      if (searchQuery) queryParams.append('q', searchQuery);

      const userId = activeSession ? activeSession.user_id : null;
      if (userId) queryParams.append('user_id', userId);

      const res = await fetch(`http://localhost:5000/api/internships?${queryParams.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success || !Array.isArray(data.internships) || data.internships.length === 0) {
        const errorMsg = (data && data.error) ? data.error : 'No active internship listings found for this domain.';
        cardsGrid.innerHTML = `
          <div class="glass-card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(59, 130, 246, 0.3); border-radius: var(--radius-md);">
            <i class="ph ph-briefcase" style="font-size: 3rem; color: var(--accent-blue); margin-bottom: 0.8rem;"></i>
            <h3 style="font-size: 1.2rem; margin-bottom: 0.5rem;">Internships Unavailable</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 500px; margin: 0 auto 1.2rem;">${errorMsg}</p>
            <button class="btn btn-primary" id="retry-internships-btn" style="background: var(--accent-blue); color: #fff; border: none;">
              <i class="ph ph-arrows-clockwise"></i> Retry Fetching Internships
            </button>
          </div>
        `;
        document.getElementById('retry-internships-btn')?.addEventListener('click', () => {
          renderInternshipsView(searchQuery, filterType);
        });
        return;
      }

      internshipCache = data.internships;

      let filtered = data.internships;
      if (filterType === 'Remote') {
        filtered = filtered.filter(i => i.remote === true || (i.location || '').toLowerCase().includes('remote'));
      } else if (filterType === 'Latest') {
        filtered = [...filtered].sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0));
      } else if (filterType === 'Relevant') {
        filtered = [...filtered].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      }

      if (filtered.length === 0) {
        cardsGrid.innerHTML = `
          <div class="glass-card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center;">
            <i class="ph ph-magnifying-glass" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 0.5rem;"></i>
            <p style="color: var(--text-muted);">No internship listings match filter "${filterType}". Try selecting "All".</p>
          </div>
        `;
        return;
      }

      cardsGrid.innerHTML = filtered.map(item => {
        const postedDate = item.postedAt ? new Date(item.postedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';

        const skillsPills = (item.skills || []).slice(0, 4).map(s => `
          <span style="font-size: 0.72rem; background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.25);">
            ${s}
          </span>
        `).join('');

        return `
          <div class="glass-card internship-card" style="display: flex; flex-direction: column; justify-content: space-between; padding: 1.3rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); transition: transform 0.2s, border-color 0.2s;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
                <h4 style="font-size: 1.1rem; font-weight: 700; line-height: 1.3; color: var(--text-primary); margin: 0;">${item.title}</h4>
                ${item.remote ? `<span style="background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; white-space: nowrap;"><i class="ph ph-globe"></i> REMOTE</span>` : ''}
              </div>
              
              <div style="font-size: 0.88rem; font-weight: 600; color: var(--accent-cyan); margin-bottom: 0.6rem;">
                <i class="ph ph-buildings"></i> ${item.company || 'Company Confidential'}
              </div>

              <div style="display: flex; flex-wrap: wrap; gap: 0.8rem; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.8rem;">
                <span><i class="ph ph-map-pin"></i> ${item.location || 'India'}</span>
                <span><i class="ph ph-clock"></i> Posted: ${postedDate}</span>
                <span><i class="ph ph-currency-circle-dollar"></i> ${item.salary || 'Not specified'}</span>
              </div>

              <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin-bottom: 0.8rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                ${item.description || 'No detailed description available.'}
              </p>
            </div>

            <div>
              ${skillsPills ? `<div style="display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.8rem;">${skillsPills}</div>` : ''}
              
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.8rem;">
                <span style="font-size: 0.72rem; color: var(--text-muted);">Source: ${item.source || 'Adzuna'}</span>
                ${item.relevanceReason ? `<span style="font-size: 0.72rem; color: var(--accent-cyan); font-style: italic;"><i class="ph ph-sparkle"></i> ${item.relevanceReason}</span>` : ''}
              </div>

              <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="width: 100%; text-align: center; justify-content: center; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.88rem; padding: 0.6rem; background: var(--accent-blue); color: #fff; border: none;">
                Apply Now <i class="ph ph-arrow-square-out"></i>
              </a>
            </div>
          </div>
        `;
      }).join('');

    } catch (e) {
      console.error('[Internships Error]', e);
      cardsGrid.innerHTML = `
        <div class="glass-card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center;">
          <i class="ph ph-warning-circle" style="font-size: 3rem; color: var(--accent-rose); margin-bottom: 0.8rem;"></i>
          <h3 style="font-size: 1.2rem; margin-bottom: 0.5rem;">Internships Connection Error</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 500px; margin: 0 auto 1.2rem;">${e.message || 'Unable to connect to backend service.'}</p>
          <button class="btn btn-primary" id="retry-internships-btn">
            <i class="ph ph-arrows-clockwise"></i> Retry
          </button>
        </div>
      `;
      document.getElementById('retry-internships-btn')?.addEventListener('click', () => {
        renderInternshipsView(searchQuery, filterType);
      });
    }
  }

  // Bind Internships Search
  document.getElementById('internship-search-btn')?.addEventListener('click', () => {
    const q = document.getElementById('internship-search-input')?.value.trim() || '';
    renderInternshipsView(q, activeInternshipFilter);
  });

  document.getElementById('internship-search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      renderInternshipsView(q, activeInternshipFilter);
    }
  });

  // Reset State Handler
  document.getElementById('reset-app-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset your Placify learning profile and restart onboarding?')) {
      supervisor.progressTracker.resetState();
      location.reload();
    }
  });

  // INITIAL STATE BOOTSTRAP
  if (!activeSession) {
    switchView('onboarding');
  }
});
