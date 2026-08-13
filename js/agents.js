/**
 * ============================================================
 * PLACIFY AGENTS
 * ============================================================
 *
 * Sub-Agents:
 * 1. AuthAgent
 * 2. QuizEvaluatorAgent
 * 3. RoadmapGeneratorAgent
 * 4. PersonalizedRoadmapAgent
 * 5. ResourceSuggesterAgent
 * 6. ResourceFetcherAgent
 * 7. ProgressTrackerAgent
 *
 * Supervisor:
 * PlacifySupervisorAgent
 *
 * IMPORTANT:
 * Authentication uses MongoDB Atlas through the backend API.
 * There is NO localStorage authentication fallback.
 * ============================================================
 */


/* ============================================================
   1. AUTHENTICATION AGENT
   ============================================================ */

class AuthAgent {

  constructor() {
    this.sessionKey = 'placify_active_session';
  }


  /* ==========================================================
     REGISTER USER
     ========================================================== */

  async registerUser({
    name,
    email,
    password,
    chosen_domain,
    timeline_months,
    daily_hours
  }) {

    // -------------------------------
    // Validate Name
    // -------------------------------

    if (!name || !name.trim()) {

      const err = new Error(
        'Full Name is required.'
      );

      err.status = 400;
      throw err;
    }


    // -------------------------------
    // Validate Email
    // -------------------------------

    const cleanEmail =
      (email || '').trim().toLowerCase();

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !cleanEmail ||
      !emailRegex.test(cleanEmail)
    ) {

      const err = new Error(
        'A valid Email Address is required.'
      );

      err.status = 400;
      throw err;
    }


    // -------------------------------
    // Validate Password
    // -------------------------------

    if (!password || password.length < 6) {

      const err = new Error(
        'Password must be at least 6 characters long.'
      );

      err.status = 400;
      throw err;
    }


    // -------------------------------
    // Normalize Data
    // -------------------------------

    const domain =
      chosen_domain || 'fullstack';

    const months =
      parseInt(timeline_months, 10) || 4;

    const hours =
      parseFloat(daily_hours) || 2.0;


    // -------------------------------
    // Send Request to Backend
    // -------------------------------

    try {

      console.log(
        '📡 Sending registration request to backend...'
      );


      const response = await fetch(
        'http://localhost:5000/api/auth/register',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({

            name: name.trim(),

            email: cleanEmail,

            password: password,

            chosen_domain: domain,

            timeline_months: months,

            daily_hours: hours

          })
        }
      );


      // -------------------------------
      // Parse Response
      // -------------------------------

      const data =
        await response.json();


      console.log(
        '📥 Registration API response:',
        data
      );


      // -------------------------------
      // Backend Error
      // -------------------------------

      if (!response.ok) {

        const err = new Error(
          data.error ||
          'Registration failed.'
        );

        err.status = response.status;

        throw err;
      }


      // -------------------------------
      // Registration Successful
      // -------------------------------

      if (!data.profile) {

        throw new Error(
          'Registration succeeded but no user profile was returned by the server.'
        );
      }


      this.setActiveSession(
        data.profile
      );


      console.log(
        '✅ User registered successfully:',
        data.profile
      );


      return data.profile;


    } catch (error) {

      console.error(
        '❌ Registration failed:',
        error
      );

      /*
       * MongoDB Atlas is the ONLY authentication source.
       *
       * Do NOT create a localStorage user here.
       */

      throw error;
    }
  }


  /* ==========================================================
     LOGIN USER
     ========================================================== */

  async loginUser(email, password) {

    const cleanEmail =
      (email || '').trim().toLowerCase();


    // -------------------------------
    // Validate Credentials
    // -------------------------------

    if (!cleanEmail || !password) {

      const err = new Error(
        'HTTP 401 Unauthorized: Email and password are required credentials.'
      );

      err.status = 401;

      throw err;
    }


    try {

      console.log(
        '📡 Sending login request to backend...'
      );


      const response = await fetch(
        'http://localhost:5000/api/auth/login',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          /*
           * Send original password.
           *
           * Backend retrieves the stored salt
           * and performs PBKDF2 verification.
           */

          body: JSON.stringify({

            email: cleanEmail,

            password: password

          })
        }
      );


      const data =
        await response.json();


      console.log(
        '📥 Login API response:',
        data
      );


      // -------------------------------
      // Login Error
      // -------------------------------

      if (!response.ok) {

        const err = new Error(
          data.error ||
          'HTTP 401 Unauthorized: Invalid email or password credentials.'
        );

        err.status = response.status;

        throw err;
      }


      // -------------------------------
      // Login Successful
      // -------------------------------

      if (!data.profile) {

        throw new Error(
          'Login succeeded but no user profile was returned by the server.'
        );
      }


      this.setActiveSession(
        data.profile
      );


      console.log(
        '✅ Login successful:',
        data.profile
      );


      return data.profile;


    } catch (error) {

      console.error(
        '❌ Login failed:',
        error
      );

      /*
       * MongoDB Atlas is the ONLY authentication source.
       */

      throw error;
    }
  }


  /* ==========================================================
     SAVE ACTIVE SESSION
     ========================================================== */

  setActiveSession(profile) {

    localStorage.setItem(
      this.sessionKey,
      JSON.stringify(profile)
    );
  }


  /* ==========================================================
     GET ACTIVE SESSION
     ========================================================== */

  getActiveSession() {

    try {

      const raw =
        localStorage.getItem(
          this.sessionKey
        );


      if (!raw) {
        return null;
      }


      return JSON.parse(raw);


    } catch (error) {

      console.error(
        '❌ Could not read active session:',
        error
      );

      return null;
    }
  }


  /* ==========================================================
     LOGOUT
     ========================================================== */

  clearSession() {

    localStorage.removeItem(
      this.sessionKey
    );
  }

}


