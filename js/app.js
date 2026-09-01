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
    progressAnalytics: document.getElementById('view-progress-analytics')
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

  function renderDomainSelectionScreen(userName) {
    const grid = document.getElementById('domain-selection-grid');
    const subtitle = document.getElementById('domain-selection-subtitle');
    if (!grid) return;

    selectedDomainId = null;

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

    grid.querySelectorAll('.domain-card').forEach(card => {
      card.addEventListener('click', () => {
        grid.querySelectorAll('.domain-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedDomainId = card.dataset.id;
        const errEl = document.getElementById('domain-select-error');
        if (errEl) errEl.style.display = 'none';
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
    const timeline_months = parseInt(document.getElementById('timeline-months').value, 10);
    const daily_hours = parseFloat(document.getElementById('daily-hours').value);

    if (isNaN(timeline_months) || timeline_months < 1) {
      regAlert.textContent = 'Please enter a valid preparation timeline in months (minimum 1 month).';
      regAlert.style.display = 'flex';
      return;
    }

    if (isNaN(daily_hours) || daily_hours <= 0) {
      regAlert.textContent = 'Please enter a valid daily commitment in hours per day (minimum 0.5 hours).';
      regAlert.style.display = 'flex';
      return;
    }

    try {
      // 1. Authenticate / Register via AuthAgent (no domain yet)
      const profile = await supervisor.registerUser({
        name,
        email,
        password,
        timeline_months,
        daily_hours
      });

      updateHeaderUserPill(profile);

      // Save active draft profile for Supervisor
      window.currentDraftProfile = {
        user_id: profile.user_id,
        name: profile.name,
        domainId: null,
        chosen_domain: null,
        timelineMonths: profile.timeline_months,
        dailyHours: profile.daily_hours
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

        const res = await fetch(`http://localhost:5000/api/user/${userId}/domain`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chosen_domain: selectedDomainId })
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
      activeDiagnostics = shuffleArray(allDiagnostics).slice(0, selectedQuestionCount);
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

    // Show automatic roadmap generation loading overlay
    const overlay = document.getElementById('roadmap-loading-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
      // Attach user's declared self-assessed level along with answers
      const quizPayload = {
        answers: diagnosticUserAnswers,
        declaredSelfLevel: selectedSelfLevel
      };
      const result = await supervisor.startLearningJourney(window.currentDraftProfile, quizPayload);
      
      // Hide loading overlay
      if (overlay) overlay.style.display = 'none';

      // Render Assessment Report & Render Roadmap
      renderAssessmentReport(result.evaluation, result.personalizedRoadmap);
      await renderRoadmapView(result.personalizedRoadmap);
      updateHeaderStats();

      // Display Diagnostic Evaluation & Topic-Wise Proficiency Report page first!
      switchView('assessmentReport');

    } catch (err) {
      if (overlay) overlay.style.display = 'none';
      console.error('Error during quiz evaluation and roadmap generation:', err);
      alert('Error generating roadmap: ' + err.message);
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

      try {
        console.log(`[Frontend Quiz Gen] Requesting ${selectedQuestionCount} questions for domain ${chosenDomain} at level ${selectedSelfLevel}...`);
        const res = await fetch('http://localhost:5000/api/quiz/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
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
        alert('Could not generate dynamic quiz: ' + err.message + '\n\nFalling back to domain diagnostic pool.');
        renderDiagnosticQuiz(chosenDomain);
        if (quizWrapper) {
          quizWrapper.style.display = 'block';
          quizWrapper.scrollIntoView({ behavior: 'smooth' });
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
        const result = await supervisor.startLearningJourney(window.currentDraftProfile, selfAssessmentPayload);
        if (overlay) overlay.style.display = 'none';

        renderAssessmentReport(result.evaluation, result.personalizedRoadmap);
        await renderRoadmapView(result.personalizedRoadmap);
        updateHeaderStats();

        switchView('assessmentReport');
      } catch (err) {
        if (overlay) overlay.style.display = 'none';
        console.error('Error submitting self assessment:', err);
        alert('Error generating roadmap: ' + err.message);
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

    if (evaluation.isSelfAssessed || evaluation.is_self_assessed) {
      if (scoreDisplay) {
        scoreDisplay.textContent = 'SELF';
        scoreDisplay.style.fontSize = '1.3rem';
      }
      if (summaryDisplay) {
        summaryDisplay.textContent = `Baseline established via User Self-Assessment (${skillTierVal}). Dynamic roadmap configured to match declared proficiency.`;
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

    if (weakList.length === 0) {
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
      if (intermediateList.length === 0) {
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
    document.getElementById('mastered-count-num').textContent = strongList.length;

    if (strongList.length === 0) {
      masteredContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">No topics marked as strong/mastered yet.</div>`;
    } else {
      masteredContainer.innerHTML = strongList.map(item => `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; margin-bottom: 0.5rem; font-size: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: var(--accent-emerald);"><i class="ph ph-check-circle"></i> ${item.topic}</strong>
            <span style="font-size: 0.75rem; background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700;">STRONG (${item.score_pct !== undefined ? item.score_pct : (item.accuracy_pct || 100)}%)</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">Verified Prerequisite. Ready for advanced topics.</div>
        </div>
      `).join('');
    }

    // TOPIC PROFICIENCY TABLE
    const tableContainer = document.getElementById('topic-proficiency-table-container');
    if (tableContainer && evaluation.topicEvaluations) {
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
              if (t.proficiencyLevel === 'STRONG') {
                badgeColor = 'var(--accent-emerald)';
                badgeBg = 'rgba(16, 185, 129, 0.15)';
              } else if (t.proficiencyLevel === 'INTERMEDIATE') {
                badgeColor = '#f59e0b';
                badgeBg = 'rgba(245, 158, 11, 0.15)';
              }
              return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 0.7rem 0.8rem; font-weight: 600;">${t.topic}</td>
                  <td style="padding: 0.7rem 0.8rem;">${t.correctAnswers}/${t.totalQuestions}</td>
                  <td style="padding: 0.7rem 0.8rem; font-weight: 700;">${t.accuracy}%</td>
                  <td style="padding: 0.7rem 0.8rem; font-size: 0.8rem; color: var(--text-muted);">
                    Beg: <span style="color: #fff;">${t.beginnerAccuracy !== undefined ? t.beginnerAccuracy : 100}%</span> | 
                    Int: <span style="color: #fff;">${t.intermediateAccuracy !== undefined ? t.intermediateAccuracy : 100}%</span> | 
                    Adv: <span style="color: #fff;">${t.advancedAccuracy !== undefined ? t.advancedAccuracy : 0}%</span>
                  </td>
                  <td style="padding: 0.7rem 0.8rem;">
                    <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">${t.proficiencyLevel}</span>
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

  document.getElementById('build-roadmap-btn').addEventListener('click', async () => {
    const state = supervisor.progressTracker.getUserState();
    await renderRoadmapView(state.personalizedRoadmap);
    switchView('roadmap');
  });

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
              const res = await fetch('http://localhost:5000/api/roadmap/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, start_date: clientSystemDate })
              });
              const data = await res.json();
              if (data.success) {
                roadmap.journey_started = true;
                roadmap.journey_start_date = data.journey_start_date;
                if (activeSession) {
                  activeSession.journey_started = true;
                  activeSession.journey_start_date = data.journey_start_date;
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
    document.getElementById('rm-summary-timeline').textContent = `${roadmap.timeline_months || 4} Months`;
    document.getElementById('rm-summary-hours').textContent = `${roadmap.daily_hours || 2.0} Hours / Day`;
    
    let scoreDisplay = roadmap.quiz_score !== null && roadmap.quiz_score !== undefined ? `${roadmap.quiz_score}%` : 'Unassessed';
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

    if (monthlyList.length === 0 && roadmap.milestones) {
      // Legacy milestones fallback render
      container.innerHTML = roadmap.milestones.map((m, idx) => `
        <div class="roadmap-node ${m.type} ${m.status}">
          <div>
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.3rem;">
              <span class="node-tag ${m.type}">${m.type}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Week ${m.targetWeek}</span>
            </div>
            <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">${m.title}</h4>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
              ${m.skipReason || m.reason || `Target Topic: ${m.topic}`}
            </p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.8rem; font-weight: 600; color: var(--accent-cyan);">${m.estHours} hrs</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${m.status}</div>
          </div>
        </div>
      `).join('');
      return;
    }

    if (monthlyList.length === 0) {
      container.innerHTML = `<div style="padding: 2rem; color: var(--text-muted);">No monthly data available in roadmap.</div>`;
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

      return `
        <div class="glass-card month-card" data-midx="${idx}" style="margin-bottom: 1.2rem; border-left: 4px solid ${priorityColor}; cursor: pointer; transition: transform 0.2s, border-color 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.6rem;">
            <div>
              <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.3rem; flex-wrap: wrap;">
                <span class="node-tag ${m.priority === 'HIGH' ? 'REMEDIAL' : 'STANDARD'}">Month ${m.month_number}</span>
                <span class="tier-badge ${m.difficulty || 'INTERMEDIATE'}">${m.difficulty || 'INTERMEDIATE'}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${m.weeks ? m.weeks.length : 4} Weeks</span>
                ${isStarted && monthStartDate && monthEndDate ? `
                  <span style="font-size: 0.78rem; font-weight: 700; color: var(--accent-cyan); background: rgba(6, 182, 212, 0.12); padding: 0.15rem 0.6rem; border-radius: 4px;">
                    📅 ${formatDateRange(monthStartDate, monthEndDate)}
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

        return `
          <div class="glass-card week-card" data-widx="${idx}" style="margin-bottom: 1rem; cursor: pointer; border-left: 4px solid var(--accent-violet);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.6rem;">
              <div>
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.3rem; flex-wrap: wrap;">
                  <span class="node-tag STANDARD">Week ${w.week_number}</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">${w.days ? w.days.length : 7} Days</span>
                  ${isStarted && weekStartDate && weekEndDate ? `
                    <span style="font-size: 0.78rem; font-weight: 700; color: var(--accent-violet); background: rgba(139, 92, 246, 0.15); padding: 0.15rem 0.6rem; border-radius: 4px;">
                      📅 ${formatDateRange(weekStartDate, weekEndDate)}
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
        const overallDayOffset = (weekObj.week_number - 1) * 7 + (d.day_number - 1);
        const dayDateObj = isStarted && startDate ? addDaysToDate(startDate, overallDayOffset) : null;
        const dayFormatted = dayDateObj ? formatDateLong(dayDateObj) : (d.day_name || 'Day ' + d.day_number);
        const isToday = dayDateObj ? isSameCalendarDay(dayDateObj, new Date()) : false;

        return `
          <div class="glass-card" style="margin-bottom: 1.2rem; border-left: 4px solid ${isToday ? 'var(--accent-cyan)' : 'var(--accent-emerald)'}; ${isToday ? 'box-shadow: 0 0 15px rgba(6, 182, 212, 0.2);' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <span style="font-size: 0.85rem; font-weight: 700; background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); padding: 0.2rem 0.6rem; border-radius: 4px;">
                  Day ${d.day_number}
                </span>
                <strong style="font-size: 1rem; color: #fff;">${dayFormatted}</strong>
                ${isToday ? `
                  <span style="font-size: 0.72rem; font-weight: 800; background: var(--accent-cyan); color: #000; padding: 0.15rem 0.5rem; border-radius: 4px;">
                    TODAY
                  </span>
                ` : ''}
                <span style="font-size: 0.85rem; color: var(--text-muted);">(${d.topic || weekObj.topics[0]})</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.8rem;">
                <span style="font-size: 0.82rem; font-weight: 700; color: var(--accent-cyan);">
                  ⏱️ ${d.total_minutes} Mins Workload
                </span>
                <button class="btn btn-emerald launch-day-hub-btn" 
                  data-roadmap-id="${roadmap.roadmap_id || roadmap._id || roadmap.id || ''}" 
                  data-month="${monthObj.month_number || 1}" 
                  data-week="${weekObj.week_number || 1}" 
                  data-day="${d.day_number}" 
                  data-day-id="${d.id || d.day_id || ''}" 
                  style="padding: 0.35rem 0.75rem; font-size: 0.78rem;">
                  Launch Day ${d.day_number} Tasks <i class="ph ph-arrow-right"></i>
                </button>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
              ${(d.tasks || []).map(t => {
                let typeClass = 'STANDARD';
                if (t.type === 'PRACTICE' || t.type === 'IMPLEMENT') typeClass = 'REMEDIAL';
                else if (t.type === 'PROBLEM_SOLVING' || t.type === 'PROJECT') typeClass = 'SKIPPED';

                return `
                  <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.7rem 0.9rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                      <div style="display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.2rem;">
                        <span class="node-tag ${typeClass}" style="font-size: 0.7rem; padding: 0.1rem 0.4rem;">${t.type}</span>
                        <span class="tier-badge ${t.difficulty || 'INTERMEDIATE'}" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">${t.difficulty || 'INT'}</span>
                        <span style="font-size: 0.85rem; font-weight: 700; color: #fff;">${t.title}</span>
                      </div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">
                        ${t.practice_details || t.revision_details || 'Core daily learning task.'}
                      </div>
                    </div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-amber);">
                      ⏱️ ${t.estimated_minutes} mins
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

      const res = await fetch('http://localhost:5000/api/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
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
    let savedSpec = null;
    try {
      const raw = localStorage.getItem('placify_selected_day_spec');
      if (raw) savedSpec = JSON.parse(raw);
    } catch(e) {}
    renderDailyHub(savedSpec || { month: 1, week: 1, day: 1 });
    switchView('dailyHub');
  });

  // =========================================================================
  // VIEW 5: DAILY LEARNING HUB
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

    // Bulletproof roadmap resolution from memory, state, or localStorage
    let roadmap = window.activePersonalizedRoadmap;
    if (!roadmap) {
      const state = supervisor.progressTracker.getUserState();
      roadmap = state ? state.personalizedRoadmap : null;
    }
    if (!roadmap) {
      try {
        const storedState = localStorage.getItem('placify_user_state');
        if (storedState) {
          const parsed = JSON.parse(storedState);
          roadmap = parsed.personalizedRoadmap || parsed.roadmap;
        }
      } catch (e) {}
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

    const dayTopic = dayObj ? (dayObj.topic || 'Core Learning') : (dailyData && dailyData.task ? dailyData.task.topic : 'Core Learning');
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

    const resList = document.getElementById('suggested-resources-list');
    if (!resList) return;

    resList.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);"><i class="ph ph-spinner spinner"></i> Loading Day ${targetDayNum} tasks and curated learning resources...</div>`;

    try {
      const userId = activeSession ? activeSession.user_id : (window.currentDraftProfile ? window.currentDraftProfile.user_id : null);

      if (dayTasksList.length === 0) {
        dayTasksList = [
          {
            id: `task_day_${targetDayNum}_1`,
            title: dailyData.task.conceptTitle || `Learn: ${dayTopic}`,
            type: dailyData.task.type || 'LEARN',
            difficulty: userLevel,
            estimated_minutes: dailyData.task.estHours ? Math.round(dailyData.task.estHours * 60) : 45,
            practice_details: dailyData.task.summary || 'Core daily learning task.'
          }
        ];
      }

      let fullHTML = '';

      for (let tIdx = 0; tIdx < dayTasksList.length; tIdx++) {
        const taskItem = dayTasksList[tIdx];
        let typeClass = 'STANDARD';
        if (taskItem.type === 'PRACTICE' || taskItem.type === 'IMPLEMENT') typeClass = 'REMEDIAL';
        else if (taskItem.type === 'PROBLEM_SOLVING' || taskItem.type === 'PROJECT') typeClass = 'SKIPPED';

        const taskTopic =
          taskItem.subtopic ||
          taskItem.topic ||
          taskItem.title ||
          dayTopic;

        const taskContext = {
          id: taskItem.id || `task_day_${targetDayNum}_${tIdx + 1}`,
          taskId: taskItem.id || `task_day_${targetDayNum}_${tIdx + 1}`,
          dayNumber: targetDayNum,

          title: taskItem.title,
          taskTitle: taskItem.title,

          topic: taskTopic,

          subtopic:
            taskItem.subtopic ||
            taskItem.topic ||
            taskItem.title ||
            dayTopic,

          dayTopic: dayTopic,

          dailyTopic: taskTopic,

          type: taskItem.type,
          taskType: taskItem.type,

          estimated_minutes: taskItem.estimated_minutes,
          taskDuration: taskItem.estimated_minutes,

          domain: domainKey,
          chosen_domain: domainKey,

          user_id: userId,

          userLevel:
            taskItem.difficulty || userLevel,

          difficulty:
            taskItem.difficulty || userLevel,

          description:
            taskItem.practice_details ||
            taskItem.revision_details ||
            taskItem.summary ||
            ''
        };

        console.log('[PHASE 1 RESOURCE CONTEXT]', {
          dayNumber: targetDayNum,
          dayTopic,
          taskId: taskContext.taskId,
          taskTitle: taskContext.taskTitle,
          taskType: taskContext.taskType,
          taskTopic: taskContext.topic,
          taskSubtopic: taskContext.subtopic,
          domain: taskContext.domain,
          difficulty: taskContext.difficulty
        });

        const taskResources = await supervisor.resourceSuggester.suggestResources(
          taskTopic,
          taskItem.difficulty || userLevel,
          taskContext
        );

        fullHTML += `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1.2rem; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.6rem;">
              <div>
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap;">
                  <span class="node-tag ${typeClass}" style="font-size: 0.75rem; padding: 0.15rem 0.5rem;">${taskItem.type || 'LEARN'}</span>
                  <span class="tier-badge ${taskItem.difficulty || userLevel}" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">${taskItem.difficulty || userLevel}</span>
                  <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff; margin: 0;">${taskItem.title}</h3>
                </div>
                <div style="font-size: 0.84rem; color: var(--text-muted); line-height: 1.4;">
                  ${taskItem.practice_details || taskItem.revision_details || taskItem.summary || 'Read conceptual overview, study examples, and execute practice code drills.'}
                </div>
              </div>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--accent-amber); white-space: nowrap;">
                ⏱️ ${taskItem.estimated_minutes || 30} mins
              </div>
            </div>

            <!-- RECOMMENDED RESOURCES FOR THIS SPECIFIC TASK -->
            <div style="margin-top: 1rem; padding-top: 0.8rem; border-top: 1px dashed rgba(255,255,255,0.1);">
              <h4 style="font-size: 0.86rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.7rem; display: flex; align-items: center; gap: 0.4rem;">
                <i class="ph ph-books"></i> Recommended Resources for Today's Task:
              </h4>

              <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                ${taskResources.map((r, idx) => `
                  <div class="resource-card" style="border-left: 4px solid ${idx === 0 ? 'var(--accent-emerald)' : (idx === 1 ? 'var(--accent-cyan)' : 'var(--accent-amber)')}; padding: 0.9rem; background: rgba(0,0,0,0.25); border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.4rem;">
                      <span class="node-tag ${r.category_label || (idx === 0 ? 'STANDARD' : 'REMEDIAL')}" style="font-size: 0.72rem; font-weight: 800;">
                        ⭐ ${r.category_label || (idx === 0 ? 'PRIMARY' : (idx === 1 ? 'ALTERNATIVE' : 'PRACTICE'))}
                      </span>
                      <span style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 600;">
                        ${r.is_official ? '🏛️ Official Documentation' : `Platform: ${r.platform}`}
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
                      <span style="font-size: 0.75rem; color: var(--text-muted);">${r.platform}</span>
                      <a href="${r.url}" target="_blank" rel="noopener noreferrer" class="btn btn-emerald" style="font-size: 0.78rem; padding: 0.3rem 0.75rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
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

    } catch (err) {
      console.warn('Error rendering personalized resources:', err);
      resList.innerHTML = `<div style="padding: 1rem; color: var(--text-muted);">Recommended resources are temporarily unavailable. You may continue with your task workbook below.</div>`;
    }

    updateHeaderStats();
  }

  document.getElementById('view-all-roadmap-btn').addEventListener('click', () => {
    const state = supervisor.progressTracker.getUserState();
    renderRoadmapView(state.personalizedRoadmap);
    switchView('roadmap');
  });

  document.getElementById('start-concept-quiz-btn').addEventListener('click', () => {
    const state = supervisor.progressTracker.getUserState();
    const task = state.personalizedRoadmap.dailyTasks.find(t => t.dayNumber === window.currentActiveDay) || state.personalizedRoadmap.dailyTasks[0];
    
    renderConceptQuiz(task.conceptTitle, task.topic);
    switchView('conceptQuiz');
  });

  // =========================================================================
  // VIEW 6: CONCEPT ASSESSMENT (RESOURCE FETCHER)
  // =========================================================================
  function renderConceptQuiz(conceptTitle, topic) {
    const quizData = supervisor.fetchTaskAssessment(conceptTitle, topic);
    window.currentAssessmentData = quizData;

    document.getElementById('quiz-grounded-summary').textContent = quizData.retrievedContentSummary;

    const container = document.getElementById('concept-quiz-questions-container');
    container.innerHTML = quizData.questions.map((q, idx) => `
      <div class="quiz-question-card" data-cqid="${q.id}">
        <div class="quiz-question-title">
          <span class="question-badge">Q${idx + 1}</span>
          <span>${q.question}</span>
        </div>
        <div class="quiz-options">
          ${q.options.map((opt, oIdx) => `
            <div class="option-btn" data-cqid="${q.id}" data-coidx="${oIdx}">
              <i class="ph ph-circle"></i> ${opt}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

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
  conceptQuizForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userAnswers = {};
    const questions = window.currentAssessmentData.questions;

    questions.forEach(q => {
      const selected = document.querySelector(`#concept-quiz-questions-container .option-btn.selected[data-cqid="${q.id}"]`);
      userAnswers[q.id] = selected ? parseInt(selected.dataset.coidx, 10) : -1;
    });

    const result = supervisor.submitTaskAssessment(window.currentActiveDay || 1, questions, userAnswers);
    renderProgressAnalytics(result.grade, result.updatedState);
    updateHeaderStats();
    switchView('progressAnalytics');
  });

  // =========================================================================
  // VIEW 7: PROGRESS & ANALYTICS
  // =========================================================================
  function renderProgressAnalytics(grade, state) {
    document.getElementById('analytics-mastery-num').textContent = `${state.masteryPct}%`;
    document.getElementById('analytics-streak-num').textContent = state.streak;
    document.getElementById('analytics-xp-num').textContent = state.xp;
    document.getElementById('analytics-tier-name').textContent = state.personalizedRoadmap ? state.personalizedRoadmap.skillTier : 'BEGINNER';
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
