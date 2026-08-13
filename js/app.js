/**
 * Placify Main Application UI Controller & Orchestration Wiring
 */

document.addEventListener('DOMContentLoaded', () => {
  const supervisor = window.placifySupervisor;

  // Global UI references
  const views = {
    onboarding: document.getElementById('view-onboarding'),
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

  tabRegBtn.addEventListener('click', () => {
    tabRegBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    panelReg.classList.add('active');
    panelLogin.classList.remove('active');
  });

  tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabRegBtn.classList.remove('active');
    panelLogin.classList.add('active');
    panelReg.classList.remove('active');
  });

  // Domain Grid Rendering
  function renderDomainGrid() {
    const grid = document.getElementById('domain-grid');
    const selectedInput = document.getElementById('selected-domain-id');

    grid.innerHTML = window.PLACIFY_DATA.domains.map((d, index) => `
      <div class="domain-card ${index === 0 ? 'selected' : ''}" data-id="${d.id}">
        <div class="domain-icon"><i class="ph ${d.icon}"></i></div>
        <h3>${d.name}</h3>
        <p>${d.description}</p>
      </div>
    `).join('');

    grid.querySelectorAll('.domain-card').forEach(card => {
      card.addEventListener('click', () => {
        grid.querySelectorAll('.domain-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedInput.value = card.dataset.id;
      });
    });
  }

  // Registration Form Handler
  const registrationForm = document.getElementById('registration-form');
  const regAlert = document.getElementById('reg-error-alert');

  registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regAlert.style.display = 'none';

    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const chosen_domain = document.getElementById('selected-domain-id').value;
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
      // 1. Authenticate / Register via AuthAgent
      const profile = await supervisor.registerUser({
        name,
        email,
        password,
        chosen_domain,
        timeline_months,
        daily_hours
      });

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

      // 2. POST-AUTH ACTION: Pass user_id and chosen_domain to quiz_evaluator
      renderDiagnosticQuiz(profile.chosen_domain);
      switchView('diagnostic');

    } catch (err) {
      regAlert.textContent = err.message || 'Registration failed.';
      regAlert.style.display = 'flex';
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

      // 2. POST-AUTH ACTION: Pass user_id and chosen_domain to quiz_evaluator
      renderDiagnosticQuiz(profile.chosen_domain);
      switchView('diagnostic');

    } catch (err) {
      // Render HTTP 401 Unauthorized clear message
      loginAlert.innerHTML = `
        <i class="ph ph-warning-octagon" style="font-size: 1.5rem; color: #f87171;"></i>
        <div>
          <strong style="color: #ef4444;">${err.status === 401 ? 'HTTP 401 Unauthorized' : 'Authentication Error'}</strong><br>
          <span style="font-size: 0.85rem;">${err.message || 'Invalid email or password credentials.'}</span>
        </div>
      `;
      loginAlert.style.display = 'flex';
    }
  });

  // =========================================================================
  // =========================================================================
  // VIEW 2: NPTEL-STYLE DIAGNOSTIC QUIZ RUNNER
  // =========================================================================
  let currentDiagnosticIndex = 0;
  let currentDiagnosticDomainObj = null;
  let diagnosticUserAnswers = {};

  function renderDiagnosticQuiz(domainId) {
    const domain = window.PLACIFY_DATA.findDomain(domainId);
    currentDiagnosticDomainObj = domain;
    currentDiagnosticIndex = 0;
    diagnosticUserAnswers = {};

    const container = document.getElementById('diagnostic-questions-container');
    const paletteContainer = document.getElementById('diagnostic-palette-container');
    const countBadge = document.getElementById('diagnostic-concept-count-badge');

    if (countBadge) {
      countBadge.textContent = `${domain.diagnostics.length} Questions`;
    }

    // Render Palette Buttons
    if (paletteContainer) {
      paletteContainer.innerHTML = domain.diagnostics.map((q, idx) => `
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

    // Render Question Cards
    container.innerHTML = domain.diagnostics.map((q, idx) => {
      const qType = q.type || 'MCQ';
      const isMSQ = qType === 'MSQ';
      const isNumerical = qType === 'NUMERICAL';

      let typeBadgeColor = 'var(--accent-violet)';
      if (isMSQ) typeBadgeColor = '#f59e0b';
      else if (isNumerical) typeBadgeColor = '#3b82f6';
      else if (qType === 'CODE_OUTPUT') typeBadgeColor = '#ec4899';
      else if (qType === 'SCENARIO_BASED') typeBadgeColor = '#10b981';

      return `
        <div class="quiz-question-card" data-qid="${q.id}" data-qidx="${idx}" style="display: ${idx === 0 ? 'block' : 'none'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
              <span class="question-badge" style="background: rgba(139, 92, 246, 0.2); color: var(--accent-violet); padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.8rem;">Q${idx + 1} / ${domain.diagnostics.length}</span>
              <span style="font-size: 0.75rem; background: rgba(255, 255, 255, 0.1); color: var(--text-muted); padding: 0.2rem 0.5rem; border-radius: 4px;">${q.topic}</span>
              <span style="font-size: 0.75rem; background: rgba(255, 255, 255, 0.05); color: var(--text-muted); padding: 0.2rem 0.5rem; border-radius: 4px;">${q.subtopic || 'Core Concept'}</span>
            </div>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <span style="font-size: 0.75rem; background: rgba(255,255,255,0.08); color: ${typeBadgeColor}; padding: 0.2rem 0.6rem; border-radius: 50px; font-weight: 700;">${qType}</span>
              <span class="tier-badge ${q.difficulty}" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">${q.difficulty}</span>
            </div>
          </div>

          <div class="quiz-question-title" style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; line-height: 1.5;">
            ${q.question}
          </div>

          ${q.codeSnippet ? `
            <pre style="background: rgba(0,0,0,0.5); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); overflow-x: auto; font-family: monospace; font-size: 0.85rem; color: #a7f3d0; margin-bottom: 1rem;"><code>${q.codeSnippet}</code></pre>
          ` : ''}

          <!-- OPTIONS OR NUMERICAL INPUT -->
          <div class="quiz-options">
            ${isNumerical ? `
              <div style="margin-top: 0.5rem;">
                <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.4rem;">Enter Numerical Answer:</label>
                <input type="number" step="any" class="form-input numerical-input" data-qid="${q.id}" placeholder="e.g. 10 or 0.5" style="max-width: 300px;">
              </div>
            ` : (isMSQ ? `
              <div style="font-size: 0.8rem; color: #f59e0b; font-weight: 600; margin-bottom: 0.6rem;">Select ALL correct answers:</div>
              ${q.options.map((opt, oIdx) => `
                <label class="option-btn msq-option-btn" data-qid="${q.id}" data-oidx="${oIdx}" style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; padding: 0.7rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); margin-bottom: 0.5rem;">
                  <input type="checkbox" class="msq-checkbox" data-qid="${q.id}" data-oidx="${oIdx}" style="width: 18px; height: 18px; accent-color: var(--accent-violet);">
                  <span class="opt-text">${opt}</span>
                </label>
              `).join('')}
            ` : `
              ${q.options.map((opt, oIdx) => `
                <div class="option-btn" data-qid="${q.id}" data-oidx="${oIdx}">
                  <i class="ph ph-circle"></i> <span class="opt-text">${opt}</span>
                </div>
              `).join('')}
            `)}
          </div>
        </div>
      `;
    }).join('');

    updateDiagnosticControls();

    // Attach Event Handlers for Options / Numerical / MSQ
    container.onchange = function(e) {
      if (e.target.classList.contains('numerical-input')) {
        const qid = e.target.dataset.qid;
        diagnosticUserAnswers[qid] = e.target.value.trim();
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

  function showDiagnosticQuestion(index) {
    if (!currentDiagnosticDomainObj || index < 0 || index >= currentDiagnosticDomainObj.diagnostics.length) return;
    currentDiagnosticIndex = index;

    const cards = document.querySelectorAll('#diagnostic-questions-container .quiz-question-card');
    cards.forEach((card, idx) => {
      card.style.display = (idx === index) ? 'block' : 'none';
    });

    updateDiagnosticControls();
  }

  function updateDiagnosticControls() {
    if (!currentDiagnosticDomainObj) return;
    const total = currentDiagnosticDomainObj.diagnostics.length;
    const prevBtn = document.getElementById('quiz-prev-btn');
    const nextBtn = document.getElementById('quiz-next-btn');

    if (prevBtn) prevBtn.style.display = currentDiagnosticIndex > 0 ? 'inline-flex' : 'none';
    if (nextBtn) nextBtn.style.display = currentDiagnosticIndex < total - 1 ? 'inline-flex' : 'none';

    // Update Palette Buttons
    const paletteBtns = document.querySelectorAll('#diagnostic-palette-container .palette-btn');
    paletteBtns.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === currentDiagnosticIndex);
      const q = currentDiagnosticDomainObj.diagnostics[idx];
      const isAnswered = diagnosticUserAnswers[q.id] !== undefined && diagnosticUserAnswers[q.id] !== '' && diagnosticUserAnswers[q.id] !== -1;

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
  diagnosticForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!currentDiagnosticDomainObj) return;

    const totalQuestions = currentDiagnosticDomainObj.diagnostics.length;
    let unansweredCount = 0;

    currentDiagnosticDomainObj.diagnostics.forEach(q => {
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

    // Delegate to Supervisor
    const result = supervisor.startLearningJourney(window.currentDraftProfile, diagnosticUserAnswers);
    renderAssessmentReport(result.evaluation, result.personalizedRoadmap);
    updateHeaderStats();
    switchView('assessmentReport');
  });

  // =========================================================================
  // VIEW 3: ASSESSMENT REPORT & TOPIC PROFICIENCY
  // =========================================================================
  function renderAssessmentReport(evaluation, roadmap) {
    document.getElementById('tier-score-display').textContent = `${evaluation.scorePct}%`;
    
    const tierLabel = document.getElementById('tier-label-display');
    tierLabel.textContent = evaluation.skillTier;
    tierLabel.className = `tier-label ${evaluation.skillTier}`;

    document.getElementById('tier-summary-text').textContent = 
      `Evaluated by Placify Quiz Performance Evaluator Agent. Score: ${evaluation.scorePct}%. Correct: ${evaluation.correctCount}/${evaluation.totalQuestions}. ${evaluation.levelDescription || ''}`;

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

  document.getElementById('build-roadmap-btn').addEventListener('click', () => {
    const state = supervisor.progressTracker.getUserState();
    renderRoadmapView(state.personalizedRoadmap);
    switchView('roadmap');
  });

  // =========================================================================
  // VIEW 4: ROADMAP VISUALIZATION
  // =========================================================================
  function renderRoadmapView(roadmap) {
    document.getElementById('injected-tag-count').textContent = `${roadmap.injectedCount} Injected Remedial`;
    document.getElementById('skipped-tag-count').textContent = `${roadmap.skippedCount} Skipped Topics`;

    const container = document.getElementById('roadmap-nodes-container');
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
  }

  document.getElementById('enter-daily-hub-btn').addEventListener('click', () => {
    const state = supervisor.progressTracker.getUserState();
    renderDailyHub(1);
    switchView('dailyHub');
  });

  // =========================================================================
  // VIEW 5: DAILY LEARNING HUB
  // =========================================================================
  function renderDailyHub(dayNumber) {
    window.currentActiveDay = dayNumber;
    const dailyData = supervisor.getDailyTaskAndResources(dayNumber);
    if (!dailyData) return;

    document.getElementById('current-day-badge').textContent = `Day ${dailyData.task.dayNumber} Task`;
    document.getElementById('current-task-title').textContent = dailyData.task.conceptTitle;
    
    const typeBadge = document.getElementById('task-type-badge');
    typeBadge.textContent = dailyData.task.type;
    typeBadge.className = `node-tag ${dailyData.task.type}`;

    document.getElementById('current-tier-recommendation').textContent = dailyData.skillTier;

    // Render suggested resources
    const resList = document.getElementById('suggested-resources-list');
    resList.innerHTML = dailyData.resources.map(r => `
      <div class="resource-card">
        <div class="resource-type-badge"><i class="ph ph-book-open"></i> ${r.type} • ${r.estTime}</div>
        <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.3rem;">${r.title}</h4>
        <p style="font-size: 0.83rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 0.6rem;">${r.summary}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-dim);">
          <span>Source: ${r.author}</span>
          <a href="${r.url}" target="_blank" style="color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Open Material <i class="ph ph-arrow-square-out"></i></a>
        </div>
      </div>
    `).join('');

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
    const nextDay = (window.currentActiveDay || 1) + 1;
    renderDailyHub(nextDay);
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
  renderDomainGrid();
  const activeSession = supervisor.authAgent.getActiveSession();
  const existingState = supervisor.progressTracker.getUserState();

  if (activeSession) {
    updateHeaderUserPill(activeSession);
    window.currentDraftProfile = {
      user_id: activeSession.user_id,
      name: activeSession.name,
      domainId: activeSession.chosen_domain,
      chosen_domain: activeSession.chosen_domain,
      timelineMonths: activeSession.timeline_months || 4,
      dailyHours: activeSession.daily_hours || 2.0
    };
    renderDiagnosticQuiz(activeSession.chosen_domain);
  }

  if (existingState.isOnboarded && existingState.personalizedRoadmap) {
    renderDailyHub(existingState.currentDayIndex + 1);
    switchView('dailyHub');
  } else {
    switchView('onboarding');
  }
});