/* ============================================================
   2. QUIZ EVALUATOR AGENT
   ============================================================ */

class QuizEvaluatorAgent {

  evaluateDiagnostic(
    domainIdOrObject,
    rawAnswers = {},
    userId = null
  ) {
    let user_id = userId;
    let answersInput = rawAnswers;
    let explicitDomain = null;

    // Check if called with a structured input payload object
    if (typeof domainIdOrObject === 'object' && domainIdOrObject !== null) {
      user_id = domainIdOrObject.user_id || user_id;
      explicitDomain = domainIdOrObject.domainId || domainIdOrObject.chosen_domain || domainIdOrObject.domain;
      answersInput = domainIdOrObject.answers || rawAnswers;
    } else {
      explicitDomain = domainIdOrObject;
    }

    if (!user_id && window.currentDraftProfile) {
      user_id = window.currentDraftProfile.user_id || window.currentDraftProfile.email;
    }
    if (!user_id && window.placifySupervisor && window.placifySupervisor.authAgent) {
      const activeSession = window.placifySupervisor.authAgent.getActiveSession();
      if (activeSession) {
        user_id = activeSession.user_id;
      }
    }
    if (!user_id) {
      user_id = 'usr_guest_' + Date.now();
    }

    // Resolve domain object robustly using findDomain
    let domainCandidate = explicitDomain;
    if (!domainCandidate && window.currentDraftProfile) {
      domainCandidate = window.currentDraftProfile.domainId || window.currentDraftProfile.chosen_domain;
    }
    if (!domainCandidate && window.placifySupervisor && window.placifySupervisor.authAgent) {
      const activeSession = window.placifySupervisor.authAgent.getActiveSession();
      if (activeSession) {
        domainCandidate = activeSession.chosen_domain;
      }
    }

    const domainObj = window.PLACIFY_DATA.findDomain(domainCandidate);
    const domainName = domainObj.name;
    const domainId = domainObj.id;

    // Build structured answers array with required fields
    let formattedQuestions = [];

    if (Array.isArray(answersInput)) {
      formattedQuestions = answersInput;
    } else if (domainObj && domainObj.diagnostics) {
      formattedQuestions = domainObj.diagnostics.map((q, idx) => {
        let userSelection = answersInput[q.id];
        if (userSelection === undefined) {
          userSelection = answersInput[idx] !== undefined ? answersInput[idx] : answersInput[`q_${idx + 1}`];
        }

        let userAnswerText = 'Unanswered';
        let isCorrect = false;
        const qType = q.type || 'MCQ';

        // 1. MSQ (Multiple Select Question)
        if (qType === 'MSQ') {
          let userArr = [];
          if (Array.isArray(userSelection)) {
            userArr = userSelection.map(Number).filter(n => !isNaN(n));
          } else if (typeof userSelection === 'string' && userSelection.includes(',')) {
            userArr = userSelection.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
          } else if (userSelection !== undefined && userSelection !== null && userSelection !== -1 && userSelection !== '-1') {
            userArr = [Number(userSelection)];
          }

          let correctArr = Array.isArray(q.correct) ? q.correct.map(Number) : [Number(q.correct)];

          if (userArr.length > 0) {
            userAnswerText = userArr.map(i => q.options[i] || `Option ${i + 1}`).join('; ');
            const normUser = [...userArr].sort((a, b) => a - b).join(',');
            const normCorr = [...correctArr].sort((a, b) => a - b).join(',');
            isCorrect = normUser === normCorr;
          } else {
            userAnswerText = 'Unanswered';
            isCorrect = false;
          }
        }
        // 2. NUMERICAL Question
        else if (qType === 'NUMERICAL') {
          if (userSelection !== undefined && userSelection !== null && String(userSelection).trim() !== '') {
            userAnswerText = String(userSelection).trim();
            const userNum = parseFloat(userAnswerText);
            const correctNum = parseFloat(q.correct);
            if (!isNaN(userNum) && !isNaN(correctNum)) {
              isCorrect = Math.abs(userNum - correctNum) < 0.01;
            } else {
              isCorrect = String(userAnswerText).toLowerCase() === String(q.correct).toLowerCase();
            }
          } else {
            userAnswerText = 'Unanswered';
            isCorrect = false;
          }
        }
        // 3. MCQ / CODE_OUTPUT / ASSERTION / SCENARIO / CONCEPTUAL / APPLICATION
        else {
          if (userSelection !== undefined && userSelection !== null && userSelection !== -1 && userSelection !== '-1') {
            const numIdx = Number(userSelection);
            if (!isNaN(numIdx) && numIdx >= 0 && q.options && q.options[numIdx]) {
              userAnswerText = q.options[numIdx];
              isCorrect = (numIdx === Number(q.correct));
            } else if (typeof userSelection === 'string' && userSelection.trim()) {
              userAnswerText = userSelection.trim();
              const expectedText = (q.options && q.options[q.correct]) ? q.options[q.correct] : String(q.correct);
              isCorrect = (userAnswerText.toLowerCase() === String(expectedText).toLowerCase());
            }
          } else {
            userAnswerText = 'Unanswered';
            isCorrect = false;
          }
        }

        const correctText = Array.isArray(q.correct)
          ? q.correct.map(i => q.options[i]).join('; ')
          : ((q.options && q.options[q.correct]) ? q.options[q.correct] : String(q.correct));

        return {
          id: q.id,
          question: q.question,
          codeSnippet: q.codeSnippet || null,
          options: q.options || [],
          type: qType,
          topic: q.topic || 'General Knowledge',
          subtopic: q.subtopic || 'Core Concepts',
          difficulty: q.difficulty || 'INTERMEDIATE',
          user_answer: userAnswerText,
          correct_answer: correctText,
          is_correct: isCorrect,
          explanation: q.explanation || ''
        };
      });
    }

    // Calculate detailed topic-wise accuracy & difficulty breakdown
    let correctCount = 0;
    let unansweredTotal = 0;
    const totalQuestions = formattedQuestions.length;
    const topicStats = {};
    const gaps = [];
    const mastered = [];

    formattedQuestions.forEach(q => {
      if (q.user_answer === 'Unanswered') unansweredTotal++;
      if (q.is_correct) {
        correctCount++;
        mastered.push({
          topic: q.topic,
          question: q.question
        });
      } else {
        gaps.push({
          topic: q.topic,
          question: q.question,
          userAnswer: q.user_answer,
          correctAnswer: q.correct_answer,
          difficulty: q.difficulty,
          explanation: q.explanation
        });
      }

      const topic = q.topic || 'General Knowledge';
      if (!topicStats[topic]) {
        topicStats[topic] = {
          total: 0,
          correct: 0,
          incorrect: 0,
          unanswered: 0,
          beginnerTotal: 0,
          beginnerCorrect: 0,
          intermediateTotal: 0,
          intermediateCorrect: 0,
          advancedTotal: 0,
          advancedCorrect: 0,
          weakConcepts: new Set()
        };
      }

      const stats = topicStats[topic];
      stats.total++;
      if (q.user_answer === 'Unanswered') stats.unanswered++;

      if (q.difficulty === 'BEGINNER') {
        stats.beginnerTotal++;
        if (q.is_correct) stats.beginnerCorrect++;
      } else if (q.difficulty === 'ADVANCED') {
        stats.advancedTotal++;
        if (q.is_correct) stats.advancedCorrect++;
      } else {
        stats.intermediateTotal++;
        if (q.is_correct) stats.intermediateCorrect++;
      }

      if (q.is_correct) {
        stats.correct++;
      } else {
        stats.incorrect++;
        if (q.subtopic) stats.weakConcepts.add(q.subtopic);
      }
    });

    const scorePct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const topicEvaluations = [];
    const weakTopics = [];
    const intermediateTopics = [];
    const strongTopics = [];
    const masteredTopics = [];
    const knowledgeGaps = [];

    Object.keys(topicStats).forEach(topic => {
      const stats = topicStats[topic];
      const accuracyPct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

      const begAcc = stats.beginnerTotal > 0 ? Math.round((stats.beginnerCorrect / stats.beginnerTotal) * 100) : 100;
      const intAcc = stats.intermediateTotal > 0 ? Math.round((stats.intermediateCorrect / stats.intermediateTotal) * 100) : 100;
      const advAcc = stats.advancedTotal > 0 ? Math.round((stats.advancedCorrect / stats.advancedTotal) * 100) : 0;

      // Strict NPTEL Difficulty-Weighted Proficiency Logic
      let proficiencyLevel = 'INTERMEDIATE';
      let reason = '';

      if (accuracyPct >= 80 && (stats.intermediateTotal === 0 || intAcc >= 50) && (stats.advancedTotal === 0 || advAcc > 0)) {
        proficiencyLevel = 'STRONG';
        reason = `High overall accuracy (${accuracyPct}%) with strong intermediate/advanced problem solving.`;
      } else if (accuracyPct < 50 || (stats.beginnerTotal > 0 && begAcc < 50)) {
        proficiencyLevel = 'WEAK';
        if (stats.beginnerTotal > 0 && begAcc < 50) {
          reason = `Failed foundational beginner questions (${begAcc}% accuracy). Fundamental concepts missing.`;
        } else {
          reason = `Low topic accuracy (${accuracyPct}%). Needs targeted remedial practice.`;
        }
      } else {
        proficiencyLevel = 'INTERMEDIATE';
        if (advAcc === 0 && stats.advancedTotal > 0) {
          reason = `Solid baseline (${accuracyPct}%), but struggled with advanced application/code tracing questions.`;
        } else {
          reason = `Practical understanding solid (${accuracyPct}% accuracy). Ready for applied project work.`;
        }
      }

      const evalItem = {
        topic,
        totalQuestions: stats.total,
        correctAnswers: stats.correct,
        incorrectAnswers: stats.incorrect,
        unanswered: stats.unanswered,
        accuracy: accuracyPct,
        score_pct: accuracyPct,
        beginnerAccuracy: begAcc,
        intermediateAccuracy: intAcc,
        advancedAccuracy: advAcc,
        proficiencyLevel,
        proficiency_level: proficiencyLevel,
        reason,
        weakConcepts: Array.from(stats.weakConcepts),
        recommendedFocus: Array.from(stats.weakConcepts).join(', ') || `${topic} Foundations`
      };

      topicEvaluations.push(evalItem);

      if (proficiencyLevel === 'STRONG') {
        strongTopics.push(evalItem);
        masteredTopics.push({ topic, accuracy_pct: accuracyPct });
      } else if (proficiencyLevel === 'INTERMEDIATE') {
        intermediateTopics.push(evalItem);
      } else {
        weakTopics.push(evalItem);
        knowledgeGaps.push({
          topic,
          accuracy_pct: accuracyPct,
          reason,
          weakConcepts: Array.from(stats.weakConcepts)
        });
      }
    });

    // Determine Overall Skill Tier (Score + Topic Distribution)
    let skillTier = 'BEGINNER';
    let levelDescription = '';

    if (scorePct >= 80 && weakTopics.length <= 1) {
      skillTier = 'ADVANCED';
      levelDescription = 'High technical proficiency across domain topics. Ready for advanced system design and production trade-offs.';
    } else if (scorePct >= 50 && weakTopics.length <= 3) {
      skillTier = 'INTERMEDIATE';
      levelDescription = 'Solid practical foundation. Identified specific weak concepts for targeted remediation.';
    } else {
      skillTier = 'BEGINNER';
      levelDescription = 'Foundational gaps identified across core topics. Focus on fundamental conceptual modules.';
    }

    const evaluationResult = {
      user_id,
      domain: domainName,
      domainId: domainId,
      scorePct,
      correctCount,
      totalQuestions,
      unansweredCount: unansweredTotal,
      skillTier,
      skill_level: skillTier,
      levelDescription,
      masteredTopics,
      knowledgeGaps,
      topicEvaluations,
      weakTopics,
      intermediateTopics,
      strongTopics,
      gaps,
      mastered,
      answers: formattedQuestions,
      evaluatedAt: new Date().toISOString()
    };

    // Async save to MongoDB Atlas backend
    fetch('http://localhost:5000/api/quiz/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id,
        domain: domainName,
        answers: formattedQuestions,
        topic_evaluations: topicEvaluations
      })
    })
      .then(res => res.json())
      .then(data => {
        console.log('✅ Quiz Evaluation persisted to MongoDB Atlas collection quiz_evaluations:', data);
      })
      .catch(err => {
        console.warn('⚠️ Could not persist quiz evaluation to backend server:', err.message);
      });

    return evaluationResult;
  }
}


