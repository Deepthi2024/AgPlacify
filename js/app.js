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
      const domainObj = window.PLACIFY_DATA.domains.find(d => d.id === profile.chosen_domain);
      badge.style.display = 'flex';
      nameEl.textContent = profile.name || 'User';
      domainEl.textContent = domainObj ? domainObj.name : (profile.chosen_domain || 'Full-Stack');
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
    const timeline_weeks = parseInt(document.getElementById('timeline-weeks').value, 10);
    const daily_hours = parseFloat(document.getElementById('daily-hours').value);

    try {
      // 1. Authenticate / Register via AuthAgent
      const profile = await supervisor.registerUser({
        name,
        email,
        password,
        chosen_domain,
        timeline_weeks,
        daily_hours
      });

      updateHeaderUserPill(profile);

      // Save active draft profile for Supervisor
      window.currentDraftProfile = {
        user_id: profile.user_id,
        name: profile.name,
        domainId: profile.chosen_domain,
        timelineWeeks: profile.timeline_weeks,
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
        timelineWeeks: profile.timeline_weeks,
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
  // VIEW 2: DIAGNOSTIC QUIZ
  // =========================================================================
  function renderDiagnosticQuiz(domainId) {
    const domain = window.PLACIFY_DATA.domains.find(d => d.id === domainId);
    const container = document.getElementById('diagnostic-questions-container');

    container.innerHTML = domain.diagnostics.map((q, idx) => `
      <div class="quiz-question-card" data-qid="${q.id}">
        <div class="quiz-question-title">
          <span class="question-badge">Q${idx + 1} • ${q.topic}</span>
          <span>${q.question}</span>
        </div>
        <div class="quiz-options">
          ${q.options.map((opt, oIdx) => `
            <div class="option-btn" data-qid="${q.id}" data-oidx="${oIdx}">
              <i class="ph ph-circle"></i> ${opt}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    // Option selection handling
    container.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        container.querySelectorAll(`.option-btn[data-qid="${qid}"]`).forEach(b => {
          b.classList.remove('selected');
          b.querySelector('i').className = 'ph ph-circle';
        });
        btn.classList.add('selected');
        btn.querySelector('i').className = 'ph ph-check-circle';
      });
    });
  }

  const diagnosticForm = document.getElementById('diagnostic-quiz-form');
  diagnosticForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const answers = {};
    const questionCards = document.querySelectorAll('#diagnostic-questions-container .quiz-question-card');

    questionCards.forEach(card => {
      const qid = card.dataset.qid;
      const selected = card.querySelector('.option-btn.selected');
      if (selected) {
        answers[qid] = parseInt(selected.dataset.oidx, 10);
      } else {
        answers[qid] = -1; // unanswered
      }
    });

    // Delegate to Supervisor
    const result = supervisor.startLearningJourney(window.currentDraftProfile, answers);
    renderAssessmentReport(result.evaluation, result.personalizedRoadmap);
    updateHeaderStats();
    switchView('assessmentReport');
  });

  // =========================================================================
  // VIEW 3: ASSESSMENT REPORT & GAPS
  // =========================================================================
  function renderAssessmentReport(evaluation, roadmap) {
    document.getElementById('tier-score-display').textContent = `${evaluation.scorePct}%`;
    
    const tierLabel = document.getElementById('tier-label-display');
    tierLabel.textContent = evaluation.skillTier;
    tierLabel.className = `tier-label ${evaluation.skillTier}`;

    document.getElementById('tier-summary-text').textContent = 
      `Evaluated by quiz_evaluator. Score: ${evaluation.scorePct}%. Correct: ${evaluation.correctCount}/${evaluation.totalQuestions}.`;

    // Gaps
    const gapContainer = document.getElementById('gaps-list-container');
    document.getElementById('gap-count-num').textContent = evaluation.gaps.length;

    if (evaluation.gaps.length === 0) {
      gapContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--accent-emerald);">No major knowledge gaps detected! Prerequisites fully satisfied.</div>`;
    } else {
      gapContainer.innerHTML = evaluation.gaps.map(g => `
        <div class="gap-item">
          <h4><i class="ph ph-warning"></i> ${g.topic}</h4>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.3rem;">Question: ${g.question}</div>
          <div style="font-size: 0.8rem;">
            Your Answer: <span style="color: var(--accent-rose);">${g.userAnswer}</span> | 
            Correct: <span style="color: var(--accent-emerald);">${g.correctAnswer}</span>
          </div>
        </div>
      `).join('');
    }

    // Mastered
    const masteredContainer = document.getElementById('mastered-list-container');
    document.getElementById('mastered-count-num').textContent = evaluation.mastered.length;

    if (evaluation.mastered.length === 0) {
      masteredContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">No topics marked as mastered yet.</div>`;
    } else {
      masteredContainer.innerHTML = evaluation.mastered.map(m => `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; margin-bottom: 0.5rem; font-size: 0.85rem;">
          <strong style="color: var(--accent-emerald);">${m.topic}</strong> (Verified Prerequisite)
        </div>
      `).join('');
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
  }

  if (existingState.isOnboarded && existingState.personalizedRoadmap) {
    renderDailyHub(existingState.currentDayIndex + 1);
    switchView('dailyHub');
  } else {
    switchView('onboarding');
  }
});