/* ============================================================
   3. ROADMAP GENERATOR AGENT
   ============================================================ */

class RoadmapGeneratorAgent {

  generateBaseRoadmap(
    domainId,
    timelineMonths,
    dailyHours
  ) {

    const domain =
      window.PLACIFY_DATA.findDomain(domainId);


    if (!domain) {

      throw new Error(
        'Domain not found'
      );
    }


    const months = timelineMonths || 4;
    const internalWeeks = months * 4;


    // -------------------------------
    // Calculate Total Learning Hours
    // -------------------------------

    const totalHours =
      internalWeeks *
      7 *
      dailyHours;


    // -------------------------------
    // Generate Milestones
    // -------------------------------

    const baseMilestones =
      domain.milestones.map(
        (m, index) => {

          const targetWeek =
            Math.max(
              1,
              Math.round(
                ((index + 1) /
                  domain.milestones.length) *
                internalWeeks
              )
            );


          return {

            id:
              `bm_${index + 1}`,

            title:
              m.title,

            topic:
              m.topic,

            targetWeek,

            estHours:
              Math.max(
                1,
                Math.round(
                  totalHours /
                  domain.milestones.length
                )
              ),

            status:
              'PENDING',

            type:
              'STANDARD'

          };
        }
      );


    return {

      domainId:
        domain.id,

      domainName:
        domain.name,

      timelineMonths: months,

      dailyHours,

      totalHours,

      milestones:
        baseMilestones

    };
  }
}


/* ============================================================
   4. PERSONALIZED ROADMAP AGENT
   ============================================================ */

class PersonalizedRoadmapAgent {

  customizeRoadmap(
    baseRoadmap,
    evaluationResult
  ) {

    const customizedMilestones = [];


    const masteredTopics =
      evaluationResult.mastered.map(
        m => m.topic
      );


    // ==========================================================
    // STEP 1: INJECT REMEDIAL MODULES
    // ==========================================================

    evaluationResult.gaps.forEach(
      (gap, index) => {

        customizedMilestones.push({

          id:
            `remedial_${index + 1}`,

          title:
            `⚡ Remedial Foundation: ${gap.topic} Boost`,

          topic:
            gap.topic,

          targetWeek:
            1,

          estHours:
            6,

          status:
            'INJECTED',

          type:
            'REMEDIAL',

          reason:
            `Knowledge gap detected in diagnostic evaluation: "${gap.question.slice(0, 45)}..."`

        });
      }
    );


    // ==========================================================
    // STEP 2: PROCESS STANDARD MILESTONES
    // ==========================================================

    baseRoadmap.milestones.forEach(
      milestone => {

        const isMastered =
          masteredTopics.includes(
            milestone.topic
          ) &&
          evaluationResult.skillTier !==
          'BEGINNER';


        customizedMilestones.push({

          ...milestone,

          status:
            isMastered
              ? 'SKIPPED'
              : 'PENDING',

          skipReason:
            isMastered
              ? `Topic "${milestone.topic}" mastered in diagnostic quiz`
              : null

        });
      }
    );


    // ==========================================================
    // STEP 3: SORT BY WEEK
    // ==========================================================

    customizedMilestones.sort(
      (a, b) =>
        a.targetWeek -
        b.targetWeek
    );


    // ==========================================================
    // STEP 4: CREATE DAILY TASKS
    // ==========================================================

    const dailyTasks = [];

    let dayCounter = 1;


    customizedMilestones.forEach(
      milestone => {

        /*
         * Skipped topics are not added
         * to daily learning tasks.
         */

        if (
          milestone.status ===
          'SKIPPED'
        ) {
          return;
        }


        const daysForMilestone =
          Math.max(
            2,
            Math.round(
              milestone.estHours /
              baseRoadmap.dailyHours
            )
          );


        for (
          let day = 1;
          day <= daysForMilestone;
          day++
        ) {

          dailyTasks.push({

            dayNumber:
              dayCounter++,

            milestoneId:
              milestone.id,

            milestoneTitle:
              milestone.title,

            topic:
              milestone.topic,

            conceptTitle:
              `${milestone.topic} - Core Deep Dive (Part ${day})`,

            type:
              milestone.type,

            completed:
              false,

            score:
              null

          });
        }
      }
    );


    return {

      ...baseRoadmap,

      skillTier:
        evaluationResult.skillTier,

      gapsCount:
        evaluationResult.gaps.length,

      skippedCount:
        customizedMilestones.filter(
          m => m.status === 'SKIPPED'
        ).length,

      injectedCount:
        customizedMilestones.filter(
          m => m.type === 'REMEDIAL'
        ).length,

      milestones:
        customizedMilestones,

      dailyTasks

    };
  }
}


/* ============================================================
   5. RESOURCE SUGGESTER AGENT
   ============================================================ */

class ResourceSuggesterAgent {

  suggestResources(
    topic,
    skillTier
  ) {

    const tierResources =
      window.PLACIFY_DATA.resources[
      skillTier
      ] ||
      window.PLACIFY_DATA.resources[
      'BEGINNER'
      ];


    return tierResources.map(
      resource => ({

        ...resource,

        suggestedForTopic:
          topic,

        recommendedTier:
          skillTier

      })
    );
  }
}


/* ============================================================
   6. RESOURCE FETCHER / ASSESSMENT AGENT
   ============================================================ */

class ResourceFetcherAgent {


  /* ==========================================================
     FETCH CONTENT + BUILD QUIZ
     ========================================================== */

  fetchContentAndBuildAssessment(
    conceptTitle,
    topic
  ) {

    const assessmentBank =
      window.PLACIFY_DATA
        .conceptAssessments[topic] ||
      window.PLACIFY_DATA
        .conceptAssessments['Default'];


    const questions =
      assessmentBank.map(
        (q, index) => ({

          id:
            `ca_${index + 1}`,

          question:
            q.question,

          options:
            q.options,

          correct:
            q.correct,

          explanation:
            q.explanation

        })
      );


    return {

      conceptTitle,

      topic,

      retrievedContentSummary:
        `Interactive lecture notes, code snippets, and design patterns compiled for ${conceptTitle}. Grounded in curated MDN, W3C, and Placify Academy technical documentation.`,

      questions

    };
  }


  /* ==========================================================
     GRADE ASSESSMENT
     ========================================================== */

  gradeAssessment(
    questions,
    userAnswers
  ) {

    let score = 0;

    const feedback = [];


    questions.forEach(
      question => {

        const userAnswer =
          userAnswers[
          question.id
          ];


        const isCorrect =
          userAnswer ===
          question.correct;


        if (isCorrect) {
          score++;
        }


        feedback.push({

          questionId:
            question.id,

          question:
            question.question,

          userAnswer:
            userAnswer >= 0
              ? question.options[userAnswer]
              : 'No answer',

          correctAnswer:
            question.options[
            question.correct
            ],

          isCorrect,

          explanation:
            question.explanation

        });
      }
    );


    const scorePct =
      questions.length > 0
        ? Math.round(
          (score /
            questions.length) *
          100
        )
        : 0;


    const passed =
      scorePct >= 70;


    return {

      score,

      total:
        questions.length,

      scorePct,

      passed,

      feedback

    };
  }
}


/* ============================================================
   7. PROGRESS TRACKER AGENT
   ============================================================ */

class ProgressTrackerAgent {

  constructor() {

    this.storageKey =
      'placify_user_state';
  }


  /* ==========================================================
     DEFAULT STATE
     ========================================================== */

  getDefaultState() {

    return {

      isOnboarded:
        false,

      userProfile:
        null,

      evaluation:
        null,

      personalizedRoadmap:
        null,

      currentDayIndex:
        0,

      masteryPct:
        0,

      xp:
        0,

      streak:
        1,

      lastCompletedDate:
        null,

      badges:
        ['🐣 Fresh Start'],

      level:
        1,

      levelUpEligible:
        false,

      history:
        []

    };
  }


  /* ==========================================================
     GET USER STATE
     ========================================================== */

  getUserState() {

    try {

      const raw =
        localStorage.getItem(
          this.storageKey
        );


      if (!raw) {

        return this.getDefaultState();
      }


      const state =
        JSON.parse(raw);


      /*
       * Protect against missing properties
       * when an older local state exists.
       */

      return {

        ...this.getDefaultState(),

        ...state,

        badges:
          Array.isArray(state.badges)
            ? state.badges
            : ['🐣 Fresh Start'],

        history:
          Array.isArray(state.history)
            ? state.history
            : []

      };


    } catch (error) {

      console.error(
        '❌ Could not read progress state:',
        error
      );

      return this.getDefaultState();
    }
  }


  /* ==========================================================
     SAVE USER STATE
     ========================================================== */

  saveUserState(state) {

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(state)
    );

    return state;
  }


  /* ==========================================================
     TASK COMPLETION
     ========================================================== */

  logTaskCompletion(
    dayNumber,
    taskScorePct
  ) {

    const state =
      this.getUserState();


    if (
      !state.personalizedRoadmap
    ) {

      return state;
    }


    const task =
      state.personalizedRoadmap.dailyTasks.find(
        t =>
          t.dayNumber === dayNumber
      );


    if (!task) {

      console.warn(
        `⚠️ Day ${dayNumber} task not found.`
      );

      return state;
    }


    // -------------------------------
    // Mark Task Complete
    // -------------------------------

    task.completed =
      true;

    task.score =
      taskScorePct;


    // -------------------------------
    // Calculate Mastery
    // -------------------------------

    const completedTasks =
      state.personalizedRoadmap
        .dailyTasks
        .filter(
          t => t.completed
        );


    const totalTasks =
      state.personalizedRoadmap
        .dailyTasks
        .length;


    state.masteryPct =
      totalTasks > 0
        ? Math.round(
          (completedTasks.length /
            totalTasks) *
          100
        )
        : 0;


    // -------------------------------
    // XP
    // -------------------------------

    const xpGained =
      Math.round(
        150 *
        (taskScorePct / 100)
      );


    state.xp += xpGained;


    // -------------------------------
    // Update Current Day
    // -------------------------------

    state.currentDayIndex =
      Math.max(
        state.currentDayIndex || 0,
        dayNumber
      );


    // -------------------------------
    // Streak
    // -------------------------------

    const today =
      new Date()
        .toISOString()
        .split('T')[0];


    if (
      state.lastCompletedDate !==
      today
    ) {

      /*
       * Keep existing project behavior:
       * first completed task changes
       * the streak from 1 to 2.
       */

      state.streak =
        Math.max(
          1,
          state.streak + 1
        );

      state.lastCompletedDate =
        today;
    }


    // -------------------------------
    // Badges
    // -------------------------------

    if (
      completedTasks.length === 1 &&
      !state.badges.includes(
        '🚀 First Step'
      )
    ) {

      state.badges.push(
        '🚀 First Step'
      );
    }


    if (
      state.streak >= 3 &&
      !state.badges.includes(
        '🔥 3-Day Streak'
      )
    ) {

      state.badges.push(
        '🔥 3-Day Streak'
      );
    }


    if (
      state.masteryPct >= 50 &&
      !state.badges.includes(
        '⚡ Halfway Master'
      )
    ) {

      state.badges.push(
        '⚡ Halfway Master'
      );
    }


    if (
      state.masteryPct >= 100 &&
      !state.badges.includes(
        '🏆 Domain Conqueror'
      )
    ) {

      state.badges.push(
        '🏆 Domain Conqueror'
      );
    }


    // -------------------------------
    // Level Calculation
    // -------------------------------

    const newLevel =
      Math.floor(
        state.xp / 300
      ) + 1;


    if (
      newLevel > state.level
    ) {

      state.level =
        newLevel;

      state.levelUpEligible =
        true;
    }


    // -------------------------------
    // History
    // -------------------------------

    state.history.push({

      timestamp:
        new Date().toISOString(),

      dayNumber,

      taskScorePct,

      masteryPct:
        state.masteryPct,

      xpGained

    });


    return this.saveUserState(
      state
    );
  }


  /* ==========================================================
     CONSUME LEVEL UP
     ========================================================== */

  consumeLevelUp(
    tierChoice
  ) {

    const state =
      this.getUserState();


    state.levelUpEligible =
      false;


    if (
      state.personalizedRoadmap
    ) {

      state.personalizedRoadmap.skillTier =
        tierChoice;
    }


    return this.saveUserState(
      state
    );
  }


  /* ==========================================================
     RESET
     ========================================================== */

  resetState() {

    localStorage.removeItem(
      this.storageKey
    );

    return this.getUserState();
  }
}


/* ============================================================
   8. PLACIFY SUPERVISOR AGENT
   ============================================================ */

class PlacifySupervisorAgent {

  constructor() {

    /*
     * IMPORTANT:
     *
     * These names MUST match what app.js uses.
     */

    this.authAgent =
      new AuthAgent();

    this.quizEvaluator =
      new QuizEvaluatorAgent();

    this.roadmapGenerator =
      new RoadmapGeneratorAgent();

    this.personalizedRoadmap =
      new PersonalizedRoadmapAgent();

    this.resourceSuggester =
      new ResourceSuggesterAgent();

    this.resourceFetcher =
      new ResourceFetcherAgent();

    this.progressTracker =
      new ProgressTrackerAgent();


    this.logs = [];
  }


  /* ==========================================================
     LOG AGENT ACTION
     ========================================================== */

  logAgentAction(
    agentName,
    action,
    details
  ) {

    const entry = {

      timestamp:
        new Date().toLocaleTimeString(),

      agentName,

      action,

      details

    };


    this.logs.unshift(
      entry
    );


    if (
      typeof window.onAgentLog ===
      'function'
    ) {

      window.onAgentLog(
        entry
      );
    }
  }


  /* ==========================================================
     REGISTER USER
     ========================================================== */

  async registerUser(
    userData
  ) {

    this.logAgentAction(

      'auth_specialist',

      'User Registration Request',

      `Processing registration for ${userData.name} (${userData.email})`

    );


    try {

      const profile =
        await this.authAgent.registerUser(
          userData
        );


      this.logAgentAction(

        'auth_specialist',

        'Registration & Password Authentication Success',

        `User ${profile.name} registered successfully. Assigned user_id: ${profile.user_id}`

      );


      this.logAgentAction(

        'SupervisorAgent',

        'POST-AUTH ACTION: Handoff to Quiz Evaluator',

        `Passing user_id: ${profile.user_id} & chosen_domain: ${profile.chosen_domain} to quiz_evaluator agent.`

      );


      return profile;


    } catch (error) {

      this.logAgentAction(

        'auth_specialist',

        'Registration Failed',

        error.message

      );


      throw error;
    }
  }


  /* ==========================================================
     AUTHENTICATE USER
     ========================================================== */

  async authenticateUser(
    email,
    password
  ) {

    this.logAgentAction(

      'auth_specialist',

      'Login Request',

      `Authenticating credentials for email: ${email}`

    );


    try {

      const profile =
        await this.authAgent.loginUser(
          email,
          password
        );


      this.logAgentAction(

        'auth_specialist',

        'Login Authentication Success',

        `User ${profile.name} (${profile.user_id}) verified against MongoDB Atlas.`

      );


      this.logAgentAction(

        'SupervisorAgent',

        'POST-AUTH ACTION: Handoff to Quiz Evaluator',

        `Passing user_id: ${profile.user_id} & chosen_domain: ${profile.chosen_domain} to quiz_evaluator agent.`

      );


      return profile;


    } catch (error) {

      this.logAgentAction(

        'auth_specialist',

        'Authentication Failure (HTTP 401)',

        error.message

      );


      throw error;
    }
  }


  /* ==========================================================
     START LEARNING JOURNEY
     ========================================================== */

  startLearningJourney(
    userProfile,
    diagnosticAnswers
  ) {

    if (!userProfile) {

      throw new Error(
        'User profile is missing.'
      );
    }


    this.logAgentAction(

      'SupervisorAgent',

      'Initiating Onboarding Workflow',

      `Received user domain: ${userProfile.domainId}, timeline: ${userProfile.timelineMonths}m, hours: ${userProfile.dailyHours}h/day`

    );


    // ========================================================
    // STEP 1: QUIZ EVALUATION
    // ========================================================

    const domainToEval = userProfile.domainId || userProfile.chosen_domain;

    this.logAgentAction(

      'quiz_evaluator',

      'Evaluating Diagnostic Answers',

      `Processing diagnostic questions for domain: ${domainToEval}`

    );


    const evaluation =
      this.quizEvaluator.evaluateDiagnostic(

        domainToEval,

        diagnosticAnswers,

        userProfile.user_id

      );


    this.logAgentAction(

      'quiz_evaluator',

      'Skill Baseline Established',

      `Skill Tier: ${evaluation.skillTier} (${evaluation.scorePct}% score). Detected Gaps: ${evaluation.gaps.length}`

    );


    // ========================================================
    // STEP 2: BASE ROADMAP
    // ========================================================

    this.logAgentAction(

      'roadmap_generator',

      'Generating Base Milestone Roadmap',

      `Constructing milestones for ${userProfile.timelineMonths} months`

    );


    const baseRoadmap =
      this.roadmapGenerator.generateBaseRoadmap(

        userProfile.domainId,

        userProfile.timelineMonths || userProfile.timelineWeeks,

        userProfile.dailyHours

      );


    // ========================================================
    // STEP 3: PERSONALIZATION
    // ========================================================

    this.logAgentAction(

      'personalized_roadmap',

      'Customizing Roadmap Node Tree',

      `Injecting ${evaluation.gaps.length} remedial modules and evaluating ${evaluation.mastered.length} mastered topics`

    );


    const finalRoadmap =
      this.personalizedRoadmap.customizeRoadmap(

        baseRoadmap,

        evaluation

      );


    // ========================================================
    // STEP 4: SAVE STATE
    // ========================================================

    const state =
      this.progressTracker.getUserState();


    state.isOnboarded =
      true;

    state.userProfile =
      userProfile;

    state.evaluation =
      evaluation;

    state.personalizedRoadmap =
      finalRoadmap;

    state.currentDayIndex =
      0;


    this.progressTracker.saveUserState(
      state
    );


    this.logAgentAction(

      'SupervisorAgent',

      'Journey Initialized Successfully',

      `Customized roadmap ready with ${finalRoadmap.dailyTasks.length} daily learning tasks.`

    );


    return {

      evaluation,

      personalizedRoadmap:
        finalRoadmap

    };
  }


  /* ==========================================================
     DAILY LEARNING LOOP
     ========================================================== */

  getDailyTaskAndResources(
    dayNumber
  ) {

    const state =
      this.progressTracker.getUserState();


    if (
      !state.personalizedRoadmap
    ) {

      return null;
    }


    const task =
      state.personalizedRoadmap.dailyTasks.find(
        t =>
          t.dayNumber ===
          dayNumber
      ) ||
      state.personalizedRoadmap.dailyTasks[0];


    if (!task) {

      return null;
    }


    const skillTier =
      state.personalizedRoadmap.skillTier ||
      'BEGINNER';


    this.logAgentAction(

      'resource_suggester',

      'Recommending Learning Materials',

      `Curating ${skillTier}-level resources for concept: "${task.topic}"`

    );


    const resources =
      this.resourceSuggester.suggestResources(

        task.topic,

        skillTier

      );


    return {

      task,

      skillTier,

      resources

    };
  }


  /* ==========================================================
     FETCH TASK ASSESSMENT
     ========================================================== */

  fetchTaskAssessment(
    conceptTitle,
    topic
  ) {

    this.logAgentAction(

      'resource_fetcher',

      'Synthesizing Grounded Assessment',

      `Fetching resource content and compiling quiz for "${topic}"`

    );


    return this.resourceFetcher
      .fetchContentAndBuildAssessment(

        conceptTitle,

        topic

      );
  }


  /* ==========================================================
     SUBMIT TASK ASSESSMENT
     ========================================================== */

  submitTaskAssessment(

    dayNumber,

    questions,

    userAnswers

  ) {

    this.logAgentAction(

      'resource_fetcher',

      'Grading Assessment Submission',

      `Evaluating answers for Day ${dayNumber} assessment`

    );


    const grade =
      this.resourceFetcher.gradeAssessment(

        questions,

        userAnswers

      );


    this.logAgentAction(

      'progress_tracker',

      'Logging Completion Stats',

      `Task passed: ${grade.passed} (${grade.scorePct}% score). Updating XP & Mastery %`

    );


    const updatedState =
      this.progressTracker.logTaskCompletion(

        dayNumber,

        grade.scorePct

      );


    return {

      grade,

      updatedState

    };
  }
}


/* ============================================================
   GLOBAL SUPERVISOR INITIALIZATION
   ============================================================
 *
 * THIS LINE FIXES:
 *
 * "Cannot read properties of undefined
 *  (reading 'registerUser')"
 *
 * app.js expects:
 *
 * window.placifySupervisor
 *
 * ============================================================ */

window.placifySupervisor =
  new PlacifySupervisorAgent();


/* ============================================================
   DEBUG CONFIRMATION
   ============================================================ */

console.log(
  '✅ Placify Agent Network initialized successfully.'
);

console.log(
  '🤖 Supervisor:',
  window.placifySupervisor
);

console.log(
  '🔐 AuthAgent:',
  window.placifySupervisor.authAgent
);

console.log(
  '🧠 QuizEvaluator:',
  window.placifySupervisor.quizEvaluator
);

console.log(
  '🗺️ RoadmapGenerator:',
  window.placifySupervisor.roadmapGenerator
);

console.log(
  '🎯 PersonalizedRoadmap:',
  window.placifySupervisor.personalizedRoadmap
);

console.log(
  '📚 ResourceSuggester:',
  window.placifySupervisor.resourceSuggester
);

console.log(
  '📝 ResourceFetcher:',
  window.placifySupervisor.resourceFetcher
);

console.log(
  '📈 ProgressTracker:',
  window.placifySupervisor.progressTracker
);