/**
 * Placify Backend Server & MongoDB Atlas Database Connector
 * Database: placify
 * Collection: Registration
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Groq = require('groq-sdk');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const url = require('url');
const mongoose = require('mongoose');

const { getKnowledgeGraph, getAllSkillsInGraph, normalizeDomainKey, DOMAIN_CONFIG, isDSADomain } = require('../engine/knowledgeGraph');
const { filterAndSelectCandidateQuestions, getDomainTopics, getDifficultyDistribution, validateQuestionObject, shuffleOptionsAndRemapCorrect } = require('../engine/questionPool');
const { buildUserSkillProfile, updateSkillMastery } = require('../engine/skillProfiler');
const { generateIntelligentRoadmap, validateRoadmap } = require('../engine/roadmapPlanner');
const { recalculateAdaptiveRoadmap } = require('../engine/adaptiveEngine');
const { fetchPersonalizedTechNews } = require('../services/techNewsService');
const { fetchPersonalizedInternships } = require('../services/internshipService');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Global Active Quiz Store for Session Persistence
global.activeQuizStore = global.activeQuizStore || new Map();

/**
 * Canonical Daily Task Normalizer Adapter
 * Guarantees every task object adheres to one canonical contract
 */
function normalizeDailyTask(rawTask, context = {}) {
  if (!rawTask || typeof rawTask !== 'object') {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ROADMAP TASK CONTRACT ERROR] Received non-object rawTask:', { rawTask, context });
    }
    return null;
  }

  const taskId = rawTask.taskId || rawTask.id || context.taskId || `task_${context.monthNumber || 1}_${context.weekNumber || 1}_${context.dayNumber || 1}_1`;
  
  const dayNumber = parseInt(rawTask.dayNumber !== undefined ? rawTask.dayNumber : (rawTask.day_number !== undefined ? rawTask.day_number : context.dayNumber), 10) || 1;
  const monthNumber = parseInt(rawTask.monthNumber !== undefined ? rawTask.monthNumber : (rawTask.month_number !== undefined ? rawTask.month_number : context.monthNumber), 10) || 1;
  const weekNumber = parseInt(rawTask.weekNumber !== undefined ? rawTask.weekNumber : (rawTask.week_number !== undefined ? rawTask.week_number : context.weekNumber), 10) || 1;
  
  const domain = normalizeDomainKey(rawTask.domain || rawTask.domainId || rawTask.chosen_domain || context.domain || 'fullstack');

  const taskType = (rawTask.taskType || rawTask.type || rawTask.task_type || context.taskType || 'LEARN').toUpperCase();

  let taskTitle = rawTask.taskTitle || rawTask.title || context.taskTitle || '';
  let taskTopic = rawTask.taskTopic || rawTask.topic || rawTask.task_topic || context.taskTopic || context.topic || 'Core Learning';
  let taskSubtopic = rawTask.taskSubtopic || rawTask.subtopic || rawTask.subskillName || rawTask.task_subtopic || context.taskSubtopic || context.subtopic || taskTopic;

  // Clean up any stray "undefined" text if it slipped in
  if (!taskTitle || taskTitle.includes('undefined')) {
    if (taskTitle.includes('Learn: undefined')) {
      taskTitle = `Learn: ${taskSubtopic}`;
    } else if (taskTitle.includes('Guided Practice: undefined')) {
      taskTitle = `Guided Practice: ${taskSubtopic} Drills`;
    } else if (taskTitle.includes('Implement: undefined')) {
      taskTitle = `Implement: ${taskSubtopic}`;
    } else if (taskTitle.includes('Assessment: undefined')) {
      taskTitle = `Assessment: ${taskSubtopic}`;
    } else {
      taskTitle = `${taskType === 'LEARN' ? 'Learn' : (taskType === 'PRACTICE' ? 'Practice' : 'Study')}: ${taskSubtopic}`;
    }
  }

  const durationMinutes = parseInt(
    rawTask.durationMinutes !== undefined ? rawTask.durationMinutes :
    (rawTask.estimated_minutes !== undefined ? rawTask.estimated_minutes :
    (rawTask.taskDuration !== undefined ? rawTask.taskDuration :
    (rawTask.duration !== undefined ? rawTask.duration :
    (rawTask.estHours !== undefined ? Math.round(rawTask.estHours * 60) : context.durationMinutes)))),
    10
  ) || 45;

  const difficulty = (rawTask.difficulty || rawTask.taskDifficulty || rawTask.userLevel || context.difficulty || 'BEGINNER').toUpperCase();
  const description = rawTask.description || rawTask.practice_details || rawTask.revision_details || rawTask.summary || context.description || `Core learning and practice module for ${taskSubtopic}.`;

  const normalized = {
    taskId,
    id: taskId,

    dayNumber,
    day_number: dayNumber,

    monthNumber,
    month_number: monthNumber,

    weekNumber,
    week_number: weekNumber,

    domain,
    domainId: domain,

    taskType,
    type: taskType,

    taskTitle,
    title: taskTitle,

    taskTopic,
    topic: taskTopic,

    taskSubtopic,
    subtopic: taskSubtopic,
    subskillName: taskSubtopic,

    description,
    practice_details: description,

    difficulty,

    durationMinutes,
    estimated_minutes: durationMinutes
  };

  // Requirement 3: FAIL LOUDLY IN DEVELOPMENT
  if (!normalized.taskTitle || !normalized.taskType || !normalized.durationMinutes || normalized.taskTitle.includes('undefined')) {
    console.error('[ROADMAP TASK CONTRACT ERROR]', {
      taskId,
      domain,
      monthNumber,
      weekNumber,
      dayNumber,
      rawTask,
      normalizedTask: normalized
    });
  }

  return normalized;
}

/**
 * Local Calendar Date Helpers (Server-side)
 */
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

function attachCalendarDatesToRoadmap(roadmap, startDateInput) {
  if (!roadmap) return roadmap;
  const monthlyList = roadmap.monthly_roadmap || (Array.isArray(roadmap) ? roadmap : null);
  if (!Array.isArray(monthlyList)) return roadmap;

  const baseStartDate = startDateInput || roadmap.journey_start_date || new Date().toISOString().slice(0, 10);
  let overallDayIndex = 0;

  monthlyList.forEach((m) => {
    let monthStartDetails = null;
    let monthEndDetails = null;

    if (Array.isArray(m.weeks)) {
      m.weeks.forEach((w) => {
        let weekStartDetails = null;
        let weekEndDetails = null;

        if (Array.isArray(w.days)) {
          w.days.forEach((d) => {
            const dNum = parseInt(d.day_number, 10) || (overallDayIndex + 1);
            const dateDetails = getCalendarDateDetails(baseStartDate, dNum - 1);

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
              if (d.topic && d.topic.startsWith('Sunday Weekly Revision (')) {
                d.topic = d.topic.replace(/^Sunday Weekly Revision \((.*)\)$/, '$1');
              }
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

/**
 * Normalizes entire Roadmap structure cleanly
 */
function normalizeRoadmap(roadmap) {
  if (!roadmap || typeof roadmap !== 'object') return roadmap;

  const normDomain = normalizeDomainKey(roadmap.domain || roadmap.domainId || roadmap.chosen_domain);
  roadmap.domain = normDomain;
  roadmap.domainId = normDomain;
  roadmap.domainName = DOMAIN_CONFIG[normDomain] ? DOMAIN_CONFIG[normDomain].displayName : (roadmap.domainName || normDomain);

  let nextIncompleteDayNum = null;

  if (Array.isArray(roadmap.monthly_roadmap)) {
    roadmap.monthly_roadmap.forEach(m => {
      if (Array.isArray(m.weeks)) {
        m.weeks.forEach(w => {
          if (Array.isArray(w.days)) {
            w.days.forEach(d => {
              const dayMins = d.total_minutes || d.estimated_minutes || 120;
              d.total_minutes = dayMins;
              d.estimated_minutes = dayMins;
              d.id = d.id || d.dayId || d.day_id || `day_${d.day_number}`;
              d.day_id = d.id;
              d.dayId = d.id;

              const isDone = d.completed || d.completedManually ||
                (d.assessment && (
                  d.assessment.completionStatus === 'completed' ||
                  d.assessment.assessmentStatus === 'completed' ||
                  d.assessment.status === 'completed' ||
                  d.assessment.completedManually
                ));

              if (isDone) {
                d.status = 'completed';
                d.completed = true;
              } else if (nextIncompleteDayNum === null) {
                d.status = 'available';
                nextIncompleteDayNum = parseInt(d.day_number, 10);
              } else {
                d.status = 'locked';
              }

              if (Array.isArray(d.tasks)) {
                d.tasks = d.tasks.map((t, idx) => normalizeDailyTask(t, {
                  domain: normDomain,
                  monthNumber: m.month_number,
                  weekNumber: w.week_number,
                  dayNumber: d.day_number,
                  topic: d.topic,
                  taskSeq: idx + 1
                })).filter(Boolean);
              }
            });
          }
        });
      }
    });
  }

  roadmap.next_incomplete_day = nextIncompleteDayNum || 1;
  roadmap.current_active_day = nextIncompleteDayNum || 1;

  const rawMode = roadmap.generation_mode || roadmap.generationMode;
  if (rawMode === 'direct' || rawMode === 'quiz') {
    roadmap.generation_mode = rawMode;
  } else {
    roadmap.generation_mode = (roadmap.quiz_score !== null && roadmap.quiz_score !== undefined) ? 'quiz' : 'direct';
  }

  if (roadmap.generation_mode === 'direct') {
    roadmap.quiz_score = null;
  }

  // Attach real device calendar dates to all days
  attachCalendarDatesToRoadmap(roadmap, roadmap.journey_start_date);

  return roadmap;
}

/**
 * Data Integrity Validation Layer before saving to MongoDB Atlas
 */
function validateRoadmapDataIntegrity(roadmap) {
  if (!roadmap || !Array.isArray(roadmap.monthly_roadmap)) {
    throw new Error('[DATA INTEGRITY ERROR] Roadmap object missing monthly_roadmap array.');
  }

  const errors = [];
  const normDomain = normalizeDomainKey(roadmap.domain || roadmap.domainId);

  roadmap.monthly_roadmap.forEach((m, mIdx) => {
    const monthNum = m.month_number || (mIdx + 1);
    if (!Array.isArray(m.weeks)) {
      errors.push(`Month ${monthNum} has no weeks array.`);
      return;
    }

    m.weeks.forEach((w, wIdx) => {
      const weekNum = w.week_number || (wIdx + 1);
      if (!Array.isArray(w.days)) {
        errors.push(`Week ${weekNum} has no days array.`);
        return;
      }

      w.days.forEach((d, dIdx) => {
        const dayNum = d.day_number || (dIdx + 1);
        if (!Array.isArray(d.tasks) || d.tasks.length === 0) {
          errors.push(`Month ${monthNum} Week ${weekNum} Day ${dayNum} has no tasks.`);
          return;
        }

        d.tasks.forEach((t, tIdx) => {
          if (!t.taskId && !t.id) errors.push(`Month ${monthNum} Week ${weekNum} Day ${dayNum} Task ${tIdx + 1} missing taskId.`);
          if (!t.taskTitle && !t.title) errors.push(`Month ${monthNum} Week ${weekNum} Day ${dayNum} Task ${tIdx + 1} missing taskTitle.`);
          if (t.taskTitle && t.taskTitle.includes('undefined')) errors.push(`Month ${monthNum} Week ${weekNum} Day ${dayNum} Task ${tIdx + 1} title contains 'undefined': "${t.taskTitle}".`);
          if (!t.taskType && !t.type) errors.push(`Month ${monthNum} Week ${weekNum} Day ${dayNum} Task ${tIdx + 1} missing taskType.`);
          if (!t.durationMinutes && !t.estimated_minutes) errors.push(`Month ${monthNum} Week ${weekNum} Day ${dayNum} Task ${tIdx + 1} missing durationMinutes.`);
          if (t.monthNumber !== monthNum && t.month_number !== monthNum) errors.push(`Month ${monthNum} Week ${weekNum} Day ${dayNum} Task ${tIdx + 1} month mismatch.`);
          if (t.weekNumber !== weekNum && t.week_number !== weekNum) errors.push(`Month ${monthNum} Week ${weekNum} Day ${dayNum} Task ${tIdx + 1} week mismatch.`);
          if (t.dayNumber !== dayNum && t.day_number !== dayNum) errors.push(`Month ${monthNum} Week ${weekNum} Day ${dayNum} Task ${tIdx + 1} day mismatch.`);
        });
      });
    });
  });

  if (errors.length > 0) {
    console.error('[ROADMAP DATA INTEGRITY VALIDATION FAILED]', errors);
    throw new Error(`Roadmap Data Integrity Validation Failed: ${errors.join('; ')}`);
  }

  return true;
}


// ============================================================
// 1. CHECK MONGODB CONFIGURATION
// ============================================================

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is missing from .env file.');
  process.exit(1);
}


// ============================================================
// 2. USER SCHEMA
// ============================================================

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      unique: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password_hash: {
      type: String,
      required: true
    },

    salt: {
      type: String,
      required: true
    },

    chosen_domain: {
      type: String,
      default: null
    },

    dsa_programming_language: {
      type: String,
      default: null
    },

    timeline_months: {
      type: Number,
      default: 4
    },

    daily_hours: {
      type: Number,
      default: 2.0
    },

    current_skill_level: {
      type: String,
      default: 'UNASSESSED'
    },

    target_skill_level: {
      type: String,
      default: 'ADVANCED'
    },

    quiz_completed: {
      type: Boolean,
      default: false
    },

    last_route: {
      type: String,
      default: 'roadmap'
    },

    roadmap_status: {
      type: String,
      enum: ['NOT_STARTED', 'GENERATING', 'READY', 'FAILED', 'ROADMAP_REQUIRED'],
      default: 'NOT_STARTED'
    },

    journey_started: {
      type: Boolean,
      default: false
    },

    journey_start_date: {
      type: Date,
      default: null
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'Registration'
  }
);


// ============================================================
// 3. MONGOOSE MODEL
// ============================================================

const User = mongoose.model('User', userSchema);


// ============================================================
// 3b. QUIZ EVALUATION SCHEMA & MODEL
// ============================================================

const quizEvaluationSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true
    },
    domain: {
      type: String,
      required: true
    },
    score_pct: {
      type: Number,
      default: null
    },
    correct_count: {
      type: Number,
      default: 0
    },
    total_questions: {
      type: Number,
      default: 0
    },
    skill_level: {
      type: String,
      default: 'BEGINNER'
    },
    level_description: {
      type: String,
      required: true
    },
    mastered_topics: [
      {
        topic: String,
        accuracy_pct: Number
      }
    ],
    knowledge_gaps: [
      {
        topic: String,
        accuracy_pct: Number,
        reason: String
      }
    ],
    topic_evaluations: [
      {
        topic: String,
        correct_count: Number,
        total_questions: Number,
        score_pct: Number,
        proficiency_level: String,
        beginner_accuracy: Number,
        intermediate_accuracy: Number,
        advanced_accuracy: Number,
        weak_concepts: [String],
        reason: String
      }
    ],
    answers: [mongoose.Schema.Types.Mixed],
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'quiz_evaluations'
  }
);

const QuizEvaluation = mongoose.model('QuizEvaluation', quizEvaluationSchema, 'quiz_evaluations');

// ============================================================
// 3b3. QUIZ ATTEMPT SCHEMA & MODEL (CONTROLLED RANDOMIZATION)
// ============================================================

const quizAttemptSchema = new mongoose.Schema(
  {
    quizAttemptId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    user_id: {
      type: String,
      required: true,
      index: true
    },
    domain: {
      type: String,
      required: true
    },
    level: {
      type: String,
      required: true
    },
    questionCount: {
      type: Number,
      default: 10
    },
    randomSeed: {
      type: String,
      required: true
    },
    questions: [mongoose.Schema.Types.Mixed],
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED'],
      default: 'ACTIVE'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'quiz_attempts'
  }
);

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema, 'quiz_attempts');


// ============================================================
// 3b2. USER SKILL PROFILE SCHEMA & MODEL
// ============================================================

const userSkillProfileSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
      unique: true
    },
    domain: {
      type: String,
      required: true
    },
    skills: [
      {
        skillId: String,
        topic: String,
        subtopic: String,
        skillName: String,
        masteryScore: Number,
        confidence: Number,
        evidence: {
          correct: Number,
          total: Number
        },
        level: String,
        lastAssessedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'user_skill_profiles'
  }
);

const UserSkillProfile = mongoose.model('UserSkillProfile', userSkillProfileSchema, 'user_skill_profiles');


// ============================================================
// 3c. ROADMAP SCHEMA & MODEL
// ============================================================

const taskSchema = new mongoose.Schema({
  id: String,
  title: String,
  type: {
    type: String,
    enum: ['LEARN', 'PRACTICE', 'IMPLEMENT', 'PROBLEM_SOLVING', 'REVISION', 'ASSESSMENT', 'PROJECT', 'MOCK_TEST'],
    default: 'LEARN'
  },
  estimated_minutes: Number,
  difficulty: String,
  resources_ref: String,
  practice_details: String,
  revision_details: String,
  recommended_resources: {
    type: Array,
    default: []
  }
}, { _id: false, strict: false });

const daySchema = new mongoose.Schema({
  day_number: Number,
  day_name: String,
  topic: String,
  tasks: [taskSchema],
  total_minutes: Number,
  completed: {
    type: Boolean,
    default: false
  },
  assessment: {
    type: Object,
    default: null
  }
}, { _id: false, strict: false });

const weekSchema = new mongoose.Schema({
  week_number: Number,
  month_number: Number,
  title: String,
  objective: String,
  topics: [String],
  subtopics: [String],
  estimated_hours: Number,
  practice: String,
  revision: String,
  assessment: String,
  expected_outcomes: [String],
  days: [daySchema],
  sunday_revision: {
    type: Object,
    default: null
  }
}, { _id: false, strict: false });

const monthSchema = new mongoose.Schema({
  month_number: Number,
  title: String,
  objective: String,
  topics: [String],
  subtopics: [String],
  estimated_hours: Number,
  priority: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'HIGH'
  },
  difficulty: {
    type: String,
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
    default: 'INTERMEDIATE'
  },
  expected_outcomes: [String],
  weeks: [weekSchema]
}, { _id: false });

const roadmapSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true
    },
    domain: {
      type: String,
      required: true
    },
    timeline_months: {
      type: Number,
      required: true
    },
    daily_hours: {
      type: Number,
      required: true
    },
    quiz_score: {
      type: Number,
      default: null
    },
    generation_mode: {
      type: String,
      enum: ['quiz', 'direct'],
      default: 'direct'
    },
    journey_started: {
      type: Boolean,
      default: false
    },
    journey_start_date: {
      type: Date,
      default: null
    },
    dsa_programming_language: {
      type: String,
      default: null
    },
    overall_level: {
      type: String,
      default: null
    },
    current_skill_level: {
      type: String,
      default: 'BEGINNER'
    },
    target_skill_level: {
      type: String,
      default: 'ADVANCED'
    },
    assessment_status: {
      type: String,
      enum: ['completed', 'not_attempted'],
      default: 'not_attempted'
    },
    topic_proficiencies: {
      type: Array,
      default: []
    },
    weak_topics: {
      type: Array,
      default: []
    },
    strong_topics: {
      type: Array,
      default: []
    },
    starting_point: {
      type: String,
      default: null
    },
    curriculum_version: {
      type: String,
      default: 'v2_placement'
    },
    topic_performances: [
      {
        topic: String,
        score: Number,
        status: String
      }
    ],
    monthly_roadmap: [monthSchema],
    generated_at: {
      type: Date,
      default: Date.now
    },
    updated_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'roadmaps'
  }
);

const Roadmap = mongoose.model('Roadmap', roadmapSchema, 'roadmaps');

// ============================================================
// RESOURCE RECOMMENDATION SCHEMA & MODEL
// ============================================================

const resourceSchema = new mongoose.Schema(
  {
    resource_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    category_label: {
      type: String,
      default: 'PRIMARY' // PRIMARY, ALTERNATIVE, PRACTICE
    },
    title: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    resource_type: {
      type: String,
      required: true // TUTORIAL, PRACTICE, DOCUMENTATION, CHEAT_SHEET, PROJECT, QUIZ, VIDEO
    },
    description: {
      type: String,
      default: ''
    },
    topic: {
      type: String,
      required: true
    },
    subtopic: {
      type: String,
      default: ''
    },
    domain: {
      type: String,
      required: true
    },
    difficulty: {
      type: String,
      required: true // BEGINNER, INTERMEDIATE, ADVANCED, MASTERED
    },
    estimated_minutes: {
      type: Number,
      default: 30
    },
    recommended_section: {
      type: String,
      default: ''
    },
    relevance_reason: {
      type: String,
      default: ''
    },
    is_official: {
      type: Boolean,
      default: false
    },
    quality_score: {
      type: Number,
      default: 80
    },
    verified_at: {
      type: Date,
      default: Date.now
    },
    is_valid: {
      type: Boolean,
      default: true
    }
  },
  {
    collection: 'resources'
  }
);

const Resource = mongoose.model('Resource', resourceSchema, 'resources');

// ============================================================
// TRUSTED RESOURCE REGISTRY (Extensible Catalog across 8 Tech Domains)
// ============================================================

const TRUSTED_RESOURCES = [
  // --- DATA SCIENCE & MACHINE LEARNING ---
  {
    resource_id: 'ds_py_vars_official',
    title: 'Python Official Tutorial: An Informal Introduction to Python',
    platform: 'Python.org',
    url: 'https://docs.python.org/3/tutorial/introduction.html#using-python-as-a-calculator',
    resource_type: 'TUTORIAL',
    description: 'Official Python documentation covering numbers, strings, variables, assignment, and basic expressions.',
    topic: 'Python Fundamentals',
    subtopic: 'Variables & Primitive Data Types',
    domain: 'datascience',
    difficulty: 'BEGINNER',
    estimated_minutes: 35,
    recommended_section: 'Section 3.1: Using Python as a Calculator (Numbers & Strings)',
    relevance_reason: 'Directly covers variables, assignment, primitive data types, and basic expressions.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'ds_py_vars_practice',
    title: 'W3Schools Python Variables & Data Types Exercises',
    platform: 'W3Schools',
    url: 'https://www.w3schools.com/python/python_variables.asp',
    resource_type: 'PRACTICE',
    description: 'Interactive beginner code exercises on declaring variables, casting types, and printing outputs in Python.',
    topic: 'Python Fundamentals',
    subtopic: 'Variables & Primitive Data Types',
    domain: 'datascience',
    difficulty: 'BEGINNER',
    estimated_minutes: 25,
    recommended_section: 'Python Variable Drills & Interactive Quiz',
    relevance_reason: 'Provides guided interactive practice for beginner Python variable assignment and data type manipulation.',
    is_official: false,
    quality_score: 85
  },
  {
    resource_id: 'ds_py_ctrl_official',
    title: 'Python Official Guide: More Control Flow Tools',
    platform: 'Python.org',
    url: 'https://docs.python.org/3/tutorial/controlflow.html#if-statements',
    resource_type: 'TUTORIAL',
    description: 'Official Python documentation for conditional statements (if, elif, else) and loops (for, while, break, continue).',
    topic: 'Python Fundamentals',
    subtopic: 'Control Flow (if/else, loops)',
    domain: 'datascience',
    difficulty: 'BEGINNER',
    estimated_minutes: 35,
    recommended_section: 'Section 4.1 - 4.5: if Statements, for Statements, and the range() Function',
    relevance_reason: 'Official documentation for conditional execution, iteration, and range loops.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'ds_py_ctrl_practice',
    title: 'W3Schools Python For & While Loops Practice',
    platform: 'W3Schools',
    url: 'https://www.w3schools.com/python/python_for_loops.asp',
    resource_type: 'PRACTICE',
    description: 'Interactive drills on conditional loops, break/continue statements, and nested iteration.',
    topic: 'Python Fundamentals',
    subtopic: 'Control Flow (if/else, loops)',
    domain: 'datascience',
    difficulty: 'BEGINNER',
    estimated_minutes: 25,
    recommended_section: 'For Loops Exercise & Self-Check Quiz',
    relevance_reason: 'Interactive practice for conditional logic and loop structures.',
    is_official: false,
    quality_score: 85
  },
  {
    resource_id: 'ds_py_func_official',
    title: 'Python Official Guide: Defining Functions & Scope',
    platform: 'Python.org',
    url: 'https://docs.python.org/3/tutorial/controlflow.html#defining-functions',
    resource_type: 'TUTORIAL',
    description: 'Official Python documentation explaining function definitions, parameters, argument passing, return values, and scope.',
    topic: 'Python Fundamentals',
    subtopic: 'Functions, Scope & Recursion',
    domain: 'datascience',
    difficulty: 'BEGINNER',
    estimated_minutes: 40,
    recommended_section: 'Section 4.6: Defining Functions',
    relevance_reason: 'Official documentation for defining functions, return values, parameters, and variable scope.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'ds_py_func_inter',
    title: 'Python Functions & Modular Programming Guide',
    platform: 'Real Python',
    url: 'https://realpython.com/defining-your-own-python-function/',
    resource_type: 'IMPLEMENTATION',
    description: 'Comprehensive practical guide to function signatures, default arguments, *args, **kwargs, and modular code patterns.',
    topic: 'Python Fundamentals',
    subtopic: 'Functions, Scope & Recursion',
    domain: 'datascience',
    difficulty: 'INTERMEDIATE',
    estimated_minutes: 35,
    recommended_section: 'Section 2: Arguments, Keyword Parameters & Scope',
    relevance_reason: 'Focuses on practical implementation patterns for functions and modular code architecture.',
    is_official: false,
    quality_score: 90
  },
  {
    resource_id: 'ds_py_struct_official',
    title: 'Python Official Tutorial: Data Structures (Lists, Dicts, Sets)',
    platform: 'Python.org',
    url: 'https://docs.python.org/3/tutorial/datastructures.html',
    resource_type: 'TUTORIAL',
    description: 'Official Python guide on lists, tuples, dictionaries, list comprehensions, and nested collections.',
    topic: 'Python Fundamentals',
    subtopic: 'Python Data Structures (Lists, Dicts, Sets)',
    domain: 'datascience',
    difficulty: 'BEGINNER',
    estimated_minutes: 40,
    recommended_section: 'Section 5.1 & 5.5: More on Lists and Dictionaries',
    relevance_reason: 'Official documentation for list methods, dictionary key-value lookups, and list comprehensions.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'ds_numpy_official',
    title: 'NumPy Quickstart: Array Creation & Vectorization',
    platform: 'NumPy.org',
    url: 'https://numpy.org/doc/stable/user/quickstart.html',
    resource_type: 'DOCUMENTATION',
    description: 'Official NumPy user guide for N-dimensional arrays, vectorization, slicing, and mathematical operations.',
    topic: 'Python for Data Science & Math',
    subtopic: 'NumPy Arrays & Mathematical Operations',
    domain: 'datascience',
    difficulty: 'INTERMEDIATE',
    estimated_minutes: 45,
    recommended_section: 'Section 1: Array Basics & Universal Functions',
    relevance_reason: 'Official guide covering vectorized math operations and ndarray manipulation.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'ds_pandas_official',
    title: 'Pandas Tutorials: Data Structure & DataFrame Operations',
    platform: 'Pandas.pydata.org',
    url: 'https://pandas.pydata.org/docs/getting_started/intro_tutorials/01_table_oriented.html',
    resource_type: 'DOCUMENTATION',
    description: 'Official Pandas guide covering Series, DataFrames, indexing, filtering, and data cleaning methods.',
    topic: 'Data Preprocessing & EDA',
    subtopic: 'Pandas & NumPy Vectorization',
    domain: 'datascience',
    difficulty: 'INTERMEDIATE',
    estimated_minutes: 40,
    recommended_section: 'Tutorial 1: What kind of data does pandas handle?',
    relevance_reason: 'Official Pandas tutorial explaining table manipulation, data filtering, and vectorization.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'ds_sklearn_official',
    title: 'scikit-learn User Guide: Supervised Linear Models',
    platform: 'scikit-learn.org',
    url: 'https://scikit-learn.org/stable/modules/linear_model.html',
    resource_type: 'DOCUMENTATION',
    description: 'Official scikit-learn documentation for Linear Regression, Ridge, Lasso, and model fit/predict APIs.',
    topic: 'Machine Learning Fundamentals',
    subtopic: 'Supervised vs Unsupervised Concepts',
    domain: 'datascience',
    difficulty: 'INTERMEDIATE',
    estimated_minutes: 45,
    recommended_section: 'Section 1.1: Ordinary Least Squares & Linear Regression',
    relevance_reason: 'Official scikit-learn guide with API documentation and working code examples.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'ds_nlp_word2vec_official',
    title: 'PyTorch NLP Tutorial: Word Embeddings & Vector Representations',
    platform: 'PyTorch.org',
    url: 'https://pytorch.org/tutorials/beginner/nlp/word_embeddings_tutorial.html',
    resource_type: 'TUTORIAL',
    description: 'Official PyTorch tutorial explaining word embeddings (Word2Vec, Continuous Bag-of-Words) and dense vector spaces.',
    topic: 'Advanced Deep Learning & NLP',
    subtopic: 'Word Embeddings (Word2Vec / FastText)',
    domain: 'datascience',
    difficulty: 'ADVANCED',
    estimated_minutes: 50,
    recommended_section: 'Section 1: Word Embeddings in PyTorch & N-Gram Language Model',
    relevance_reason: 'Official PyTorch tutorial for building and training word embedding representations.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'ds_nlp_word2vec_gensim',
    title: 'Gensim Word2Vec Model Training Tutorial',
    platform: 'Gensim / Radim Rehurek',
    url: 'https://radimrehurek.com/gensim/auto_examples/tutorials/run_word2vec.html',
    resource_type: 'PRACTICE',
    description: 'Hands-on guide to training Word2Vec and FastText skip-gram / CBOW models on custom text corpora.',
    topic: 'Advanced Deep Learning & NLP',
    subtopic: 'Word Embeddings (Word2Vec / FastText)',
    domain: 'datascience',
    difficulty: 'ADVANCED',
    estimated_minutes: 40,
    recommended_section: 'Training Word2Vec Models & Evaluating Vector Similarities',
    relevance_reason: 'Practical tutorial for training and inspecting Word2Vec and FastText models.',
    is_official: false,
    quality_score: 92
  },
  {
    resource_id: 'ds_nlp_rnn_official',
    title: 'PyTorch Tutorial: Sequence Modeling with Recurrent Neural Networks (RNNs)',
    platform: 'PyTorch.org',
    url: 'https://pytorch.org/tutorials/intermediate/char_rnn_classification_tutorial.html',
    resource_type: 'TUTORIAL',
    description: 'Official PyTorch tutorial covering Character-level RNNs, LSTMs, sequence processing, and hidden states.',
    topic: 'Advanced Deep Learning & NLP',
    subtopic: 'Recurrent Networks & LSTMs',
    domain: 'datascience',
    difficulty: 'ADVANCED',
    estimated_minutes: 50,
    recommended_section: 'Creating the Network & Training Loop for Sequence Data',
    relevance_reason: 'Official PyTorch guide for building and training RNNs and LSTMs for sequence classification.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'ds_nlp_transformer_official',
    title: 'Hugging Face Transformers Documentation & Course',
    platform: 'Hugging Face',
    url: 'https://huggingface.co/docs/transformers/index',
    resource_type: 'DOCUMENTATION',
    description: 'Official Hugging Face documentation for self-attention, Transformer architectures, BERT, and GPT models.',
    topic: 'Advanced Deep Learning & NLP',
    subtopic: 'Transformers (BERT vs GPT)',
    domain: 'datascience',
    difficulty: 'ADVANCED',
    estimated_minutes: 45,
    recommended_section: 'Transformers Overview & Model Pipeline Execution',
    relevance_reason: 'Industry-standard documentation for fine-tuning and deploying Transformer models.',
    is_official: true,
    quality_score: 95
  },

  // --- CYBERSECURITY & ETHICAL HACKING ---
  {
    resource_id: 'sec_cli_linux_guide',
    title: 'Arch Linux Security & Privilege Management Guide',
    platform: 'Arch Wiki',
    url: 'https://wiki.archlinux.org/title/Security',
    resource_type: 'DOCUMENTATION',
    description: 'Authoritative guide to Linux user permissions, sudoers configuration, file modes, and system isolation.',
    topic: 'Computer Systems & CLI Fundamentals',
    subtopic: 'File Permissions & Privileges',
    domain: 'cybersecurity',
    difficulty: 'BEGINNER',
    estimated_minutes: 35,
    recommended_section: 'User Privilege Separation & File System Security',
    relevance_reason: 'Detailed security documentation covering Linux privileges, file permissions, and environment security.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'sec_win_hardening_official',
    title: 'Microsoft Windows Security Baseline & System Hardening',
    platform: 'Microsoft Learn',
    url: 'https://learn.microsoft.com/en-us/windows/security/',
    resource_type: 'DOCUMENTATION',
    description: 'Official Microsoft guide to Windows OS security baselines, Group Policy, AppLocker, and Defender controls.',
    topic: 'System Hardening & Privilege Escalation',
    subtopic: 'Linux/Windows Security Hardening',
    domain: 'cybersecurity',
    difficulty: 'ADVANCED',
    estimated_minutes: 45,
    recommended_section: 'Windows Security Baselines & Access Controls',
    relevance_reason: 'Official Microsoft documentation for OS hardening and enterprise threat mitigation.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'sec_owasp_official',
    title: 'OWASP Top 10 Web Application Security Risks',
    platform: 'OWASP.org',
    url: 'https://owasp.org/www-project-top-ten/',
    resource_type: 'DOCUMENTATION',
    description: 'Official OWASP foundation guide detailing XSS, SQLi, CSRF, and authentication vulnerabilities.',
    topic: 'Web Application Vulnerabilities',
    subtopic: 'OWASP Top 10 Deep Dive',
    domain: 'cybersecurity',
    difficulty: 'INTERMEDIATE',
    estimated_minutes: 45,
    recommended_section: 'A03:2021-Injection & A07:2021-Identification and Authentication Failures',
    relevance_reason: 'Industry standard security reference for web application security vulnerabilities.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'sec_wireshark_official',
    title: 'Wireshark User Guide: Network Packet Analysis',
    platform: 'Wireshark.org',
    url: 'https://www.wireshark.org/docs/wsug_html_chunked/',
    resource_type: 'TUTORIAL',
    description: 'Official Wireshark documentation for capturing packets, setting display filters, and inspecting TCP/IP handshakes.',
    topic: 'Networking Protocols & Traffic Analysis',
    subtopic: 'Wireshark Packet Capture',
    domain: 'cybersecurity',
    difficulty: 'BEGINNER',
    estimated_minutes: 40,
    recommended_section: 'Chapter 6: Working with Captured Packets & Filters',
    relevance_reason: 'Official documentation for network traffic analysis and protocol inspection.',
    is_official: true,
    quality_score: 95
  },

  // --- FULL-STACK WEB DEVELOPMENT ---
  {
    resource_id: 'fs_html_official',
    title: 'MDN Web Docs: Getting Started with HTML',
    platform: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/docs/Learn/HTML/Introduction_to_HTML/Getting_started',
    resource_type: 'TUTORIAL',
    description: 'Official MDN guide covering HTML elements, semantic markup, attributes, and page structure.',
    topic: 'Web & HTML/CSS Fundamentals',
    subtopic: 'HTML5 Semantic Elements',
    domain: 'fullstack',
    difficulty: 'BEGINNER',
    estimated_minutes: 35,
    recommended_section: 'Anatomy of an HTML Document & Semantic Tags',
    relevance_reason: 'Industry-standard documentation explaining HTML syntax and semantic elements.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'fs_js_official',
    title: 'MDN Web Docs: JavaScript First Steps',
    platform: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/First_steps/Variables',
    resource_type: 'TUTORIAL',
    description: 'Official MDN tutorial covering JavaScript variables, data types, numbers, and string operations.',
    topic: 'JavaScript Fundamentals',
    subtopic: 'Variables, Types & Operators',
    domain: 'fullstack',
    difficulty: 'BEGINNER',
    estimated_minutes: 30,
    recommended_section: 'Storing information you need — Variables',
    relevance_reason: 'Official MDN guide covering JS variable declarations (const, let, var) and data types.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'fs_react_official',
    title: 'React Official Documentation: Describing the UI',
    platform: 'React.dev',
    url: 'https://react.dev/learn/describing-the-ui',
    resource_type: 'DOCUMENTATION',
    description: 'Official React guide explaining JSX syntax, components, props, and conditional rendering.',
    topic: 'React & UI Architecture',
    subtopic: 'JSX & Component Hierarchy',
    domain: 'fullstack',
    difficulty: 'INTERMEDIATE',
    estimated_minutes: 40,
    recommended_section: 'Your First Component & Writing Markup with JSX',
    relevance_reason: 'Official React documentation for component architecture, JSX rules, and props.',
    is_official: true,
    quality_score: 95
  },

  // --- DATA STRUCTURES & ALGORITHMS ---
  {
    resource_id: 'dsa_bigo_official',
    title: 'Complexity Analysis & Big-O Notation Guide',
    platform: 'GeeksforGeeks',
    url: 'https://www.geeksforgeeks.org/analysis-algorithms-big-o-analysis/',
    resource_type: 'TUTORIAL',
    description: 'Structured guide to measuring time complexity O(1), O(N), O(N log N) and memory space overhead.',
    topic: 'Programming Logic & Complexity Analysis',
    subtopic: 'Big-O Time & Space Complexity Analysis',
    domain: 'dsa',
    difficulty: 'BEGINNER',
    estimated_minutes: 30,
    recommended_section: 'Big-O Time Complexity Examples & Asymptotic Analysis',
    relevance_reason: 'Comprehensive guide to computing Big-O time and space complexity bounds.',
    is_official: false,
    quality_score: 90
  },
  {
    resource_id: 'dsa_leetcode_practice',
    title: 'LeetCode Two Sum Problem & Discussion',
    platform: 'LeetCode',
    url: 'https://leetcode.com/problems/two-sum/',
    resource_type: 'PRACTICE',
    description: 'Interactive coding environment to solve Two Sum using Hash Map O(N) lookup technique.',
    topic: 'Arrays, Hash Maps & Two Pointers',
    subtopic: 'Two Sum & Pair Search',
    domain: 'dsa',
    difficulty: 'BEGINNER',
    estimated_minutes: 35,
    recommended_section: 'Problem Description & Online Code Executor',
    relevance_reason: 'Industry-standard interactive practice platform for two-sum and array hash lookup patterns.',
    is_official: false,
    quality_score: 95
  },

  // --- DEVOPS ---
  {
    resource_id: 'dev_docker_official',
    title: 'Docker Documentation: Orientation & Setup',
    platform: 'Docker.com',
    url: 'https://docs.docker.com/get-started/02_our_app/',
    resource_type: 'DOCUMENTATION',
    description: 'Official Docker guide covering container build commands, Dockerfile instructions, and container execution.',
    topic: 'Containerization & Docker',
    subtopic: 'Dockerfile Optimization',
    domain: 'devops',
    difficulty: 'INTERMEDIATE',
    estimated_minutes: 40,
    recommended_section: 'Building the App Container Image',
    relevance_reason: 'Official Docker documentation for creating, tagging, and running Docker containers.',
    is_official: true,
    quality_score: 95
  },
  {
    resource_id: 'dev_k8s_official',
    title: 'Kubernetes Tutorials: Kubernetes Basics',
    platform: 'Kubernetes.io',
    url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
    resource_type: 'DOCUMENTATION',
    description: 'Official Kubernetes guide covering Pods, Deployments, ReplicaSets, Services, and kubectl commands.',
    topic: 'Kubernetes Infrastructure',
    subtopic: 'Pods, Deployments & ReplicaSets',
    domain: 'devops',
    difficulty: 'INTERMEDIATE',
    estimated_minutes: 45,
    recommended_section: 'Deploying an App & Exploring Pods',
    relevance_reason: 'Official Kubernetes tutorial for container orchestration and cluster deployments.',
    is_official: true,
    quality_score: 95
  },

  // --- MOBILE APP DEVELOPMENT ---
  {
    resource_id: 'mob_flutter_official',
    title: 'Flutter Documentation: Building Layouts in Flutter',
    platform: 'Flutter.dev',
    url: 'https://docs.flutter.dev/ui/layout',
    resource_type: 'DOCUMENTATION',
    description: 'Official Flutter guide covering Row, Column, Container, Flexbox principles, and widget trees.',
    topic: 'Mobile UI Layouts & Components',
    subtopic: 'Flexbox Layout Engine',
    domain: 'mobile',
    difficulty: 'BEGINNER',
    estimated_minutes: 35,
    recommended_section: 'Layout Overview & Widget Alignment',
    relevance_reason: 'Official Flutter documentation explaining mobile layout widgets and styling.',
    is_official: true,
    quality_score: 95
  },

  // --- AI & LLM SYSTEMS ENGINEERING ---
  {
    resource_id: 'ai_pytorch_official',
    title: 'PyTorch Deep Learning with PyTorch: A 60 Minute Blitz',
    platform: 'PyTorch.org',
    url: 'https://pytorch.org/tutorials/beginner/deep_learning_60min_blitz.html',
    resource_type: 'TUTORIAL',
    description: 'Official PyTorch tutorial for Tensors, Autograd, Neural Networks, and Loss Optimizers.',
    topic: 'Python Programming & Math Foundations',
    subtopic: 'Basic Linear Algebra & Vectors',
    domain: 'ai_llm',
    difficulty: 'BEGINNER',
    estimated_minutes: 50,
    recommended_section: 'Tensors & Tensor Operations in PyTorch',
    relevance_reason: 'Official PyTorch tutorial for mathematical tensors, vector operations, and matrix multiplication.',
    is_official: true,
    quality_score: 95
  },

  // --- SYSTEM DESIGN ---
  {
    resource_id: 'sd_loadbalancer_official',
    title: 'System Design Primer: Load Balancing & Scalability',
    platform: 'GitHub / System Design Primer',
    url: 'https://github.com/donnemartin/system-design-primer#load-balancer',
    resource_type: 'DOCUMENTATION',
    description: 'Comprehensive system design reference for Layer 4/7 load balancers, round-robin, and consistent hashing.',
    topic: 'Scalability & Load Balancing',
    subtopic: 'Horizontal vs Vertical Scaling',
    domain: 'system_design',
    difficulty: 'INTERMEDIATE',
    estimated_minutes: 40,
    recommended_section: 'Load Balancer Architecture & Consistent Hashing',
    relevance_reason: 'High-quality technical reference explaining scalability patterns and load balancing algorithms.',
    is_official: false,
    quality_score: 95
  }
];

// Helper: URL Validator
function validateResourceURL(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) return false;
  if (clean.includes('google.com/search') || clean.includes('bing.com/search') || clean.includes('search?q=')) return false;
  if (clean === 'https://youtube.com/' || clean === 'https://coursera.org/' || clean === 'https://www.google.com/') return false;
  return true;
}

// Helper: Calculate Resource Match Score (0 - 100)
function calculateResourceMatchScore(resource, task) {
  const taskDomain = canonicalizeDomainKey(task.domain || task.chosen_domain);
  const resDomain = canonicalizeDomainKey(resource.domain);

  // Hard Domain Filter: Mismatched domain scores 0
  if (resDomain !== taskDomain && resource.domain !== 'all') {
    return 0;
  }

  let score = 0;

  // 1. Task Relevance (40%)
  const taskTitleClean = (task.taskTitle || task.title || '').toLowerCase();
  const taskTopicClean = (task.dailyTopic || task.topic || '').toLowerCase();
  const subtopicClean = (task.subtopic || '').toLowerCase();
  const resTitle = (resource.title || '').toLowerCase();
  const resTopic = (resource.topic || '').toLowerCase();
  const resSubtopic = (resource.subtopic || '').toLowerCase();

  let relevancePoints = 0;
  if (resSubtopic && subtopicClean && (resSubtopic.includes(subtopicClean) || subtopicClean.includes(resSubtopic))) {
    relevancePoints += 40;
  } else if (resTopic && taskTopicClean && (resTopic.includes(taskTopicClean) || taskTopicClean.includes(resTopic))) {
    relevancePoints += 30;
  } else if (taskTitleClean.split(' ').some(w => w.length > 3 && (resTitle.includes(w) || resTopic.includes(w)))) {
    relevancePoints += 20;
  } else {
    relevancePoints += 5;
  }

  score += Math.min(40, relevancePoints);

  // 2. Level Match (20%)
  const userLevel = (task.userLevel || task.difficulty || task.taskDifficulty || 'BEGINNER').toUpperCase();
  const resLevel = (resource.difficulty || 'BEGINNER').toUpperCase();
  if (userLevel === resLevel) {
    score += 20;
  } else if ((userLevel === 'BEGINNER' && resLevel === 'INTERMEDIATE') || (userLevel === 'INTERMEDIATE' && resLevel === 'BEGINNER')) {
    score += 10;
  } else {
    score += 5;
  }

  // 3. Task Type Match (15%)
  const tType = (task.taskType || task.type || 'LEARN').toUpperCase();
  const rType = (resource.resource_type || resource.type || 'TUTORIAL').toUpperCase();

  if (tType === 'LEARN' && (rType === 'TUTORIAL' || rType === 'GUIDE' || rType === 'DOCUMENTATION')) score += 15;
  else if (tType === 'PRACTICE' && (rType === 'PRACTICE' || rType === 'EXERCISE' || rType === 'QUIZ')) score += 15;
  else if (tType === 'IMPLEMENT' && (rType === 'DOCUMENTATION' || rType === 'API' || rType === 'IMPLEMENTATION')) score += 15;
  else if (tType === 'REVISION' && (rType === 'CHEAT_SHEET' || rType === 'SUMMARY' || rType === 'REFERENCE')) score += 15;
  else score += 5;

  // 4. Quality & Official Authority (15%)
  if (resource.is_official) score += 15;
  else score += Math.round(((resource.quality_score || 80) / 100) * 15);

  // 5. Duration Suitability (10%)
  const taskMins = task.taskDuration || task.estimated_minutes || 30;
  const resMins = resource.estimated_minutes || 30;
  const diffMins = Math.abs(taskMins - resMins);
  if (diffMins <= 15) score += 10;
  else if (diffMins <= 30) score += 5;
  else score += 2;

  return Math.min(100, Math.round(score));
}

// Stage 1 & Stage 2 Resource Recommendation Engine
// Helper: Strict Domain & Task Relevance Validation
function isResourceRelevantToContext(resource, taskContext) {
  const domainKey = canonicalizeDomainKey(taskContext.domain || taskContext.chosen_domain);
  const resDomain = canonicalizeDomainKey(resource.domain);

  // 1. HARD DOMAIN FILTER: Reject resources from mismatched domains
  if (resDomain !== domainKey && resource.domain !== 'all') {
    return false;
  }

  // 2. REJECT CROSS-TOPIC POLLUTION: Variables resource rejected for Control Flow, Functions, Word Embeddings, etc.
  const taskTopic = (taskContext.dailyTopic || taskContext.topic || taskContext.taskTitle || taskContext.title || '').toLowerCase();
  const taskSubtopic = (taskContext.subtopic || '').toLowerCase();
  const taskTitle = (taskContext.taskTitle || taskContext.title || '').toLowerCase();

  const resTitle = (resource.title || '').toLowerCase();
  const resSubtopic = (resource.subtopic || '').toLowerCase();

  // Control Flow tasks should not accept pure Variables resources
  if ((taskTopic.includes('control flow') || taskTitle.includes('control flow') || taskSubtopic.includes('control flow')) &&
      (resSubtopic.includes('variables') || resTitle.includes('primitive data types')) &&
      !resTitle.includes('control flow') && !resTitle.includes('if') && !resTitle.includes('loop')) {
    return false;
  }

  // Functions tasks should not accept pure Variables resources
  if ((taskTopic.includes('function') || taskTitle.includes('function') || taskSubtopic.includes('function')) &&
      (resSubtopic.includes('variables') || resTitle.includes('primitive data types')) &&
      !resTitle.includes('function')) {
    return false;
  }

  // Word Embeddings tasks should not accept generic Python Variables or Functions resources
  if ((taskTopic.includes('embedding') || taskTitle.includes('word2vec') || taskSubtopic.includes('word embeddings')) &&
      (resTitle.includes('informal introduction to python') || resTitle.includes('defining functions')) &&
      !resTitle.includes('embedding') && !resTitle.includes('word2vec')) {
    return false;
  }

  return true;
}

// Helper: Dynamic Domain-Specific & Task-Specific Resource Generator with Authentic Deep-Links
function generateDynamicDomainTaskResources(taskContext) {
  const domainKey = canonicalizeDomainKey(taskContext.domain || taskContext.chosen_domain);
  const cleanLevel = (taskContext.difficulty || taskContext.userLevel || taskContext.taskDifficulty || 'BEGINNER').toUpperCase();
  const cleanTopic = taskContext.dailyTopic || taskContext.topic || 'Core Learning';
  const taskTitle = taskContext.taskTitle || taskContext.title || cleanTopic;
  const taskType = (taskContext.taskType || taskContext.type || 'LEARN').toUpperCase();
  const duration = taskContext.taskDuration || taskContext.estimated_minutes || 30;

  const topicLower = (cleanTopic + ' ' + taskTitle + ' ' + (taskContext.subtopic || '')).toLowerCase();

  let primaryRes = null;
  let practiceRes = null;

  // 1. DATA SCIENCE & ML DEEP-LINKS
  if (domainKey === 'datascience') {
    if (topicLower.includes('word2vec') || topicLower.includes('embedding') || topicLower.includes('fasttext')) {
      primaryRes = {
        resource_id: `dyn_${taskContext.taskId || Date.now()}_1`,
        category_label: 'PRIMARY',
        title: 'PyTorch NLP Tutorial: Word Embeddings & Vector Representations',
        platform: 'PyTorch.org',
        url: 'https://pytorch.org/tutorials/beginner/nlp/word_embeddings_tutorial.html',
        resource_type: 'TUTORIAL',
        description: 'Official PyTorch tutorial for building dense word embedding matrices, N-gram language models, and vector representations.',
        topic: cleanTopic,
        subtopic: taskContext.subtopic || 'Word Embeddings (Word2Vec / FastText)',
        domain: domainKey,
        difficulty: cleanLevel,
        estimated_minutes: duration,
        recommended_section: 'Section 1: Word Embeddings in PyTorch & N-Gram Language Model',
        relevance_reason: `Targeted PyTorch NLP tutorial for word embeddings and vector spaces.`,
        is_official: true,
        quality_score: 95
      };
      practiceRes = {
        resource_id: `dyn_${taskContext.taskId || Date.now()}_2`,
        category_label: 'PRACTICE',
        title: 'Gensim Word2Vec Model Training Tutorial & Vector Similarities',
        platform: 'Gensim',
        url: 'https://radimrehurek.com/gensim/auto_examples/tutorials/run_word2vec.html',
        resource_type: 'PRACTICE',
        description: 'Practical guide to training Word2Vec and FastText skip-gram / CBOW models on custom text corpora.',
        topic: cleanTopic,
        subtopic: taskContext.subtopic || 'Word Embeddings (Word2Vec / FastText)',
        domain: domainKey,
        difficulty: cleanLevel,
        estimated_minutes: Math.round(duration * 0.7),
        recommended_section: 'Training Word2Vec Models & Evaluating Vector Similarities',
        relevance_reason: `Hands-on practical notebook for training Word2Vec and FastText models.`,
        is_official: false,
        quality_score: 92
      };
    } else if (topicLower.includes('rnn') || topicLower.includes('lstm') || topicLower.includes('recurrent')) {
      primaryRes = {
        resource_id: `dyn_${taskContext.taskId || Date.now()}_1`,
        category_label: 'PRIMARY',
        title: 'PyTorch Sequence Modeling with Recurrent Neural Networks (RNNs)',
        platform: 'PyTorch.org',
        url: 'https://pytorch.org/tutorials/intermediate/char_rnn_classification_tutorial.html',
        resource_type: 'TUTORIAL',
        description: 'Official PyTorch tutorial covering Character-level RNNs, LSTMs, sequence processing, and hidden states.',
        topic: cleanTopic,
        subtopic: taskContext.subtopic || 'Recurrent Networks & LSTMs',
        domain: domainKey,
        difficulty: cleanLevel,
        estimated_minutes: duration,
        recommended_section: 'Creating the Network & Training Loop for Sequence Data',
        relevance_reason: 'Official PyTorch guide for building and training RNNs and LSTMs for sequence classification.',
        is_official: true,
        quality_score: 95
      };
      practiceRes = {
        resource_id: `dyn_${taskContext.taskId || Date.now()}_2`,
        category_label: 'PRACTICE',
        title: 'Understanding LSTMs & Recurrent Neural Network Architectures',
        platform: 'colah\'s blog',
        url: 'https://colah.github.io/posts/2015-08-Understanding-LSTMs/',
        resource_type: 'PRACTICE',
        description: 'Visual explanation of Recurrent Neural Networks, gating mechanisms, and LSTM memory cells.',
        topic: cleanTopic,
        subtopic: taskContext.subtopic || 'Recurrent Networks & LSTMs',
        domain: domainKey,
        difficulty: cleanLevel,
        estimated_minutes: Math.round(duration * 0.7),
        recommended_section: 'The Core Idea Behind LSTMs & Step-by-Step Walkthrough',
        relevance_reason: 'Essential reading for conceptual understanding of LSTM gates and memory persistence.',
        is_official: false,
        quality_score: 95
      };
    } else if (topicLower.includes('control flow') || topicLower.includes('loop') || topicLower.includes('if/else')) {
      primaryRes = {
        resource_id: `dyn_${taskContext.taskId || Date.now()}_1`,
        category_label: 'PRIMARY',
        title: 'Python Official Guide: More Control Flow Tools (if, for, while)',
        platform: 'Python.org',
        url: 'https://docs.python.org/3/tutorial/controlflow.html#if-statements',
        resource_type: 'TUTORIAL',
        description: 'Official Python documentation for conditional statements (if, elif, else) and loops (for, while, break, continue).',
        topic: cleanTopic,
        subtopic: taskContext.subtopic || 'Control Flow (if/else, loops)',
        domain: domainKey,
        difficulty: cleanLevel,
        estimated_minutes: duration,
        recommended_section: 'Section 4.1 - 4.5: if Statements, for Statements, and range()',
        relevance_reason: 'Official guide for Python conditional logic and loop structures.',
        is_official: true,
        quality_score: 95
      };
      practiceRes = {
        resource_id: `dyn_${taskContext.taskId || Date.now()}_2`,
        category_label: 'PRACTICE',
        title: 'W3Schools Python For & While Loops Practice Drills',
        platform: 'W3Schools',
        url: 'https://www.w3schools.com/python/python_for_loops.asp',
        resource_type: 'PRACTICE',
        description: 'Interactive beginner code exercises for for loops, while loops, and range iteration.',
        topic: cleanTopic,
        subtopic: taskContext.subtopic || 'Control Flow (if/else, loops)',
        domain: domainKey,
        difficulty: cleanLevel,
        estimated_minutes: Math.round(duration * 0.7),
        recommended_section: 'Python For Loops Exercises & Self-Check Drills',
        relevance_reason: 'Interactive practice for conditional loops and iteration.',
        is_official: false,
        quality_score: 85
      };
    }
  }

  // 2. CYBERSECURITY DEEP-LINKS
  if (domainKey === 'cybersecurity') {
    if (topicLower.includes('windows')) {
      primaryRes = {
        resource_id: `dyn_${taskContext.taskId || Date.now()}_1`,
        category_label: 'PRIMARY',
        title: 'Microsoft Windows Security Baseline & OS Hardening',
        platform: 'Microsoft Learn',
        url: 'https://learn.microsoft.com/en-us/windows/security/',
        resource_type: 'DOCUMENTATION',
        description: 'Official Microsoft documentation for Windows security baselines, privilege management, and Defender policies.',
        topic: cleanTopic,
        subtopic: taskContext.subtopic || 'Windows Security Hardening',
        domain: domainKey,
        difficulty: cleanLevel,
        estimated_minutes: duration,
        recommended_section: 'Windows Security Baselines & Access Controls',
        relevance_reason: 'Official Microsoft documentation for Windows OS security hardening.',
        is_official: true,
        quality_score: 95
      };
    } else {
      primaryRes = {
        resource_id: `dyn_${taskContext.taskId || Date.now()}_1`,
        category_label: 'PRIMARY',
        title: 'Arch Linux Security & System Hardening Guide',
        platform: 'Arch Wiki',
        url: 'https://wiki.archlinux.org/title/Security',
        resource_type: 'DOCUMENTATION',
        description: 'Comprehensive guide to Linux system hardening, file permissions, privilege separation, and PAM authentication.',
        topic: cleanTopic,
        subtopic: taskContext.subtopic || 'Linux Security Hardening',
        domain: domainKey,
        difficulty: cleanLevel,
        estimated_minutes: duration,
        recommended_section: 'User Privilege Separation & File System Security',
        relevance_reason: 'Authoritative guide to Linux OS hardening and privilege management.',
        is_official: true,
        quality_score: 95
      };
    }
    practiceRes = {
      resource_id: `dyn_${taskContext.taskId || Date.now()}_2`,
      category_label: 'PRACTICE',
      title: 'OWASP Security Hardening Cheat Sheet & Verification Drills',
      platform: 'OWASP',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/OS_Hardening_Cheat_Sheet.html',
      resource_type: 'PRACTICE',
      description: 'OWASP guidelines and checklist for operating system hardening, service lockdown, and privilege escalation defense.',
      topic: cleanTopic,
      subtopic: taskContext.subtopic || 'Security Hardening Checklist',
      domain: domainKey,
      difficulty: cleanLevel,
      estimated_minutes: Math.round(duration * 0.7),
      recommended_section: 'OS Hardening Verification Checklist & Defensive Rules',
      relevance_reason: 'Industry-standard checklist for operating system security hardening.',
      is_official: true,
      quality_score: 92
    };
  }

  // GENERAL DOMAIN FALLBACK (if specific deep link was not matched above)
  if (!primaryRes) {
    let platformName = 'Official Documentation';
    let urlTarget = 'https://docs.python.org/3/tutorial/';
    let practiceUrlTarget = 'https://www.w3schools.com/python/';

    if (domainKey === 'fullstack') {
      platformName = 'MDN Web Docs';
      urlTarget = 'https://developer.mozilla.org/en-US/docs/Learn';
      practiceUrlTarget = 'https://react.dev/learn';
    } else if (domainKey === 'dsa') {
      platformName = 'GeeksforGeeks DSA';
      urlTarget = 'https://www.geeksforgeeks.org/data-structures/';
      practiceUrlTarget = 'https://leetcode.com/explore/';
    } else if (domainKey === 'devops') {
      platformName = 'Docker & Cloud Docs';
      urlTarget = 'https://docs.docker.com/get-started/';
      practiceUrlTarget = 'https://kubernetes.io/docs/tutorials/';
    } else if (domainKey === 'mobile') {
      platformName = 'Flutter Official Docs';
      urlTarget = 'https://docs.flutter.dev/ui/layout';
      practiceUrlTarget = 'https://developer.android.com/guide';
    } else if (domainKey === 'ai_llm') {
      platformName = 'Hugging Face & PyTorch AI Docs';
      urlTarget = 'https://huggingface.co/docs/transformers/index';
      practiceUrlTarget = 'https://pytorch.org/tutorials/';
    } else if (domainKey === 'system_design') {
      platformName = 'System Design Primer';
      urlTarget = 'https://github.com/donnemartin/system-design-primer';
      practiceUrlTarget = 'https://martinfowler.com/architecture/';
    }

    primaryRes = {
      resource_id: `dyn_${taskContext.taskId || Date.now()}_primary`,
      category_label: 'PRIMARY',
      title: `${cleanTopic}: ${taskTitle} Guide`,
      platform: platformName,
      url: urlTarget,
      resource_type: taskType === 'PRACTICE' ? 'PRACTICE' : 'TUTORIAL',
      description: `Structured, verified ${cleanLevel.toLowerCase()} learning guide explaining ${cleanTopic} and practical usage.`,
      topic: cleanTopic,
      subtopic: taskContext.subtopic || cleanTopic,
      domain: domainKey,
      difficulty: cleanLevel,
      estimated_minutes: duration,
      recommended_section: `Section: ${cleanTopic} Core Principles`,
      relevance_reason: `Directly matched to today's ${domainKey.toUpperCase()} ${cleanLevel} task "${taskTitle}".`,
      is_official: true,
      quality_score: 90
    };

    practiceRes = {
      resource_id: `dyn_${taskContext.taskId || Date.now()}_practice`,
      category_label: 'PRACTICE',
      title: `${cleanTopic} Interactive Practice Drills`,
      platform: `${platformName} Practice`,
      url: practiceUrlTarget,
      resource_type: 'PRACTICE',
      description: `Interactive problem set and self-check validation drills for ${cleanTopic}.`,
      topic: cleanTopic,
      subtopic: taskContext.subtopic || cleanTopic,
      domain: domainKey,
      difficulty: cleanLevel,
      estimated_minutes: Math.round(duration * 0.7),
      recommended_section: `Self-Check Drills: ${cleanTopic}`,
      relevance_reason: `Provides hands-on practice for ${cleanTopic} within the ${domainKey} track.`,
      is_official: false,
      quality_score: 85
    };
  }

  return [primaryRes, practiceRes];
}

// Stage 1 & Stage 2 Resource Recommendation Engine
async function recommendResourcesForTask(taskData) {
  const {
    taskId,
    taskTitle,
    taskType,
    taskDifficulty,
    taskDuration,
    dailyTopic,
    subtopic,
    domain,
    userLevel,
    user_id
  } = taskData;

  const domainKey = canonicalizeDomainKey(domain);

  console.log("RESOURCE REQUEST:", {
    userId: user_id || 'anonymous',
    domain: domainKey,
    taskId: taskId || 'unknown',
    topic: dailyTopic || taskTitle,
    subtopic: subtopic || '',
    taskType: taskType || 'LEARN',
    difficulty: taskDifficulty || userLevel || 'BEGINNER'
  });

  // Stage 1: Search Trusted Catalog with HARD Domain Filter & Relevance Validation
  let candidateMatches = TRUSTED_RESOURCES.filter(r => {
    if (!validateResourceURL(r.url)) return false;
    return isResourceRelevantToContext(r, taskData);
  });

  // Score candidate matches
  const scoredList = candidateMatches.map(r => ({
    ...r,
    calculatedScore: calculateResourceMatchScore(r, taskData)
  }));

  scoredList.sort((a, b) => b.calculatedScore - a.calculatedScore);

  let selectedResources = scoredList.filter(r => r.calculatedScore >= 50).slice(0, 3);

  // Stage 2: Dynamic Domain-Specific & Task-Specific Fallback if catalog matches are insufficient
  if (selectedResources.length === 0) {
    selectedResources = generateDynamicDomainTaskResources(taskData);
  }

  // Format category labels
  const formattedResources = selectedResources.map((res, idx) => ({
    resource_id: res.resource_id || `res_${Date.now()}_${idx}`,
    category_label: idx === 0 ? 'PRIMARY' : (idx === 1 ? 'ALTERNATIVE' : 'PRACTICE'),
    title: res.title,
    platform: res.platform,
    url: res.url,
    resource_type: res.resource_type || (idx === 0 ? 'TUTORIAL' : 'PRACTICE'),
    description: res.description,
    topic: res.topic || dailyTopic || taskTitle,
    subtopic: res.subtopic || subtopic || dailyTopic || taskTitle,
    domain: domainKey,
    difficulty: res.difficulty || taskDifficulty || userLevel || 'BEGINNER',
    estimated_minutes: res.estimated_minutes || taskDuration || 30,
    recommended_section: res.recommended_section || `Recommended Section: ${res.title}`,
    relevance_reason: res.relevance_reason || `Targeted resource for ${domainKey.toUpperCase()} task "${taskTitle}".`,
    is_official: res.is_official || false,
    quality_score: res.quality_score || 85,
    verified_at: res.verified_at || new Date(),
    is_valid: true
  }));

  console.log("RESOURCE RESPONSE:", {
    taskId: taskId || 'unknown',
    resourcesCount: formattedResources.length,
    resources: formattedResources.map(r => ({ id: r.resource_id, title: r.title, url: r.url }))
  });

  // Save resources in MongoDB Atlas `Resource` collection
  if (mongoose.connection.readyState === 1) {
    for (const resObj of formattedResources) {
      try {
        await Resource.findOneAndUpdate(
          { resource_id: resObj.resource_id },
          { ...resObj, verified_at: new Date() },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.warn('MongoDB Resource cache warning:', err.message);
      }
    }
  }

  return formattedResources;
}

// ============================================================
// DOMAIN CURRICULA DATA FOR ALL 8 TECH DOMAINS
// ============================================================

const DOMAIN_CURRICULA = {
  fullstack: {
    domainId: 'fullstack',
    domainName: 'Full-Stack Web Development',
    topics: [
      { id: 'fs_web_fund', name: 'Web & HTML/CSS Fundamentals', levelCategory: 'FOUNDATION', subtopics: ['HTML5 Semantic Elements', 'CSS3 Layouts & Flexbox', 'CSS Grid & Responsive Design', 'DOM Structure & Selection', 'Web Accessibility (a11y)'], prerequisites: [], difficulty: 'BEGINNER' },
      { id: 'fs_js', name: 'JavaScript Fundamentals', levelCategory: 'FOUNDATION', subtopics: ['Variables, Types & Operators', 'Control Flow & Functions', 'Arrays & Objects', 'Scope, Hoisting & Closures', 'ES6+ Features'], prerequisites: ['fs_web_fund'], difficulty: 'BEGINNER' },
      { id: 'fs_async', name: 'Modern JS & Async Programming', levelCategory: 'CORE_FOUNDATION', subtopics: ['DOM Manipulation & Events', 'Promises & Async/Await', 'Fetch API & AJAX', 'Event Loop & Microtasks', 'Prototype Chain'], prerequisites: ['fs_js'], difficulty: 'BEGINNER' },
      { id: 'fs_react', name: 'React & UI Architecture', levelCategory: 'CORE', subtopics: ['JSX & Component Hierarchy', 'State & Props Management', 'React Hooks Rules (useState, useEffect)', 'Virtual DOM & Reconciliation', 'Form Handling & Styling'], prerequisites: ['fs_async'], difficulty: 'INTERMEDIATE' },
      { id: 'fs_api', name: 'REST API & Backend Architecture', levelCategory: 'INTERMEDIATE', subtopics: ['Node.js Event-Driven Architecture', 'Express Middleware Pipelines', 'HTTP Methods, Headers & Status Codes', 'RESTful Resource Design', 'Authentication & JWT'], prerequisites: ['fs_async'], difficulty: 'INTERMEDIATE' },
      { id: 'fs_db', name: 'Database Engineering (SQL & MongoDB)', levelCategory: 'INTERMEDIATE', subtopics: ['Relational Schema Design & 3NF', 'SQL Queries, Joins & Indexes', 'MongoDB Document Schemas', 'ACID Transactions vs Eventual Consistency', 'ORM/ODM Integration'], prerequisites: ['fs_api'], difficulty: 'INTERMEDIATE' },
      { id: 'fs_sec', name: 'Web Security & Performance', levelCategory: 'ADVANCED', subtopics: ['XSS & Output Encoding', 'SQL Injection Mitigation', 'CSRF Defenses & SameSite Cookies', 'Password Hashing (Argon2/bcrypt)', 'CORS Preflight & Headers'], prerequisites: ['fs_db'], difficulty: 'ADVANCED' },
      { id: 'fs_sys', name: 'System Architecture & Deployment', levelCategory: 'SPECIALIZATION', subtopics: ['Stateless Application Scaling', 'Reverse Proxies (Nginx)', 'Caching Strategies (Redis)', 'Docker Containerization & CI/CD', 'Full-Stack Capstone Integration'], prerequisites: ['fs_sec'], difficulty: 'ADVANCED' }
    ]
  },
  datascience: {
    domainId: 'datascience',
    domainName: 'Data Science & Machine Learning',
    topics: [
      { id: 'ds_py_fund', name: 'Python Fundamentals', levelCategory: 'FOUNDATION', subtopics: ['Variables & Primitive Data Types', 'Control Flow (if/else, loops)', 'Functions, Scope & Recursion', 'Python Data Structures (Lists, Dicts, Sets)', 'String Manipulation & Basic Error Handling'], prerequisites: [], difficulty: 'BEGINNER' },
      { id: 'ds_py_ds', name: 'Python for Data Science & Math', levelCategory: 'CORE_FOUNDATION', subtopics: ['NumPy Arrays & Mathematical Operations', 'Pandas Series & DataFrames Basics', 'Data Indexing, Slicing & Filtering', 'Handling Missing Values & Basic Cleaning', 'Basic Summary Statistics'], prerequisites: ['ds_py_fund'], difficulty: 'BEGINNER' },
      { id: 'ds_prep', name: 'Data Preprocessing & EDA', levelCategory: 'CORE', subtopics: ['Pandas & NumPy Vectorization', 'Feature Scaling & One-Hot Encoding', 'Imbalanced Datasets (SMOTE)', 'Exploratory Data Analysis (EDA)', 'Data Visualization (Matplotlib & Seaborn)'], prerequisites: ['ds_py_ds'], difficulty: 'INTERMEDIATE' },
      { id: 'ds_stat', name: 'Statistical Inference & Probability', levelCategory: 'CORE', subtopics: ['Descriptive vs Inferential Statistics', 'Probability Distributions & Bayes Theorem', 'Hypothesis Testing & p-values', 'Correlation & Covariance', 'Confidence Intervals'], prerequisites: ['ds_py_ds'], difficulty: 'INTERMEDIATE' },
      { id: 'ds_ml', name: 'Machine Learning Fundamentals', levelCategory: 'INTERMEDIATE', subtopics: ['Supervised vs Unsupervised Concepts', 'Linear & Logistic Regression', 'Bias-Variance Tradeoff', 'Decision Trees & Ensembles', 'Model Evaluation Metrics (Precision/Recall/F1)'], prerequisites: ['ds_prep', 'ds_stat'], difficulty: 'INTERMEDIATE' },
      { id: 'ds_adv_ml', name: 'Advanced Machine Learning & Ensembles', levelCategory: 'ADVANCED', subtopics: ['Gradient Boosting (XGBoost / LightGBM)', 'L1/L2 Regularization (Lasso/Ridge)', 'Feature Engineering & Selection', 'Hyperparameter Tuning (Grid/Random Search)', 'Cross-Validation Strategies'], prerequisites: ['ds_ml'], difficulty: 'ADVANCED' },
      { id: 'ds_unsup', name: 'Unsupervised Learning & PCA', levelCategory: 'ADVANCED', subtopics: ['K-Means & Hierarchical Clustering', 'PCA Eigendecomposition', 'Dimensionality Reduction', 'Anomaly Detection', 'Silhouette Analysis'], prerequisites: ['ds_adv_ml'], difficulty: 'ADVANCED' },
      { id: 'ds_dl', name: 'Deep Learning & Neural Networks', levelCategory: 'ADVANCED', subtopics: ['Activation Functions (ReLU/Sigmoid)', 'Backpropagation Math', 'CNN Architectures for Computer Vision', 'Dropout & Batch Normalization', 'Loss Functions & Optimization'], prerequisites: ['ds_adv_ml'], difficulty: 'ADVANCED' },
      { id: 'ds_nlp', name: 'Advanced Deep Learning & NLP', levelCategory: 'SPECIALIZATION', subtopics: ['Word Embeddings (Word2Vec / FastText)', 'Recurrent Networks & LSTMs', 'Self-Attention Mechanism', 'Transformers (BERT vs GPT)', 'LLM Fine-tuning & Prompt Tuning'], prerequisites: ['ds_dl'], difficulty: 'ADVANCED' },
      { id: 'ds_ops', name: 'MLOps, Model Deployment & Projects', levelCategory: 'SPECIALIZATION', subtopics: ['Model Serialization (ONNX / Pickle)', 'FastAPI/Flask API Serving', 'Concept Drift Monitoring', 'Feature Stores', 'End-to-End Capstone Project'], prerequisites: ['ds_nlp'], difficulty: 'ADVANCED' }
    ]
  },
  dsa: {
    domainId: 'dsa',
    domainName: 'Data Structures & Algorithms (Interview Prep)',
    topics: [
      { id: 'dsa_fund', name: 'Programming Logic & Complexity Analysis', levelCategory: 'FOUNDATION', subtopics: ['Variables & Primitive Operations', 'Loops & Conditional Logic', 'Big-O Time & Space Complexity Analysis', 'Basic Array & String Operations', 'Recursion Fundamentals'], prerequisites: [], difficulty: 'BEGINNER' },
      { id: 'dsa_arr', name: 'Arrays, Hash Maps & Two Pointers', levelCategory: 'CORE_FOUNDATION', subtopics: ['Array Traversal & In-Place Mutation', 'Hash Map Collision & O(1) Lookups', 'Two Sum & Pair Search', 'Two Pointers Technique', 'Prefix Sum Array'], prerequisites: ['dsa_fund'], difficulty: 'BEGINNER' },
      { id: 'dsa_win', name: 'Sliding Window & Fast/Slow Pointers', levelCategory: 'CORE', subtopics: ['Fixed Size Sliding Window', 'Dynamic Window Shrink', 'Fast & Slow Pointer Cycle Detection', 'Kadane Algorithm for Max Subarray', 'Frequency Maps'], prerequisites: ['dsa_arr'], difficulty: 'BEGINNER' },
      { id: 'dsa_stack', name: 'Stacks & Queues', levelCategory: 'INTERMEDIATE', subtopics: ['LIFO & FIFO Mechanics', 'Valid Parentheses Matching', 'Monotonic Stack Pattern', 'Queue via Two Stacks', 'Postfix Expression Evaluation'], prerequisites: ['dsa_arr'], difficulty: 'INTERMEDIATE' },
      { id: 'dsa_tree', name: 'Trees & Search Algorithms', levelCategory: 'INTERMEDIATE', subtopics: ['Binary Search Tree Operations', 'In-Order / Pre-Order / Post-Order Traversal', 'Heap / Priority Queue Basics', 'Lowest Common Ancestor (LCA)', 'Trie Data Structure'], prerequisites: ['dsa_stack'], difficulty: 'INTERMEDIATE' },
      { id: 'dsa_graph', name: 'Graph Algorithms & Shortest Path', levelCategory: 'ADVANCED', subtopics: ['BFS & DFS Graph Traversals', 'Topological Sort (Kahn Algorithm)', 'Dijkstra Shortest Path Algorithm', 'Cycle Detection in DAGs', 'Union-Find / Disjoint Set'], prerequisites: ['dsa_tree'], difficulty: 'ADVANCED' },
      { id: 'dsa_dp', name: 'Dynamic Programming', levelCategory: 'ADVANCED', subtopics: ['Memoization vs Tabulation', '0/1 Knapsack Pattern', 'Longest Common Subsequence', 'Grid Path DP Problems', 'State Compression DP'], prerequisites: ['dsa_tree'], difficulty: 'ADVANCED' },
      { id: 'dsa_adv', name: 'Advanced Coding Patterns & Mock Interviews', levelCategory: 'SPECIALIZATION', subtopics: ['Advanced DP Patterns', 'Segment Trees & Fenwick Trees', 'Systemic Coding Interview Strategies', 'Timed Coding Assessment Simulation', 'Comprehensive Problem Solving Capstone'], prerequisites: ['dsa_graph', 'dsa_dp'], difficulty: 'ADVANCED' }
    ]
  },
  devops: {
    domainId: 'devops',
    domainName: 'Cloud Engineering & DevOps',
    topics: [
      { id: 'dev_fund', name: 'Computer Networking & OS Basics', levelCategory: 'FOUNDATION', subtopics: ['OS Architecture Basics', 'Linux File System Navigation', 'File Permissions & User Mgmt', 'TCP/IP, Ports & Protocols', 'DNS, HTTP & SSH Connections'], prerequisites: [], difficulty: 'BEGINNER' },
      { id: 'dev_linux', name: 'Linux Administration & Shell', levelCategory: 'CORE_FOUNDATION', subtopics: ['Linux Process Management (ps, top)', 'Systemd Service Unit Configuration', 'Bash Scripting & Automation', 'Networking Utilities (ss/dig/curl)', 'SSH Hardening'], prerequisites: ['dev_fund'], difficulty: 'BEGINNER' },
      { id: 'dev_docker', name: 'Containerization & Docker', levelCategory: 'CORE', subtopics: ['Container Concepts vs VMs', 'Dockerfile Optimization', 'Multi-stage Builds', 'Docker Container Networking', 'Docker Compose Orchestration'], prerequisites: ['dev_linux'], difficulty: 'INTERMEDIATE' },
      { id: 'dev_cicd', name: 'CI/CD Automation', levelCategory: 'INTERMEDIATE', subtopics: ['Version Control (Git Workflow)', 'GitHub Actions Workflows', 'Automated Testing Pipelines', 'Container Registry Push', 'Blue-Green Deployments'], prerequisites: ['dev_docker'], difficulty: 'INTERMEDIATE' },
      { id: 'dev_k8s', name: 'Kubernetes Infrastructure', levelCategory: 'ADVANCED', subtopics: ['Pods, Deployments & ReplicaSets', 'Services & Ingress Controllers', 'Persistent Volumes & Claims', 'Helm Chart Package Mgmt', 'Cluster Autoscaling'], prerequisites: ['dev_cicd'], difficulty: 'INTERMEDIATE' },
      { id: 'dev_iac', name: 'Infrastructure as Code', levelCategory: 'ADVANCED', subtopics: ['Terraform Syntax & HCL', 'State File Management', 'Terraform Modules', 'Ansible Configuration Mgmt', 'Cloud Resource Provisioning'], prerequisites: ['dev_k8s'], difficulty: 'ADVANCED' },
      { id: 'dev_obs', name: 'Cloud Architecture & Observability Capstone', levelCategory: 'SPECIALIZATION', subtopics: ['Prometheus Metrics Collection', 'Grafana Dashboarding', 'Distributed Tracing (Jaeger)', 'IAM & Cloud Security', 'Disaster Recovery'], prerequisites: ['dev_iac'], difficulty: 'ADVANCED' }
    ]
  },
  cybersecurity: {
    domainId: 'cybersecurity',
    domainName: 'Cybersecurity & Ethical Hacking',
    topics: [
      { id: 'sec_fund', name: 'Computer Systems & CLI Fundamentals', levelCategory: 'FOUNDATION', subtopics: ['OS Principles (Linux/Windows)', 'Command Line Utilities', 'Network Architecture Basics', 'Data Encoding (Base64/Hex)', 'File Permissions & Privileges'], prerequisites: [], difficulty: 'BEGINNER' },
      { id: 'sec_net', name: 'Networking Protocols & Traffic Analysis', levelCategory: 'CORE_FOUNDATION', subtopics: ['TCP/IP Handshake & Packets', 'Wireshark Packet Capture', 'Subnetting & Routing', 'DNS & HTTP Vulnerabilities', 'Arp Spoofing Detection'], prerequisites: ['sec_fund'], difficulty: 'BEGINNER' },
      { id: 'sec_def', name: 'Network Defense & Firewalls', levelCategory: 'CORE', subtopics: ['Stateful vs Stateless Firewalls', 'IDS/IPS Rules & Signatures', 'VPN Tunneling Protocols', 'Nmap Network Scanning', 'Zero Trust Architecture'], prerequisites: ['sec_net'], difficulty: 'INTERMEDIATE' },
      { id: 'sec_web', name: 'Web Application Vulnerabilities', levelCategory: 'INTERMEDIATE', subtopics: ['OWASP Top 10 Deep Dive', 'Cross-Site Scripting (XSS)', 'SQL Injection Exploitation', 'CSRF & Session Hijacking', 'IDOR & Auth Bypasses'], prerequisites: ['sec_def'], difficulty: 'INTERMEDIATE' },
      { id: 'sec_crypto', name: 'Cryptography & PKI', levelCategory: 'INTERMEDIATE', subtopics: ['Symmetric vs Asymmetric Ciphers', 'Cryptographic Hash Functions', 'Public Key Infrastructure (PKI)', 'TLS Handshake Inspection', 'Digital Signatures'], prerequisites: ['sec_web'], difficulty: 'INTERMEDIATE' },
      { id: 'sec_sys', name: 'System Hardening & Privilege Escalation', levelCategory: 'ADVANCED', subtopics: ['Linux/Windows Security Hardening', 'Active Directory Security', 'Role-Based Access Control (RBAC)', 'Kernel Exploitation Protections', 'Privilege Escalation Defenses'], prerequisites: ['sec_crypto'], difficulty: 'ADVANCED' },
      { id: 'sec_ir', name: 'Incident Response & Forensics Capstone', levelCategory: 'SPECIALIZATION', subtopics: ['SIEM Log Analysis & Splunk', 'Memory & Disk Forensics', 'Threat Hunting Techniques', 'Malware Static Analysis', 'Incident Remediation Playbooks'], prerequisites: ['sec_sys'], difficulty: 'ADVANCED' }
    ]
  },
  mobile: {
    domainId: 'mobile',
    domainName: 'Mobile App Development (React Native & Flutter)',
    topics: [
      { id: 'mob_fund', name: 'Programming Basics for Mobile', levelCategory: 'FOUNDATION', subtopics: ['JavaScript / Dart Language Basics', 'Variables, Functions & Scope', 'Control Flow & Data Structures', 'Mobile App Architecture Basics', 'Asynchronous Programming'], prerequisites: [], difficulty: 'BEGINNER' },
      { id: 'mob_ui', name: 'Mobile UI Layouts & Components', levelCategory: 'CORE_FOUNDATION', subtopics: ['Flexbox Layout Engine', 'React Native / Flutter Components', 'Custom Reusable UI Elements', 'Screen Responsiveness', 'Touch & Gesture Handling'], prerequisites: ['mob_fund'], difficulty: 'BEGINNER' },
      { id: 'mob_state', name: 'State Management & Navigation', levelCategory: 'CORE', subtopics: ['Redux / Context / Provider', 'Stack & Tab Navigation', 'Deep Linking Setup', 'Async State Management', 'Form Validation'], prerequisites: ['mob_ui'], difficulty: 'INTERMEDIATE' },
      { id: 'mob_native', name: 'Native Hardware Integration', levelCategory: 'INTERMEDIATE', subtopics: ['Camera & File Access APIs', 'Geolocation & Mapping', 'Push Notifications (FCM)', 'Device Hardware Sensors', 'Native Modules Bridge'], prerequisites: ['mob_state'], difficulty: 'INTERMEDIATE' },
      { id: 'mob_perf', name: 'Mobile Performance & Local Storage', levelCategory: 'ADVANCED', subtopics: ['AsyncStorage & SQLite DB', 'Image Caching & Lazy Loading', 'Memory Leak Profiling', 'FPS Optimization', 'Offline-First Synchronization'], prerequisites: ['mob_native'], difficulty: 'INTERMEDIATE' },
      { id: 'mob_sec', name: 'App Security & Authentication', levelCategory: 'ADVANCED', subtopics: ['OAuth 2.0 / OpenID Connect', 'Secure Keychain / Keystore', 'Biometric Auth (Touch/Face ID)', 'SSL Pinning', 'App Obfuscation'], prerequisites: ['mob_perf'], difficulty: 'ADVANCED' },
      { id: 'mob_cicd', name: 'App Store Publishing & CI/CD Capstone', levelCategory: 'SPECIALIZATION', subtopics: ['Fastlane Automation', 'iOS Code Signing & Provisioning', 'Android APK/AAB Bundle Signing', 'App Store Connect Submission', 'Google Play Release Management'], prerequisites: ['mob_sec'], difficulty: 'ADVANCED' }
    ]
  },
  ai_llm: {
    domainId: 'ai_llm',
    domainName: 'AI & LLM Systems Engineering',
    topics: [
      { id: 'ai_fund', name: 'Python Programming & Math Foundations', levelCategory: 'FOUNDATION', subtopics: ['Python Syntax & Control Flow', 'Data Structures (Lists, Dicts, Sets)', 'Functions & Modules', 'Basic Linear Algebra & Vectors', 'REST API Requests Basics'], prerequisites: [], difficulty: 'BEGINNER' },
      { id: 'ai_prompt', name: 'Prompt Engineering & Context', levelCategory: 'CORE_FOUNDATION', subtopics: ['Zero-shot & Few-shot Prompting', 'System Prompt Design', 'Context Window Allocation', 'Structured Output JSON Generation', 'Prompt Chaining'], prerequisites: ['ai_fund'], difficulty: 'BEGINNER' },
      { id: 'ai_vec', name: 'Embeddings & Vector Databases', levelCategory: 'CORE', subtopics: ['Text Vector Embeddings', 'Cosine & Dot Product Similarity', 'Pinecone / ChromaDB / FAISS', 'HNSW Indexing Algorithms', 'Vector Search Performance'], prerequisites: ['ai_prompt'], difficulty: 'INTERMEDIATE' },
      { id: 'ai_rag', name: 'RAG Architectures & Retrieval', levelCategory: 'INTERMEDIATE', subtopics: ['Document Chunking Strategies', 'Hybrid Keyword & Vector Search', 'Re-ranking Models (Cohere)', 'Query Rewriting & Expansion', 'RAG Context Injection'], prerequisites: ['ai_vec'], difficulty: 'INTERMEDIATE' },
      { id: 'ai_ft', name: 'LLM Fine-Tuning & Quantization', levelCategory: 'ADVANCED', subtopics: ['LoRA & QLoRA Parameter Efficient Tuning', 'Instruction Dataset Curation', 'Model Quantization (GGUF / AWQ)', 'Local Serving with Ollama', 'Model Fine-tuning Pipeline'], prerequisites: ['ai_rag'], difficulty: 'ADVANCED' },
      { id: 'ai_agent', name: 'Agent Frameworks & Tool Calling', levelCategory: 'ADVANCED', subtopics: ['ReAct Agent Loop Architecture', 'Function Calling & Schema Binding', 'Multi-Agent Collaboration', 'Memory & State Persistence', 'Autonomous Workflow Control'], prerequisites: ['ai_ft'], difficulty: 'ADVANCED' },
      { id: 'ai_eval', name: 'Evaluation, Safety & Guardrails Capstone', levelCategory: 'SPECIALIZATION', subtopics: ['Hallucination Detection Metrics', 'NeMo & Llama Guardrails', 'LLM Benchmark Evaluation', 'Prompt Injection Prevention', 'Cost & Latency Optimization'], prerequisites: ['ai_agent'], difficulty: 'ADVANCED' }
    ]
  },
  system_design: {
    domainId: 'system_design',
    domainName: 'System Design & Distributed Architecture',
    topics: [
      { id: 'sd_fund', name: 'Server Basics & Networking Fundamentals', levelCategory: 'FOUNDATION', subtopics: ['Client-Server Architecture Basics', 'HTTP/HTTPS Requests & Headers', 'Web Server Principles', 'Relational vs Non-Relational DB Basics', 'Basic API Concepts'], prerequisites: [], difficulty: 'BEGINNER' },
      { id: 'sd_scale', name: 'Scalability & Load Balancing', levelCategory: 'CORE_FOUNDATION', subtopics: ['Horizontal vs Vertical Scaling', 'Load Balancer Algorithms (Layer 4 vs 7)', 'Consistent Hashing', 'Stateless Application Design', 'Rate Limiting Algorithms'], prerequisites: ['sd_fund'], difficulty: 'BEGINNER' },
      { id: 'sd_cache', name: 'Caching & Content Delivery', levelCategory: 'CORE', subtopics: ['Cache-Aside & Write-Through Patterns', 'Redis Cluster & Eviction Policies', 'CDN Static Asset Caching', 'Cache Stampede Prevention', 'Invalidation Strategies'], prerequisites: ['sd_scale'], difficulty: 'INTERMEDIATE' },
      { id: 'sd_db', name: 'Database Sharding & Replication', levelCategory: 'INTERMEDIATE', subtopics: ['Master-Slave Read Replicas', 'Horizontal Sharding Keys', 'CAP Theorem Tradeoffs', 'NoSQL vs SQL Selection', 'Index Tuning'], prerequisites: ['sd_cache'], difficulty: 'INTERMEDIATE' },
      { id: 'sd_queue', name: 'Asynchronous Queues & Streaming', levelCategory: 'INTERMEDIATE', subtopics: ['Message Queues (RabbitMQ)', 'Event Streaming (Kafka Partitioning)', 'Dead Letter Queues', 'Idempotent Consumer Processing', 'Pub/Sub Messaging'], prerequisites: ['sd_db'], difficulty: 'INTERMEDIATE' },
      { id: 'sd_dist', name: 'Distributed Systems & Consistency', levelCategory: 'ADVANCED', subtopics: ['Consensus Algorithms (Raft)', 'Saga Pattern for Transactions', 'Distributed Locking (Redlock)', 'Two-Phase Commit (2PC)', 'Eventual Consistency'], prerequisites: ['sd_queue'], difficulty: 'ADVANCED' },
      { id: 'sd_micro', name: 'Microservices Architecture Capstone', levelCategory: 'SPECIALIZATION', subtopics: ['Service Mesh (Istio)', 'Circuit Breaker Pattern (Resilience4j)', 'gRPC vs REST APIs', 'Centralized Logging & Tracing', 'API Gateway Routing'], prerequisites: ['sd_dist'], difficulty: 'ADVANCED' }
    ]
  }
};

// Helper: Normalize domain string to canonical domain key
function canonicalizeDomainKey(rawDomain) {
  if (!rawDomain || typeof rawDomain !== 'string') return 'fullstack';
  const clean = rawDomain.trim().toLowerCase();
  if (clean.includes('datascience') || clean.includes('data science') || clean.includes('machine learning')) return 'datascience';
  if (clean.includes('dsa') || clean.includes('algorithm') || clean.includes('data structure') || clean.includes('interview prep')) return 'dsa';
  if (clean.includes('devops') || clean.includes('cloud')) return 'devops';
  if (clean.includes('cyber') || clean.includes('security') || clean.includes('hacking')) return 'cybersecurity';
  if (clean.includes('mobile') || clean.includes('react native') || clean.includes('flutter') || clean.includes('ios') || clean.includes('android')) return 'mobile';
  if (clean.includes('ai') || clean.includes('llm') || clean.includes('genai') || clean.includes('rag')) return 'ai_llm';
  if (clean.includes('system design') || clean.includes('system_design') || clean.includes('architecture') || clean.includes('microservice')) return 'system_design';
  return 'fullstack';
}


// ============================================================
// CURRICULUM PLACEMENT ENGINE
// Calculates domain prerequisite gaps, user level, and personalized starting point
// ============================================================

function analyzeCurriculumPlacement({ domain, quizEvaluation, timelineMonths, dailyHours }) {
  const domainKey = canonicalizeDomainKey(domain);
  const curriculum = DOMAIN_CURRICULA[domainKey] || DOMAIN_CURRICULA.fullstack;

  let overallScore = 0;
  let userLevel = 'BEGINNER';

  let isSelfAssessed = false;
  if (quizEvaluation) {
    isSelfAssessed = !!(quizEvaluation.is_self_assessed || quizEvaluation.isSelfAssessed);
    overallScore = quizEvaluation.score_pct !== undefined 
      ? quizEvaluation.score_pct 
      : (quizEvaluation.scorePct !== undefined ? quizEvaluation.scorePct : 0);

    const rawLevel = quizEvaluation.skill_level || quizEvaluation.skillLevel || quizEvaluation.skillTier;
    if (rawLevel) {
      const cleanL = rawLevel.toUpperCase();
      if (cleanL.includes('BEGINNER')) userLevel = 'BEGINNER';
      else if (cleanL.includes('INTERMEDIATE')) userLevel = 'INTERMEDIATE';
      else if (cleanL.includes('ADVANCED')) userLevel = 'ADVANCED';
      else if (cleanL.includes('MASTERED') || cleanL.includes('PRO') || cleanL.includes('EXPERT')) userLevel = 'MASTERED';
    }
  }

  // Enforce score-to-level boundaries if score is explicitly provided and NOT self-assessed
  if (!isSelfAssessed) {
    if (overallScore < 50) {
      userLevel = 'BEGINNER';
    } else if (overallScore >= 50 && overallScore < 75 && userLevel === 'BEGINNER') {
      userLevel = 'INTERMEDIATE';
    } else if (overallScore >= 90 && userLevel !== 'MASTERED') {
      userLevel = 'MASTERED';
    }
  }

  // Topic-level gap analysis
  const topicStats = {};
  const topicEvals = quizEvaluation ? (quizEvaluation.topic_evaluations || quizEvaluation.topicEvaluations || []) : [];
  topicEvals.forEach(te => {
    const topicName = te.topic;
    const acc = te.score_pct !== undefined ? te.score_pct : (te.accuracy_pct !== undefined ? te.accuracy_pct : (te.accuracy !== undefined ? te.accuracy : 0));
    topicStats[topicName] = { score: acc, status: acc < 50 ? 'WEAK' : (acc >= 75 ? 'STRONG' : 'INTERMEDIATE') };
  });

  const knowledgeGaps = quizEvaluation ? (quizEvaluation.knowledge_gaps || quizEvaluation.knowledgeGaps || []) : [];
  knowledgeGaps.forEach(gap => {
    if (gap.topic) {
      topicStats[gap.topic] = { score: gap.accuracy_pct || 30, status: 'WEAK' };
    }
  });

  const masteredTopics = quizEvaluation ? (quizEvaluation.mastered_topics || quizEvaluation.masteredTopics || []) : [];
  masteredTopics.forEach(m => {
    if (m.topic) {
      if (!topicStats[m.topic] || topicStats[m.topic].status !== 'WEAK') {
        topicStats[m.topic] = { score: m.accuracy_pct || 85, status: 'STRONG' };
      }
    }
  });

  // Prerequisite Gap Analysis
  const prerequisiteGaps = [];
  curriculum.topics.forEach(t => {
    let matched = topicStats[t.name];
    if (!matched) {
      const key = Object.keys(topicStats).find(k => k.toLowerCase().trim() === t.name.toLowerCase().trim());
      if (key) matched = topicStats[key];
    }

    if (matched) {
      if (matched.status === 'WEAK' || matched.score < 50) {
        prerequisiteGaps.push({ topicId: t.id, name: t.name, score: matched.score, level: t.levelCategory });
      }
    } else {
      if (userLevel === 'BEGINNER' && (t.levelCategory === 'FOUNDATION' || t.levelCategory === 'CORE_FOUNDATION')) {
        prerequisiteGaps.push({ topicId: t.id, name: t.name, score: overallScore, level: t.levelCategory });
      }
    }
  });

  // Calculate Starting Point Index
  let startingTopicIndex = 0;
  if (userLevel === 'BEGINNER' || overallScore < 50) {
    // 0% Beginner MUST start at Foundation (Index 0)
    startingTopicIndex = 0;
  } else if (userLevel === 'INTERMEDIATE') {
    const firstGapIdx = curriculum.topics.findIndex(t => prerequisiteGaps.some(g => g.topicId === t.id));
    if (firstGapIdx >= 0 && firstGapIdx < 3) {
      startingTopicIndex = firstGapIdx;
    } else {
      const coreIdx = curriculum.topics.findIndex(t => t.levelCategory === 'CORE' || t.levelCategory === 'CORE_FOUNDATION');
      startingTopicIndex = coreIdx >= 0 ? coreIdx : 1;
    }
  } else {
    // ADVANCED / MASTERED
    const firstGapIdx = curriculum.topics.findIndex(t => prerequisiteGaps.some(g => g.topicId === t.id));
    if (firstGapIdx >= 0 && firstGapIdx < 2) {
      startingTopicIndex = firstGapIdx;
    } else {
      const advIdx = curriculum.topics.findIndex(t => t.levelCategory === 'INTERMEDIATE' || t.levelCategory === 'ADVANCED');
      startingTopicIndex = advIdx >= 0 ? advIdx : Math.floor(curriculum.topics.length / 2);
    }
  }

  const startingPoint = curriculum.topics[startingTopicIndex];

  // Log required debugging output
  console.log("DIAGNOSTIC DATA:", {
    score_pct: overallScore,
    quiz_evaluation: quizEvaluation ? "PROVIDED" : "NONE",
    topic_evaluations_count: topicEvals.length
  });
  console.log("USER LEVEL:", userLevel);
  console.log("CURRICULUM STARTING POINT:", startingPoint ? startingPoint.name : "None");
  console.log("PREREQUISITE GAPS:", prerequisiteGaps.map(g => g.name));

  return {
    domainKey,
    curriculum,
    overallScore,
    userLevel,
    prerequisiteGaps,
    startingTopicIndex,
    startingPoint
  };
}


function generatePersonalizedRoadmapEngine({ user_id, domain, timeline_months, daily_hours, quizEvaluation }) {
  const domainKey = canonicalizeDomainKey(domain);
  const curriculum = DOMAIN_CURRICULA[domainKey] || DOMAIN_CURRICULA.fullstack;

  const timelineMonths = parseInt(timeline_months, 10) || 4;
  const dailyHours = parseFloat(daily_hours) || 2.0;
  const dailyMinutes = Math.round(dailyHours * 60);

  // 1. RUN CURRICULUM PLACEMENT ENGINE BEFORE GENERATING ROADMAP
  const placement = analyzeCurriculumPlacement({
    domain,
    quizEvaluation,
    timelineMonths,
    dailyHours
  });

  const overallScore = placement.overallScore;
  const userLevel = placement.userLevel;
  const startingPoint = placement.startingPoint;
  const prerequisiteGaps = placement.prerequisiteGaps;

  // Build Personalized Topic Sequence based on starting point & level depth
  const availableTopics = curriculum.topics;
  const totalDomainTopics = availableTopics.length;

  let topicSequence = [];

  if (userLevel === 'BEGINNER') {
    // Beginner gets full sequence starting from Foundation (Index 0)
    topicSequence = availableTopics.slice(0);
  } else if (userLevel === 'INTERMEDIATE') {
    // Intermediate starts at placement index, but includes rapid foundation review
    const startIdx = placement.startingTopicIndex;
    topicSequence = availableTopics.slice(startIdx);
    if (startIdx > 0) {
      topicSequence.unshift({
        id: `${curriculum.topics[0].id}_review`,
        name: `Foundation Review: ${curriculum.topics[0].name}`,
        levelCategory: 'FOUNDATION',
        subtopics: curriculum.topics[0].subtopics.slice(0, 3),
        difficulty: 'BEGINNER'
      });
    }
  } else {
    // ADVANCED / MASTERED
    const startIdx = placement.startingTopicIndex;
    topicSequence = availableTopics.slice(startIdx);
    if (startIdx > 0 && prerequisiteGaps.length > 0) {
      topicSequence.unshift({
        id: 'gap_validation',
        name: `Prerequisite Gap Validation: ${prerequisiteGaps[0].name}`,
        levelCategory: 'FOUNDATION',
        subtopics: ['Rapid Syntax Review', 'Key Concepts Verification'],
        difficulty: 'INTERMEDIATE'
      });
    }
  }

  if (topicSequence.length === 0) {
    topicSequence = availableTopics;
  }

  const topicPerformances = curriculum.topics.map(t => {
    const isGap = prerequisiteGaps.some(g => g.topicId === t.id);
    let status = isGap ? 'WEAK' : (overallScore >= 75 ? 'STRONG' : 'INTERMEDIATE');
    return {
      topic: t.name,
      score: isGap ? 30 : (overallScore || 50),
      status
    };
  });

  const monthlyRoadmap = [];
  const seqLength = topicSequence.length;

  for (let m = 1; m <= timelineMonths; m++) {
    let assignedTopics = [];

    if (timelineMonths >= seqLength) {
      if (m <= seqLength) {
        assignedTopics = [topicSequence[m - 1]];
      } else {
        const revIdx = (m - 1) % seqLength;
        assignedTopics = [topicSequence[revIdx]];
      }
    } else {
      const startIdx = Math.floor(((m - 1) * seqLength) / timelineMonths);
      const endIdx = Math.floor((m * seqLength) / timelineMonths);
      assignedTopics = topicSequence.slice(startIdx, Math.max(startIdx + 1, endIdx));
    }

    const assignedNames = assignedTopics.map(t => t.name);
    const assignedSubtopics = assignedTopics.flatMap(t => t.subtopics || []);

    let priority = 'HIGH';
    let difficulty = userLevel === 'BEGINNER' ? 'BEGINNER' : (userLevel === 'MASTERED' ? 'ADVANCED' : 'INTERMEDIATE');
    let monthTitle = `Month ${m}: ${assignedNames.join(' & ')}`;
    let objective = `Master concepts and practical patterns of ${assignedNames.join(', ')}.`;

    if (m === 1 && userLevel === 'BEGINNER') {
      priority = 'HIGH';
      difficulty = 'BEGINNER';
      monthTitle = `Month ${m}: Essential Foundations (${assignedNames.join(', ')})`;
      objective = `Build core programming foundations, setup development environment, and master fundamental syntax for ${assignedNames.join(', ')}.`;
    } else if (m === 1 && userLevel === 'INTERMEDIATE') {
      priority = 'HIGH';
      difficulty = 'INTERMEDIATE';
      monthTitle = `Month ${m}: Foundation Review & Core Accelerated Learning (${assignedNames.join(', ')})`;
      objective = `Perform rapid review of prerequisites and move quickly into core ${assignedNames.join(', ')} topics.`;
    } else if (userLevel === 'MASTERED' || userLevel === 'ADVANCED') {
      priority = 'MEDIUM';
      difficulty = 'ADVANCED';
      monthTitle = `Month ${m}: Advanced Implementation & System Specialization (${assignedNames.join(', ')})`;
      objective = `Fast-track past basic topics and focus on advanced production patterns, optimization, and capstone projects in ${assignedNames.join(', ')}.`;
    }

    const estHoursPerMonth = Math.round(dailyHours * 28);
    const weeks = [];

    for (let wInMonth = 1; wInMonth <= 4; wInMonth++) {
      const overallWeekNum = (m - 1) * 4 + wInMonth;

      let weekTitle = `Week ${overallWeekNum}: ${assignedNames[0] || 'Core Learning'}`;
      let weekObj = `Focus on ${assignedNames.join(', ')} subtopics.`;
      let practiceFocus = 'Guided coding exercises and syntax verification.';
      let revisionFocus = 'Concept summary review.';
      let assessmentFocus = 'Weekly knowledge check.';

      if (userLevel === 'BEGINNER' && m === 1) {
        if (wInMonth === 1) {
          weekTitle = `Week ${overallWeekNum}: ${assignedNames[0]} - Syntax, Variables & I/O`;
          weekObj = `Master basic syntax, variables, operators, and input/output mechanics of ${assignedNames[0]}.`;
          practiceFocus = 'Write basic scripts, inspect variable types, and execute basic I/O operations.';
        } else if (wInMonth === 2) {
          weekTitle = `Week ${overallWeekNum}: ${assignedNames[0]} - Control Flow, Conditionals & Loops`;
          weekObj = `Master conditional statements (if/else) and iteration loops (for/while).`;
          practiceFocus = 'Build algorithmic flowcharts, write loop drills, and solve conditional logic tasks.';
        } else if (wInMonth === 3) {
          weekTitle = `Week ${overallWeekNum}: ${assignedNames[0]} - Functions, Scope & Data Structures`;
          weekObj = `Master function definitions, scope rules, and built-in data structures (lists, tuples, dicts).`;
          practiceFocus = 'Implement custom functions, manipulate data structures, and debug function scope.';
        } else {
          weekTitle = `Week ${overallWeekNum}: ${assignedNames[0]} - Comprehensive Foundation Review & Milestone Assessment`;
          weekObj = `Consolidate programming foundations and complete the Month 1 practical assessment.`;
          practiceFocus = 'Build a mini starter application combining all foundational concepts.';
        }
      } else {
        if (wInMonth === 1) {
          weekTitle = `Week ${overallWeekNum}: Conceptual Core & Mechanics (${assignedNames[0]})`;
          weekObj = `Deep dive into conceptual foundations and core mechanics of ${assignedSubtopics.slice(0, 3).join(', ')}.`;
          practiceFocus = 'Code walkthroughs, syntax drills, and basic implementation exercises.';
        } else if (wInMonth === 2) {
          weekTitle = `Week ${overallWeekNum}: Applied Patterns & Implementation (${assignedNames[0]})`;
          weekObj = `Apply core concepts to practical scenarios and design problems involving ${assignedSubtopics.slice(2, 5).join(', ')}.`;
          practiceFocus = 'Hands-on project features and pattern implementation.';
        } else if (wInMonth === 3) {
          weekTitle = `Week ${overallWeekNum}: Advanced Problem Solving & Optimization`;
          weekObj = `Solve complex problems, optimize performance, and handle edge cases for ${assignedNames.join(', ')}.`;
          practiceFocus = 'Timed problem solving and multi-step scenario exercises.';
        } else {
          weekTitle = `Week ${overallWeekNum}: Review, Remediation & Milestone Assessment`;
          weekObj = `Consolidate weekly learning, review weak areas, and evaluate complete topic mastery.`;
          practiceFocus = 'Full mini-project integration and complex problem sets.';
        }
      }

      const days = [];
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      for (let d = 1; d <= 7; d++) {
        const dayName = dayNames[d - 1];
        let dayTopic = assignedNames[0] || curriculum.topics[0].name;
        let dayTasks = [];

        if (d === 1) {
          const t1Mins = Math.round(dailyMinutes * 0.35);
          const t2Mins = Math.round(dailyMinutes * 0.40);
          const t3Mins = dailyMinutes - t1Mins - t2Mins;
          dayTasks = [
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_1`,
              title: `Learn: ${assignedSubtopics[0] || dayTopic + ' Basics'}`,
              type: 'LEARN',
              estimated_minutes: t1Mins,
              difficulty: userLevel === 'BEGINNER' ? 'BEGINNER' : 'INTERMEDIATE',
              resources_ref: `Documentation & Guide for ${assignedSubtopics[0] || dayTopic}`,
              practice_details: `Read conceptual overview and syntax rules for ${assignedSubtopics[0] || dayTopic}.`,
              revision_details: 'Summarize 3 key takeaways.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Practice: ${assignedSubtopics[0] || dayTopic} Guided Code Drills`,
              type: 'PRACTICE',
              estimated_minutes: t2Mins,
              difficulty: userLevel === 'BEGINNER' ? 'BEGINNER' : 'INTERMEDIATE',
              resources_ref: `Code Sandbox & Guided Exercises for ${dayTopic}`,
              practice_details: 'Implement basic code samples and execute unit tests.',
              revision_details: 'Fix any syntax or execution errors.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_3`,
              title: `Revision: ${dayTopic} Concept Flashcards`,
              type: 'REVISION',
              estimated_minutes: t3Mins,
              difficulty: 'BEGINNER',
              resources_ref: `Concept Flashcard Deck for ${dayTopic}`,
              practice_details: 'Self-test core definitions and rules.',
              revision_details: 'Review incorrectly answered flashcards.'
            }
          ];
        } else if (d === 2) {
          const t1Mins = Math.round(dailyMinutes * 0.30);
          const t2Mins = Math.round(dailyMinutes * 0.50);
          const t3Mins = dailyMinutes - t1Mins - t2Mins;
          dayTasks = [
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_1`,
              title: `Learn: ${assignedSubtopics[1] || dayTopic + ' Patterns'}`,
              type: 'LEARN',
              estimated_minutes: t1Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Pattern Guide for ${assignedSubtopics[1] || dayTopic}`,
              practice_details: 'Study execution patterns and implementation structure.',
              revision_details: 'Note execution flow.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Implement: ${assignedSubtopics[1] || dayTopic} Practical Exercise`,
              type: 'IMPLEMENT',
              estimated_minutes: t2Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Hands-on Environment for ${dayTopic}`,
              practice_details: 'Build complete working code module from scratch.',
              revision_details: 'Verify code against test assertions.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_3`,
              title: `Practice: Self-Check Code Validation`,
              type: 'PRACTICE',
              estimated_minutes: t3Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Validation Test Suite`,
              practice_details: 'Run automated checks and log outputs.',
              revision_details: 'Refactor code for cleanliness.'
            }
          ];
        } else if (d === 3) {
          const t1Mins = Math.round(dailyMinutes * 0.60);
          const t2Mins = dailyMinutes - t1Mins;
          dayTasks = [
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_1`,
              title: `Problem Solving: ${dayTopic} Applied Challenges`,
              type: 'PROBLEM_SOLVING',
              estimated_minutes: t1Mins,
              difficulty: userLevel === 'BEGINNER' ? 'BEGINNER' : 'INTERMEDIATE',
              resources_ref: `Problem Set for ${dayTopic}`,
              practice_details: 'Solve practical coding problems independently.',
              revision_details: 'Analyze execution efficiency.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Revision & Error Analysis: ${dayTopic} Mistakes Review`,
              type: 'REVISION',
              estimated_minutes: t2Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Solution Walkthroughs`,
              practice_details: 'Review failed test cases and alternative optimal approaches.',
              revision_details: 'Write down key learnings.'
            }
          ];
        } else if (d === 4) {
          const t1Mins = Math.round(dailyMinutes * 0.35);
          const t2Mins = Math.round(dailyMinutes * 0.45);
          const t3Mins = dailyMinutes - t1Mins - t2Mins;
          dayTasks = [
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_1`,
              title: `Learn: ${assignedSubtopics[2] || dayTopic + ' Advanced Concepts'}`,
              type: 'LEARN',
              estimated_minutes: t1Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Deep Dive Guide for ${assignedSubtopics[2] || dayTopic}`,
              practice_details: 'Study edge cases, error handling, and optimization rules.',
              revision_details: 'Highlight key techniques.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Implement: ${dayTopic} Optimization & Refactoring`,
              type: 'IMPLEMENT',
              estimated_minutes: t2Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Refactoring Environment`,
              practice_details: 'Refactor existing implementation for cleanliness and performance.',
              revision_details: 'Benchmark execution metrics.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_3`,
              title: `Practice: Edge Case Testing`,
              type: 'PRACTICE',
              estimated_minutes: t3Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Edge Case Test Harness`,
              practice_details: 'Test boundary conditions and error handling.',
              revision_details: 'Document edge case fixes.'
            }
          ];
        } else if (d === 5) {
          const t1Mins = Math.round(dailyMinutes * 0.55);
          const t2Mins = dailyMinutes - t1Mins;
          dayTasks = [
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_1`,
              title: `Problem Solving: ${dayTopic} Mixed Exercises`,
              type: 'PROBLEM_SOLVING',
              estimated_minutes: t1Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Problem Bank for ${dayTopic}`,
              practice_details: 'Solve multi-concept problems combining previous weekly topics.',
              revision_details: 'Check topic dependencies.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Revision: Weak Topic Remediation (${dayTopic})`,
              type: 'REVISION',
              estimated_minutes: t2Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Remedial Study Notes for ${dayTopic}`,
              practice_details: 'Re-attempt incorrectly solved problems from earlier in the week.',
              revision_details: 'Verify gap closure.'
            }
          ];
        } else if (d === 6) {
          const t1Mins = Math.round(dailyMinutes * 0.40);
          const t2Mins = dailyMinutes - t1Mins;
          dayTasks = [
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_1`,
              title: `Revision: Consolidated Weekly Knowledge Map (${dayTopic})`,
              type: 'REVISION',
              estimated_minutes: t1Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Weekly Summary Mind Map`,
              practice_details: 'Review all concepts and syntax patterns from Week ' + overallWeekNum,
              revision_details: 'Consolidate personal cheat-sheet.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Project: Mini Capstone Module for ${dayTopic}`,
              type: 'PROJECT',
              estimated_minutes: t2Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Mini-Project Specification`,
              practice_details: 'Build an integrated project module validating weekly subtopics.',
              revision_details: 'Submit project code for self-evaluation.'
            }
          ];
        } else {
          const t1Mins = Math.round(dailyMinutes * 0.45);
          const t2Mins = dailyMinutes - t1Mins;
          dayTasks = [
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_1`,
              title: `Assessment: Week ${overallWeekNum} Concept Evaluation (${dayTopic})`,
              type: 'ASSESSMENT',
              estimated_minutes: t1Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Weekly Knowledge Check Quiz`,
              practice_details: 'Complete quiz covering week ' + overallWeekNum + ' subtopics.',
              revision_details: 'Review test score and detailed explanations.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Mock Test: Timed Knowledge Check`,
              type: 'MOCK_TEST',
              estimated_minutes: t2Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Timed Assessment Environment`,
              practice_details: 'Complete timed simulation test under evaluation conditions.',
              revision_details: 'Analyze score breakdown.'
            }
          ];
        }

        // PREVENT TOPIC JUMPING VALIDATION STEP
        dayTasks.forEach(t => {
          if (!t.title.includes(dayTopic) && !assignedSubtopics.some(sub => t.title.includes(sub))) {
            t.title = `${t.type}: ${dayTopic} - ${assignedSubtopics[0] || 'Core Mechanics'}`;
          }
        });

        days.push({
          day_number: d,
          day_name: dayName,
          topic: dayTopic,
          tasks: dayTasks,
          total_minutes: dailyMinutes
        });
      }

      weeks.push({
        week_number: overallWeekNum,
        month_number: m,
        title: weekTitle,
        objective: weekObj,
        topics: assignedNames,
        subtopics: assignedSubtopics,
        estimated_hours: Math.round(dailyHours * 7),
        practice: practiceFocus,
        revision: revisionFocus,
        assessment: assessmentFocus,
        expected_outcomes: [
          `Master core operations of ${assignedNames[0]}`,
          `Complete hands-on implementation tasks`,
          `Pass Week ${overallWeekNum} evaluation milestone`
        ],
        days
      });
    }

    monthlyRoadmap.push({
      month_number: m,
      title: monthTitle,
      objective,
      topics: assignedNames,
      subtopics: assignedSubtopics,
      estimated_hours: estHoursPerMonth,
      priority,
      difficulty,
      expected_outcomes: [
        `Complete all learning modules for ${assignedNames.join(', ')}`,
        `Pass monthly knowledge milestone assessment`,
        `Demonstrate proficiency across key subtopics`
      ],
      weeks
    });
  }

  // LOG REQUIRED ROADMAP STRUCTURE FOR DEBUGGING
  console.log("MONTHLY ROADMAP:", monthlyRoadmap.map(m => ({ month: m.month_number, title: m.title, topics: m.topics })));
  console.log("WEEKLY ROADMAP:", monthlyRoadmap.flatMap(m => m.weeks.map(w => ({ week: w.week_number, title: w.title, topics: w.topics }))));
  console.log("DAILY TASKS:", monthlyRoadmap[0]?.weeks[0]?.days[0]?.tasks.map(t => ({ id: t.id, title: t.title })));

  return {
    user_id,
    domain: curriculum.domainName,
    domain_id: domainKey,
    timeline_months: timelineMonths,
    daily_hours: dailyHours,
    quiz_score: overallScore,
    overall_level: userLevel,
    starting_point: startingPoint ? startingPoint.name : 'Foundations',
    curriculum_version: 'v2_placement',
    topic_performances: topicPerformances,
    monthly_roadmap: monthlyRoadmap,
    generated_at: new Date()
  };
}


// ============================================================
// 4. PASSWORD HASHING
// ============================================================

function hashPassword(password, saltHex = null) {
  return new Promise((resolve, reject) => {

    const salt = saltHex
      ? Buffer.from(saltHex, 'hex')
      : crypto.randomBytes(16);

    crypto.pbkdf2(
      password,
      salt,
      100000,
      32,
      'sha256',
      (err, derivedKey) => {

        if (err) {
          return reject(err);
        }

        resolve({
          hash: derivedKey.toString('hex'),
          salt: salt.toString('hex')
        });

      }
    );
  });
}


// ============================================================
// 5. JSON RESPONSE HELPER
// ============================================================

function sendJSON(res, statusCode, data) {

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  res.end(JSON.stringify(data));
}


// ============================================================
// 6. READ REQUEST BODY
// ============================================================

function readRequestBody(req) {

  return new Promise((resolve, reject) => {

    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {

        const parsed = JSON.parse(body || '{}');
        resolve(parsed);

      } catch (error) {
        reject(new Error('Invalid JSON request body.'));
      }
    });

    req.on('error', reject);

  });
}


// ============================================================
// 7. GENERATE USER ID
// ============================================================

function generateUserId() {

  return `usr_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;

}


// ============================================================
// 8. CREATE HTTP SERVER
// ============================================================

const server = http.createServer(async (req, res) => {

  const parsedUrl = url.parse(req.url, true);

  // ----------------------------------------------------------
  // CORS PRE-FLIGHT
  // ----------------------------------------------------------

  if (req.method === 'OPTIONS') {

    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    return res.end();
  }


  // ==========================================================
  // 9. HEALTH CHECK
  // ==========================================================

  if (
    req.method === 'GET' &&
    parsedUrl.pathname === '/api/health'
  ) {

    return sendJSON(res, 200, {

      status: 'OK',

      message:
        'Placify Authentication & Onboarding API is online',

      database:
        mongoose.connection.readyState === 1
          ? 'MongoDB Atlas (Connected)'
          : 'MongoDB Atlas (Disconnected)',

      database_name:
        mongoose.connection.name || 'Not connected',

      collection:
        'Registration'

    });

  }


  // ==========================================================
  // ==========================================================
  // 9b. AI DOMAIN ASSISTANT (GROQ SDK MULTI-TURN AI)
  // POST /api/domain-assistant
  // ==========================================================

  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/domain-assistant'
  ) {
    try {
      const body = await readRequestBody(req);
      const messages = body.messages || [];

      console.log('[Domain Assistant] Received request with', messages.length, 'messages');

      // Canonical Application Domains List
      const CANONICAL_DOMAINS_MAP = [
        { id: 'fullstack', name: 'Full-Stack Web Development', icon: 'ph-code-block', description: 'Master Modern Web Architecture: JavaScript Internals, REST & GraphQL APIs, React VDOM, SQL/NoSQL Databases, Web Security, and High-Concurrency Backend Engineering.' },
        { id: 'datascience', name: 'Data Science & Machine Learning', icon: 'ph-brain', description: 'Master Exploratory Data Analysis, Supervised & Unsupervised Learning, Feature Engineering, Neural Networks, PyTorch, and MLOps.' },
        { id: 'dsa', name: 'Data Structures & Algorithms (Interview Prep)', icon: 'ph-tree-structure', description: 'Master Problem Solving, Arrays, Linked Lists, Trees, Graphs, Dynamic Programming, and High-Performance Algorithm Optimization for FAANG/Product Company Interviews.' },
        { id: 'devops', name: 'Cloud Engineering & DevOps', icon: 'ph-cloud-tower', description: 'Master Cloud Infrastructure: AWS Services, Docker Containerization, Kubernetes Orchestration, Infrastructure as Code (Terraform), and CI/CD Pipelines.' },
        { id: 'cybersecurity', name: 'Cybersecurity & Ethical Hacking', icon: 'ph-shield-checkered', description: 'Master Information Security: Network Pentesting, OWASP Top 10 Web Vulnerabilities, Cryptography, Incident Response, and Security Compliance.' },
        { id: 'mobile', name: 'Mobile App Development (React Native & Flutter)', icon: 'ph-device-mobile', description: 'Master Cross-Platform & Native Mobile Engineering: React Native, Flutter/Dart, Mobile UI Components, Device APIs, Offline Storage, and App Store Publishing.' },
        { id: 'ai_llm', name: 'AI & LLM Systems Engineering', icon: 'ph-sparkle', description: 'Master Generative AI Architecture: Prompt Engineering, RAG Systems, Vector Databases (Pinecone/Chroma), Fine-Tuning LLMs, and AI Agent Orchestration.' },
        { id: 'system_design', name: 'System Design & Distributed Architecture', icon: 'ph-cpu', description: 'Master Scalable Systems: Microservices, Distributed Caching, Message Queues (Kafka/RabbitMQ), Database Sharding, Load Balancing, and High Availability.' }
      ];

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        console.error('[Domain Assistant] GROQ_API_KEY is missing from environment.');
        return sendJSON(res, 500, {
          error: 'GROQ_API_KEY is not configured on server.',
          reply: "I'm having trouble connecting to the AI assistant right now. You can still choose a domain manually from the options below."
        });
      }

      console.log('[Domain Assistant] Calling Groq API via Groq SDK...');
      const groqClient = new Groq({ apiKey });

      const systemMessage = {
        role: 'system',
        content: `You are the AI Domain Selection Advisor for AgPlacify.
Your sole goal is to help users select the best tech learning domain from the EXACT 8 CANONICAL APPLICATION DOMAINS listed below.

The 8 Canonical Domains are:
1. "fullstack" -> "Full-Stack Web Development" (Websites, React, Node.js, REST APIs, Databases, Web Security)
2. "datascience" -> "Data Science & Machine Learning" (Data analysis, ML models, Pandas, PyTorch, Statistics, Predictive Modeling)
3. "dsa" -> "Data Structures & Algorithms (Interview Prep)" (LeetCode, Algorithms, Data Structures, Problem Solving, Tech Interviews)
4. "devops" -> "Cloud Engineering & DevOps" (AWS, Cloud, Docker, Kubernetes, Terraform, CI/CD, Deployment Automation)
5. "cybersecurity" -> "Cybersecurity & Ethical Hacking" (Penetration testing, Ethical hacking, OWASP, Vulnerabilities, Security)
6. "mobile" -> "Mobile App Development (React Native & Flutter)" (iOS, Android, Flutter, React Native, Cross-platform Mobile Apps)
7. "ai_llm" -> "AI & LLM Systems Engineering" (Generative AI, LLMs, RAG, Prompt Engineering, LangChain, Vector Databases)
8. "system_design" -> "System Design & Distributed Architecture" (Distributed Systems, Microservices, Scalability, High Availability, Load Balancing)

CRITICAL CONVERSATIONAL INSTRUCTIONS:
1. Do NOT invent domain names outside of these 8 canonical domains.
2. Maintain a friendly, engaging, encouraging tone.
3. If the user's input is general or broad (e.g. "I like AI", "I don't know", "Hi"), generate a natural follow-up question to ask what part of AI, data, software, or systems interests them. Do NOT return a hardcoded generic welcome message. Do NOT recommend a domain yet.
4. When the user provides enough specific detail or after 2-3 turns of specific discussion, generate a contextual response, state your domain recommendation clearly in "reply", and return the structured "recommendation" object.
5. Return ONLY valid JSON matching this exact JSON schema:

{
  "reply": "Contextual assistant text response tailored specifically to the user's messages.",
  "recommendation": {
    "recommendedDomain": "Exact domain name from the 8 canonical domains list above",
    "recommendedDomainId": "exact domain id from list (fullstack, datascience, dsa, devops, cybersecurity, mobile, ai_llm, system_design)",
    "confidence": 0.95,
    "reason": "Short clear explanation of why this domain fits their goals.",
    "alternatives": [
      { "id": "alternative_domain_id", "name": "Exact alternative domain name" }
    ]
  },
  "isComplete": true or false
}

Note: If you are asking a follow-up question or if confidence is low, set "recommendation": null and "isComplete": false.`
      };

      // Format complete conversation history in chronological order
      const formattedHistory = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

      let completion;
      try {
        completion = await groqClient.chat.completions.create({
          messages: [systemMessage, ...formattedHistory],
          model: model,
          response_format: { type: 'json_object' },
          temperature: 0.6,
          max_tokens: 1024
        });
      } catch (firstErr) {
        if (firstErr.status === 429 || (firstErr.message && firstErr.message.includes('429'))) {
          console.warn('[Domain Assistant] 429 Rate Limit hit. Retrying in 600ms...');
          await new Promise(r => setTimeout(r, 600));
          completion = await groqClient.chat.completions.create({
            messages: [systemMessage, ...formattedHistory],
            model: model,
            response_format: { type: 'json_object' },
            temperature: 0.6,
            max_tokens: 1024
          });
        } else {
          throw firstErr;
        }
      }

      console.log('[Domain Assistant] Groq response received');
      const responseContent = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(responseContent);

      // Validate and enrich recommendation if present
      if (parsed.recommendation && parsed.recommendation.recommendedDomainId) {
        const validDom = CANONICAL_DOMAINS_MAP.find(d =>
          d.id === parsed.recommendation.recommendedDomainId ||
          d.name.toLowerCase() === (parsed.recommendation.recommendedDomain || '').toLowerCase()
        );
        if (validDom) {
          parsed.recommendation.recommendedDomainId = validDom.id;
          parsed.recommendation.recommendedDomain = validDom.name;
          parsed.recommendation.icon = validDom.icon;
          parsed.recommendation.description = validDom.description;
        } else {
          parsed.recommendation = null;
          parsed.isComplete = false;
        }
      }

      return sendJSON(res, 200, parsed);

    } catch (err) {
      console.error('[Domain Assistant] Groq API Error:', err.message);
      return sendJSON(res, 500, {
        error: 'Failed to generate response from Groq.',
        reply: "I'm having trouble connecting to the AI assistant right now. You can still choose a domain manually from the options below."
      });
    }
  }

  // ==========================================================
  // 9c. DYNAMIC QUIZ GENERATION (GROQ AI MULTI-TYPE)
  // Helper: Sanitize questions before sending to frontend (strip correct answers & explanations)
  function sanitizeQuestionsForClient(questions) {
    return (questions || []).map(q => {
      const clientQ = {
        id: q.id,
        type: q.type || 'single_select',
        topic: q.topic,
        subtopic: q.subtopic || 'Core Concept',
        difficulty: q.difficulty || 'BEGINNER',
        question: q.question,
        codeSnippet: q.codeSnippet || null
      };
      if (Array.isArray(q.options)) {
        clientQ.options = [...q.options];
      }
      return clientQ;
    });
  }

  // Helper: Validation Layer for Groq Output
  function validateGeneratedQuizQuestions(questions, requestedCount, requestedLevel, validTopics) {
    const errors = [];
    if (!Array.isArray(questions)) {
      return { valid: false, errors: ['Generated questions payload is not an array.'] };
    }

    if (questions.length !== requestedCount) {
      errors.push(`Expected exactly ${requestedCount} questions, but got ${questions.length}.`);
    }

    const validTypes = new Set([
      'SINGLE_SELECT', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'NUMERICAL',
      'SHORT_ANSWER', 'FILL_BLANK', 'CODE_OUTPUT', 'SCENARIO_BASED', 'MCQ', 'MSQ'
    ]);

    const seenIds = new Set();
    const seenTexts = new Set();

    questions.forEach((q, i) => {
      const qLabel = `Question #${i + 1}`;
      if (!q || typeof q !== 'object') {
        errors.push(`${qLabel} is invalid or null.`);
        return;
      }

      if (!q.id || typeof q.id !== 'string') {
        errors.push(`${qLabel} missing valid unique string ID.`);
      } else if (seenIds.has(q.id)) {
        errors.push(`${qLabel} has duplicate ID "${q.id}".`);
      } else {
        seenIds.add(q.id);
      }

      const normText = (q.question || '').trim().toLowerCase();
      if (!normText) {
        errors.push(`${qLabel} has empty question text.`);
      } else if (seenTexts.has(normText)) {
        errors.push(`${qLabel} duplicate question content: "${q.question.substring(0, 40)}...".`);
      } else {
        seenTexts.add(normText);
      }

      const qType = (q.type || 'MCQ').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (!validTypes.has(qType)) {
        errors.push(`${qLabel} has unknown question type "${q.type}".`);
      }

      if (!q.explanation || typeof q.explanation !== 'string' || !q.explanation.trim()) {
        errors.push(`${qLabel} missing explanation.`);
      }

      const isOptionType = ['SINGLE_SELECT', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'CODE_OUTPUT', 'SCENARIO_BASED', 'MCQ', 'MSQ'].includes(qType);
      if (isOptionType) {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push(`${qLabel} (${qType}) must have an options array with at least 2 choices.`);
        } else {
          const optionTexts = q.options.map(opt => String(opt).trim());
          if (optionTexts.some(t => !t)) {
            errors.push(`${qLabel} contains empty option choice.`);
          }
          const uniqueOpts = new Set(optionTexts.map(t => t.toLowerCase()));
          if (uniqueOpts.size !== optionTexts.length) {
            errors.push(`${qLabel} contains duplicate option choices.`);
          }

          if (['SINGLE_SELECT', 'CODE_OUTPUT', 'SCENARIO_BASED', 'MCQ'].includes(qType)) {
            const hasIndex = typeof q.correct === 'number' && q.correct >= 0 && q.correct < q.options.length;
            const hasStringMatch = typeof q.correct_answer === 'string' && optionTexts.some(opt => opt.toLowerCase() === q.correct_answer.trim().toLowerCase());
            if (!hasIndex && !hasStringMatch) {
              errors.push(`${qLabel} (${qType}) does not have a valid correct option index or matching option text.`);
            }
          } else if (qType === 'TRUE_FALSE') {
            const hasBool = typeof q.correct === 'boolean' || typeof q.correct_answer === 'boolean';
            const hasIndex = typeof q.correct === 'number' && q.correct >= 0 && q.correct < q.options.length;
            const hasStr = typeof q.correct_answer === 'string' || typeof q.correct === 'string';
            if (!hasBool && !hasIndex && !hasStr) {
              errors.push(`${qLabel} (TRUE_FALSE) missing valid boolean or index answer.`);
            }
          } else if (['MULTIPLE_SELECT', 'MSQ'].includes(qType)) {
            const corrArr = Array.isArray(q.correct) ? q.correct : (Array.isArray(q.correct_answers) ? q.correct_answers : null);
            if (!corrArr || corrArr.length === 0) {
              errors.push(`${qLabel} (MULTIPLE_SELECT) missing valid correct answers array.`);
            }
          }
        }
      } else if (qType === 'NUMERICAL') {
        const numVal = parseFloat(q.correct_answer !== undefined ? q.correct_answer : q.correct);
        if (isNaN(numVal)) {
          errors.push(`${qLabel} (NUMERICAL) correct answer must be a valid number.`);
        }
      } else if (['SHORT_ANSWER', 'FILL_BLANK'].includes(qType)) {
        const acc = q.accepted_answers || q.correct_answer || q.correct;
        const validAcc = (Array.isArray(acc) && acc.length > 0) || (typeof acc === 'string' && acc.trim());
        if (!validAcc) {
          errors.push(`${qLabel} (${qType}) missing valid accepted answers.`);
        }
      }
    });

    return { valid: errors.length === 0, errors };
  }

  // Configurable Revision Threshold (Default: 70%)
  const DAILY_REVISION_THRESHOLD = parseInt(process.env.DAILY_REVISION_THRESHOLD, 10) || 70;

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

  function calculateSundayRevisionForWeek(weekObj, roadmapDoc) {
    if (!weekObj || !Array.isArray(weekObj.days)) {
      return {
        day: "Sunday",
        weekNumber: weekObj ? weekObj.week_number : 1,
        topics: [],
        hasQuizRevisions: false,
        message: "No quiz-based revision items for this week."
      };
    }

    const sundayDay = weekObj.days.find(d => d.dayOfWeek === 'Sunday' || (d.calendarDate && parseLocalDate(d.calendarDate).getDay() === 0));
    const targetSundayDateStr = sundayDay ? sundayDay.calendarDate : (weekObj.days[0]?.calendarDate ? getUpcomingSundayDate(weekObj.days[0].calendarDate) : null);

    const weakTopicMap = new Map();
    let quizCountInWeek = 0;

    const daysToScan = (roadmapDoc && Array.isArray(roadmapDoc.monthly_roadmap))
      ? roadmapDoc.monthly_roadmap.flatMap(m => (m.weeks || []).flatMap(w => w.days || []))
      : weekObj.days;

    daysToScan.forEach(day => {
      const dCalDate = day.calendarDate || (day.day_number ? getDayScheduledLocalDate(roadmapDoc ? roadmapDoc.journey_start_date : null, day.day_number) : null);
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
            const topicsToAdd = (Array.isArray(ass.weakTopics) && ass.weakTopics.length > 0)
              ? ass.weakTopics
              : [day.topic || 'Core Concept'];

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
      if (val.lowestScore < 40 || val.count >= 2) {
        priority = 'VERY HIGH';
      } else if (val.lowestScore < 50) {
        priority = 'HIGH';
      } else if (val.lowestScore < 60) {
        priority = 'MEDIUM';
      } else {
        priority = 'LOWER';
      }

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

  function calculateRoadmapProgress(roadmapDoc, userLocalDateInput, clientTimezoneInput) {
    const userLocalDate = userLocalDateInput || new Date().toISOString().slice(0, 10);
    const clientTimezone = clientTimezoneInput || 'Asia/Kolkata';

    if (!roadmapDoc || !Array.isArray(roadmapDoc.monthly_roadmap)) {
      return {
        overall: { percent: 0, completedDays: 0, totalDays: 0, completedTasks: 0, totalTasks: 0 },
        today: { calendarDate: userLocalDate, dayNumber: 1, status: 'LOCKED', completionMode: null, isCompleted: false, plannedMinutes: 120, completedMinutes: 0, tasksCompleted: 0, tasksTotal: 0 },
        week: { weekNumber: 1, completedDays: 0, totalDays: 0, percent: 0 },
        month: { monthName: 'Current Month', completedDays: 0, totalDays: 0, percent: 0 },
        hours: { plannedHours: "0.0", completedHours: "0.0", plannedMinutes: 0, completedMinutes: 0 },
        assessment: { quizzesTaken: 0, averageScore: 0, highestScore: 0, lowestScore: 0, weakTopicsCount: 0, topicProficiencies: [] },
        revision: { requiredTopicsCount: 0, completedTopicsCount: 0, hasPendingRevision: false },
        streak: { currentStreakDays: 0, lastCompletedDate: null },
        skillProgression: { currentSkillLevel: 'BEGINNER', targetSkillLevel: 'ADVANCED', tierPercent: 0 }
      };
    }

    let totalScheduledDays = 0;
    let completedScheduledDays = 0;

    let totalTasksCount = 0;
    let completedTasksCount = 0;

    let totalPlannedMinutes = 0;
    let totalCompletedMinutes = 0;

    let todayObj = null;
    let todayPlannedMinutes = 120;
    let todayCompletedMinutes = 0;
    let todayTasksCompleted = 0;
    let todayTasksTotal = 0;

    let currentWeekNumber = 1;
    let weekTotalDays = 0;
    let weekCompletedDays = 0;

    let currentMonthName = 'Current Month';
    let monthTotalDays = 0;
    let monthCompletedDays = 0;

    let quizzesTaken = 0;
    let totalQuizScoreSum = 0;
    let highestScore = 0;
    let lowestScore = 100;
    const topicScoresMap = new Map();

    let totalRevisionRequiredCount = 0;
    let totalRevisionCompletedCount = 0;

    const completedDatesSet = new Set();
    const completedDayNumbers = new Set();
    const startDate = roadmapDoc.journey_start_date || null;
    let overallDayIndex = 0;

    roadmapDoc.monthly_roadmap.forEach((month, mIdx) => {
      const mNum = parseInt(month.month_number, 10) || (mIdx + 1);
      (month.weeks || []).forEach((week, wIdx) => {
        const wNum = parseInt(week.week_number, 10) || (wIdx + 1);
        (week.days || []).forEach((day) => {
          overallDayIndex++;
          const dNum = parseInt(day.day_number, 10) || overallDayIndex;
          const dCalDate = day.calendarDate || (startDate ? getDayScheduledLocalDate(startDate, dNum) : null);

          const isCompleted = Boolean(
            day.completed || day.completedManually ||
            (day.assessment && (
              day.assessment.completionStatus === 'completed' ||
              day.assessment.assessmentStatus === 'completed' ||
              day.assessment.status === 'completed' ||
              day.assessment.completedManually
            ))
          );

          const dayMinutes = day.total_minutes || day.estimated_minutes || 120;
          const tasks = Array.isArray(day.daily_tasks || day.tasks) ? (day.daily_tasks || day.tasks) : [];
          const tasksCount = tasks.length || 3;
          let dayTasksCompletedCount = 0;

          if (isCompleted) {
            dayTasksCompletedCount = tasksCount;
            completedScheduledDays++;
            totalCompletedMinutes += dayMinutes;
            if (dCalDate) completedDatesSet.add(dCalDate);
            const actualDate = day.completedDateLocal || (day.assessment && day.assessment.completedDateLocal);
            if (actualDate) completedDatesSet.add(String(actualDate).split('T')[0]);
            completedDayNumbers.add(dNum);
            completedDayNumbers.add(overallDayIndex);
          }

          totalScheduledDays++;
          totalPlannedMinutes += dayMinutes;
          totalTasksCount += tasksCount;
          completedTasksCount += dayTasksCompletedCount;

          const isTodayDate = (dCalDate && dCalDate === userLocalDate);

          if (isTodayDate || (!todayObj && dNum === 1)) {
            todayObj = day;
            todayPlannedMinutes = dayMinutes;
            todayCompletedMinutes = isCompleted ? dayMinutes : 0;
            todayTasksCompleted = dayTasksCompletedCount;
            todayTasksTotal = tasksCount;
            currentWeekNumber = wNum;
            if (dCalDate) {
              const dt = parseLocalDate(dCalDate);
              currentMonthName = dt.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            }
          }

          if (wNum === currentWeekNumber) {
            weekTotalDays++;
            if (isCompleted) weekCompletedDays++;
          }

          if (dCalDate) {
            const dt = parseLocalDate(dCalDate);
            const mName = dt.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            if (mName === currentMonthName || mNum === 1) {
              monthTotalDays++;
              if (isCompleted) monthCompletedDays++;
            }
          }

          const ass = day.assessment;
          if (ass && ass.assessmentMode === 'quiz' && (ass.assessmentStatus === 'completed' || ass.status === 'completed') && typeof ass.score === 'number') {
            quizzesTaken++;
            const score = ass.score;
            totalQuizScoreSum += score;
            highestScore = Math.max(highestScore, score);
            lowestScore = Math.min(lowestScore, score);

            const tName = day.topic || 'Core Concept';
            if (!topicScoresMap.has(tName)) {
              topicScoresMap.set(tName, { topic: tName, totalQuizzes: 0, scoreSum: 0, lowestScore: 100 });
            }
            const tData = topicScoresMap.get(tName);
            tData.totalQuizzes += 1;
            tData.scoreSum += score;
            tData.lowestScore = Math.min(tData.lowestScore, score);
          }
        });

        if (week.sunday_revision && Array.isArray(week.sunday_revision.topics)) {
          const reqCount = week.sunday_revision.topics.length;
          totalRevisionRequiredCount += reqCount;
          if (week.sunday_revision.completed) {
            totalRevisionCompletedCount += reqCount;
          }
        }
      });
    });

    if (quizzesTaken === 0) lowestScore = 0;

    let streakDays = 0;
    if (completedScheduledDays > 0) {
      let contiguousCount = 0;
      let streakBreak = false;

      roadmapDoc.monthly_roadmap.forEach((month) => {
        (month.weeks || []).forEach((week) => {
          (week.days || []).forEach((day) => {
            const isCompleted = Boolean(
              day.completed || day.completedManually ||
              (day.assessment && (
                day.assessment.completionStatus === 'completed' ||
                day.assessment.assessmentStatus === 'completed' ||
                day.assessment.status === 'completed' ||
                day.assessment.completedManually
              ))
            );
            if (streakBreak) return;
            if (isCompleted) {
              contiguousCount++;
            } else {
              streakBreak = true;
            }
          });
        });
      });

      let calendarStreak = 0;
      if (completedDatesSet.size > 0) {
        let checkStr = userLocalDate;
        if (!completedDatesSet.has(checkStr)) {
          const cur = parseLocalDate(userLocalDate);
          const prev = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1);
          const py = prev.getFullYear();
          const pm = String(prev.getMonth() + 1).padStart(2, '0');
          const pd = String(prev.getDate()).padStart(2, '0');
          checkStr = `${py}-${pm}-${pd}`;
        }

        let count = 0;
        while (completedDatesSet.has(checkStr)) {
          count++;
          const dt = parseLocalDate(checkStr);
          const prev = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - 1);
          const py = prev.getFullYear();
          const pm = String(prev.getMonth() + 1).padStart(2, '0');
          const pd = String(prev.getDate()).padStart(2, '0');
          checkStr = `${py}-${pm}-${pd}`;
        }
        calendarStreak = count;
      }

      streakDays = Math.max(contiguousCount, calendarStreak, 1);
    }

    const overallPercent = totalScheduledDays > 0 ? Math.round((completedScheduledDays / totalScheduledDays) * 100) : 0;
    const weeklyPercent = weekTotalDays > 0 ? Math.round((weekCompletedDays / weekTotalDays) * 100) : 0;
    const monthlyPercent = monthTotalDays > 0 ? Math.round((monthCompletedDays / monthTotalDays) * 100) : 0;
    const avgQuizScore = quizzesTaken > 0 ? Math.round(totalQuizScoreSum / quizzesTaken) : 0;

    const topicProficiencies = [];
    topicScoresMap.forEach((v) => {
      const avg = Math.round(v.scoreSum / v.totalQuizzes);
      topicProficiencies.push({
        topic: v.topic,
        averageScore: avg,
        totalQuizzes: v.totalQuizzes,
        needsRevision: avg < 70
      });
    });

    const weakTopicsCount = topicProficiencies.filter(t => t.needsRevision).length;
    const isTodayCompleted = Boolean(
      todayObj && (
        todayObj.completed || todayObj.completedManually ||
        (todayObj.assessment && (
          todayObj.assessment.completionStatus === 'completed' ||
          todayObj.assessment.assessmentStatus === 'completed' ||
          todayObj.assessment.status === 'completed' ||
          todayObj.assessment.completedManually
        ))
      )
    );
    const curStatus = isTodayCompleted ? 'TODAY_COMPLETED' : 'TODAY_ACTIVE';

    return {
      overall: {
        percent: overallPercent,
        completedDays: completedScheduledDays,
        totalDays: totalScheduledDays,
        completedTasks: completedTasksCount,
        totalTasks: totalTasksCount
      },
      today: {
        calendarDate: userLocalDate,
        dayNumber: todayObj ? parseInt(todayObj.day_number, 10) : 1,
        status: curStatus,
        completionMode: todayObj && todayObj.assessment ? (todayObj.assessment.assessmentMode || (todayObj.completedManually ? 'manual' : 'quiz')) : null,
        isCompleted: isTodayCompleted,
        plannedMinutes: todayPlannedMinutes,
        completedMinutes: todayCompletedMinutes,
        tasksCompleted: todayTasksCompleted,
        tasksTotal: todayTasksTotal
      },
      week: {
        weekNumber: currentWeekNumber,
        completedDays: weekCompletedDays,
        totalDays: weekTotalDays,
        percent: weeklyPercent
      },
      month: {
        monthName: currentMonthName,
        completedDays: monthCompletedDays,
        totalDays: monthTotalDays,
        percent: monthlyPercent
      },
      hours: {
        plannedHours: (totalPlannedMinutes / 60).toFixed(1),
        completedHours: (totalCompletedMinutes / 60).toFixed(1),
        plannedMinutes: totalPlannedMinutes,
        completedMinutes: totalCompletedMinutes
      },
      assessment: {
        quizzesTaken,
        averageScore: avgQuizScore,
        highestScore,
        lowestScore,
        weakTopicsCount,
        topicProficiencies
      },
      revision: {
        requiredTopicsCount: totalRevisionRequiredCount,
        completedTopicsCount: totalRevisionCompletedCount,
        hasPendingRevision: (totalRevisionRequiredCount > totalRevisionCompletedCount)
      },
      streak: {
        currentStreakDays: streakDays
      },
      skillProgression: {
        currentSkillLevel: (roadmapDoc.overall_level || roadmapDoc.skillTier || 'BEGINNER').toUpperCase(),
        targetSkillLevel: (roadmapDoc.targetSkillLevel || 'ADVANCED').toUpperCase(),
        tierPercent: overallPercent
      }
    };
  }

  // Helper: Groq Dynamic Generator Engine
  async function generateGroqQuestionsAsync({
    domainName,
    domainId,
    level,
    currentSkillLevel,
    targetSkillLevel,
    dayNumber,
    topics,
    learningObjectives,
    dailyTasks = [],
    questionCount,
    quizAttemptId,
    userHistoryTexts = [],
    randomSeed
  }) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not configured.');
    }

    const groqClient = new Groq({ apiKey });

    const difficultyDistros = {
      BEGINNER: '40% conceptual understanding, 20% application, 20% code/output analysis, 10% multiple-select, 10% numerical/short-answer',
      INTERMEDIATE: '25% conceptual, 25% practical application, 25% code/output prediction, 15% multiple-select, 10% numerical',
      ADVANCED: '15% conceptual, 30% application, 30% code analysis/debugging, 15% scenario/architecture analysis, 10% numerical'
    };
    const distroText = difficultyDistros[level] || difficultyDistros.BEGINNER;

    const GROQ_MODELS = [
      'openai/gpt-oss-120b',
      'qwen/qwen3.6-27b',
      'openai/gpt-oss-20b',
      'groq/compound-mini',
      'groq/compound'
    ];

    const historyExcerpt = userHistoryTexts.length > 0 ? userHistoryTexts.slice(0, 10).join('; ') : '';
    const taskSummary = Array.isArray(dailyTasks) ? dailyTasks.map(t => typeof t === 'object' ? (t.title || t.taskTitle) : String(t)).filter(Boolean).join('; ') : '';

    const systemPrompt = `You are the Expert Technical Diagnostic Assessment Generator for AgPlacify.
Your job is to generate ORIGINAL, NPTEL-style technical diagnostic assessment questions grounded SPECIFICALLY in today's curriculum tasks and learning objectives.

AUTHORITATIVE PARAMETERS:
- DOMAIN: "${domainName}" (${domainId})
- CURRENT LEVEL: "${currentSkillLevel || level}" | TARGET LEVEL: "${targetSkillLevel || 'ADVANCED'}"
- DAY NUMBER: Day ${dayNumber || 1}
- TOPIC: "${topics[0] || 'Core Concept'}"
- SUBTOPICS: ${topics.join(', ')}
${learningObjectives ? `- LEARNING OBJECTIVES: "${learningObjectives}"` : ''}
${taskSummary ? `- TODAY'S SPECIFIC TASKS: "${taskSummary}"` : ''}
- QUESTION COUNT NEEDED: ${questionCount}
- ATTEMPT ID: "${quizAttemptId}"
- RANDOM SEED / NONCE: "${randomSeed}"
- TARGET DIFFICULTY DISTRIBUTION: ${distroText}
${historyExcerpt ? `- PREVIOUSLY USED QUESTIONS TO AVOID: ${historyExcerpt}` : ''}

NPTEL QUESTION QUALITY STANDARDS:
- Generate ORIGINAL questions inspired by NPTEL technical assessments specifically testing today's topic ("${topics[0] || 'Core Concept'}").
- DO NOT generate questions on unrelated topics outside of today's learning content.
- DO NOT generate trivial recall questions like "What is Python?".
- Supported question types:
  1. "single_select": 4 distinct choices in "options", "correct" (0-based integer index 0..3)
  2. "multiple_select": 4 distinct choices in "options", "correct" (array of 0-based integer indices)
  3. "true_false": choices ["True", "False"], "correct" 0 or 1
  4. "numerical": numeric value in "correct_answer", tolerance float (e.g. 0.01)
  5. "short_answer" or "fill_blank": array of accepted string answers in "accepted_answers"
  6. "code_output": code snippet in "codeSnippet", 4 choices, 1 correct index
  7. "scenario_based": scenario context, 4 choices, 1 correct index
- EVERY question MUST have non-empty "id", "question", "topic", "subtopic", "difficulty", "type", "explanation".

Return ONLY valid JSON matching this schema:
{
  "questions": [
    {
      "id": "q_1",
      "type": "single_select",
      "topic": "${topics[0] || 'Core Concept'}",
      "subtopic": "Core Concept",
      "difficulty": "${level}",
      "question": "Scenario / question text...",
      "codeSnippet": null,
      "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correct": 0,
      "explanation": "Detailed step-by-step reasoning..."
    }
  ]
}`;

    let rawContent = null;
    let lastErr = null;

    for (const model of GROQ_MODELS) {
      try {
        console.log(`[Groq Gen] Attempting model ${model} for attempt ${quizAttemptId}...`);
        const completion = await groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate EXACTLY ${questionCount} fresh NPTEL-style questions for ${domainName} at ${level} level. Nonce: ${quizAttemptId}_${randomSeed}` }
          ],
          model: model,
          response_format: { type: 'json_object' },
          temperature: 0.75,
          max_tokens: 4000
        });
        rawContent = completion.choices[0]?.message?.content || null;
        if (rawContent) break;
      } catch (err) {
        console.warn(`[Groq Gen] Model ${model} notice:`, err.message);
        lastErr = err;
      }
    }

    if (!rawContent) {
      throw new Error(`All Groq models failed. Last error: ${lastErr ? lastErr.message : 'Unknown'}`);
    }

    let parsed = null;
    try {
      let cleanStr = rawContent.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const firstBrace = cleanStr.indexOf('{');
      const lastBrace = cleanStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanStr = cleanStr.substring(firstBrace, lastBrace + 1);
      }
      try {
        parsed = JSON.parse(cleanStr);
      } catch (e1) {
        const sanitized = cleanStr
          .replace(/[\r\n\t]/g, ' ')
          .replace(/,\s*([\]}])/g, '$1');
        parsed = JSON.parse(sanitized);
      }
    } catch (jsonErr) {
      console.error('[Groq Parse Error] Raw content:', rawContent);
      throw new Error(`Failed to parse Groq response JSON: ${jsonErr.message}`);
    }

    let questions = parsed ? (parsed.questions || parsed.data || []) : [];
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Groq returned an empty questions array.');
    }

    let valResult = validateGeneratedQuizQuestions(questions, questionCount, level, topics);

    if (!valResult.valid) {
      console.warn(`[Groq Validation] Initial output validation failed with ${valResult.errors.length} errors. Triggering repair retry...`);
      const repairPrompt = `The previous JSON response failed validation for the following reasons:\n${valResult.errors.map(e => '- ' + e).join('\n')}\n\nPlease repair the JSON response so that it passes ALL validation checks and contains EXACTLY ${questionCount} valid questions. Output ONLY valid JSON.`;

      try {
        const repairCompletion = await groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate EXACTLY ${questionCount} fresh NPTEL-style questions for ${domainName} at ${level} level. Nonce: ${quizAttemptId}_${randomSeed}` },
            { role: 'assistant', content: rawContent },
            { role: 'user', content: repairPrompt }
          ],
          model: 'openai/gpt-oss-120b',
          response_format: { type: 'json_object' },
          temperature: 0.5,
          max_tokens: 4000
        });

        const repairRaw = repairCompletion.choices[0]?.message?.content || null;
        if (repairRaw) {
          let cleanRepair = repairRaw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          const fBrace = cleanRepair.indexOf('{');
          const lBrace = cleanRepair.lastIndexOf('}');
          if (fBrace !== -1 && lBrace !== -1 && lBrace > fBrace) {
            cleanRepair = cleanRepair.substring(fBrace, lBrace + 1);
          }
          const repairedParsed = JSON.parse(cleanRepair);
          const repairedQuestions = repairedParsed ? (repairedParsed.questions || repairedParsed.data || []) : [];
          const repairValResult = validateGeneratedQuizQuestions(repairedQuestions, questionCount, level, topics);
          if (repairValResult.valid) {
            console.log(`✅ [Groq Validation] Repair retry succeeded!`);
            questions = repairedQuestions;
            valResult = repairValResult;
          } else {
            console.warn(`[Groq Validation] Repair retry failed validation. Errors:`, repairValResult.errors);
          }
        }
      } catch (repairErr) {
        console.warn(`[Groq Validation] Repair retry error:`, repairErr.message);
      }
    }

    const finalQuestions = questions.slice(0, questionCount).map((q, idx) => {
      let qType = String(q.type || 'single_select').toLowerCase();
      let rawOpts = Array.isArray(q.options) ? q.options.map(opt => String(opt).trim()).filter(Boolean) : [];

      if (qType.includes('short') || qType.includes('fill') || qType.includes('numerical')) {
        qType = 'fill_blank';
        rawOpts = [];
      } else if (rawOpts.length === 0) {
        if (qType.includes('true') || qType.includes('false')) {
          rawOpts = ["True", "False"];
          qType = 'true_false';
        } else {
          if (Array.isArray(q.accepted_answers) && q.accepted_answers.length > 0) {
            const rightAns = String(q.accepted_answers[0]);
            rawOpts = [rightAns, "Alternative Option A", "Alternative Option B", "None of the above"];
          } else if (q.correct_answer && typeof q.correct_answer === 'string' && q.correct_answer.trim()) {
            rawOpts = [q.correct_answer.trim(), "Alternative Option A", "Alternative Option B", "Alternative Option C"];
          } else {
            rawOpts = ["Option A", "Option B", "Option C", "Option D"];
          }
          qType = 'single_select';
        }
      }

      return {
        id: q.id || `q_${idx + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: qType,
        topic: q.topic || topics[idx % topics.length],
        subtopic: q.subtopic || 'Applied Analysis',
        difficulty: level,
        question: String(q.question || '').trim(),
        codeSnippet: q.codeSnippet || null,
        options: rawOpts,
        correct: typeof q.correct === 'number' ? q.correct : 0,
        correct_answer: q.correct_answer !== undefined ? q.correct_answer : (rawOpts[0] || null),
        correct_answers: Array.isArray(q.correct_answers) ? q.correct_answers : null,
        accepted_answers: Array.isArray(q.accepted_answers) ? q.accepted_answers : (q.accepted_answers ? [String(q.accepted_answers)] : null),
        explanation: String(q.explanation || 'Step-by-step technical explanation.').trim(),
        hint: q.hint || null
      };
    });

    return finalQuestions;
  }

  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/quiz/generate'
  ) {
    try {
      const body = await readRequestBody(req);
      const { userId, questionCount: reqCount, domain: bodyDomain, level: bodyLevel, forceNew, quizAttemptId: bodyAttemptId } = body;

      const quizAttemptId = bodyAttemptId || `quiz_attempt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Retrieve User from Database to get authoritative domain and level
      let userDoc = null;
      if (userId && mongoose.connection.readyState === 1) {
        try {
          const User = mongoose.model('User');
          userDoc = await User.findOne({ user_id: userId });
        } catch (e) {
          console.warn('[Quiz Gen] User lookup notice:', e.message);
        }
      }

      // Canonical Domain & Level Resolution
      const domainId = canonicalizeDomainKey((userDoc && userDoc.chosen_domain) || bodyDomain || 'fullstack');
      const initialLevel = (bodyLevel || 'BEGINNER').toUpperCase();
      const questionCount = Math.min(50, Math.max(5, parseInt(reqCount, 10) || 10));

      const domainNameMap = {
        fullstack: 'Full-Stack Web Development',
        datascience: 'Data Science & Machine Learning',
        dsa: 'Data Structures & Algorithms (Interview Prep)',
        devops: 'Cloud Engineering & DevOps',
        cybersecurity: 'Cybersecurity & Ethical Hacking',
        mobile: 'Mobile App Development (React Native & Flutter)',
        ai_llm: 'AI & LLM Systems Engineering',
        system_design: 'System Design & Distributed Architecture'
      };
      const canonicalDomainName = domainNameMap[domainId] || domainId;
      if (!global.activeQuizStore) {
        global.activeQuizStore = new Map();
      }

      // Check if this specific attempt is already active and forceNew is false
      if (!forceNew && global.activeQuizStore.has(quizAttemptId)) {
        const existingQuiz = global.activeQuizStore.get(quizAttemptId);
        if (existingQuiz && existingQuiz.domainId === domainId && existingQuiz.questionCount === questionCount) {
          console.log(`[QUIZ GENERATION] Returning existing active quiz for quizAttemptId: ${quizAttemptId}`);
          const clientCopy = Object.assign({}, existingQuiz, {
            questions: sanitizeQuestionsForClient(existingQuiz.questions)
          });
          return sendJSON(res, 200, clientCopy);
        }
      }

      const randomSeed = crypto.randomBytes(8).toString('hex');

      console.log(`[GROQ DYNAMIC QUIZ GENERATION]`);
      console.log(`userId: ${userId}`);
      console.log(`quizAttemptId: ${quizAttemptId}`);
      console.log(`domain: ${canonicalDomainName} (${domainId})`);
      console.log(`level: ${initialLevel}`);
      console.log(`requestedQuestionCount: ${questionCount}`);
      console.log(`randomSeed: ${randomSeed}`);

      // Retrieve User Assessment History (recently answered question texts/IDs)
      const userHistoryTexts = [];
      if (userId && mongoose.connection.readyState === 1) {
        try {
          const pastAttempts = await QuizAttempt.find({ user_id: userId }).select('questions.question').lean();
          pastAttempts.forEach(att => {
            if (Array.isArray(att.questions)) {
              att.questions.forEach(q => { if (q && q.question) userHistoryTexts.push(q.question); });
            }
          });
        } catch (histErr) {
          console.warn('[Quiz Gen] History lookup notice:', histErr.message);
        }
      }

      const topics = getDomainTopics(domainId);

      // Generate dynamic questions using Groq API
      const authoritativeQuestions = await generateGroqQuestionsAsync({
        domainName: canonicalDomainName,
        domainId,
        level: initialLevel,
        topics,
        questionCount,
        quizAttemptId,
        userHistoryTexts,
        randomSeed
      });

      const quizPayload = {
        quizId: quizAttemptId,
        quizAttemptId,
        userId: userId || 'guest',
        domain: canonicalDomainName,
        domainId,
        level: initialLevel,
        questionCount: authoritativeQuestions.length,
        randomSeed,
        questions: authoritativeQuestions,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };

      // Store authoritative quiz payload in Memory & MongoDB Atlas
      global.activeQuizStore.set(quizAttemptId, quizPayload);
      if (userId) {
        global.activeQuizStore.set(`${userId}:${quizAttemptId}`, quizPayload);
      }

      if (mongoose.connection.readyState === 1) {
        try {
          await QuizAttempt.findOneAndUpdate(
            { quizAttemptId },
            {
              quizAttemptId,
              user_id: userId || 'guest',
              domain: domainId,
              level: initialLevel,
              questionCount: authoritativeQuestions.length,
              randomSeed,
              questions: authoritativeQuestions,
              status: 'ACTIVE'
            },
            { upsert: true, new: true }
          );
        } catch (dbSaveErr) {
          console.warn('[Quiz Gen] QuizAttempt persistence notice:', dbSaveErr.message);
        }
      }

      // Return client-sanitized payload (correct answers stripped)
      const clientPayload = Object.assign({}, quizPayload, {
        questions: sanitizeQuestionsForClient(authoritativeQuestions)
      });

      return sendJSON(res, 200, clientPayload);

    } catch (err) {
      console.error('[Quiz Gen] Failed to generate dynamic quiz:', err.message);
      return sendJSON(res, 502, {
        error: 'Failed to generate dynamic assessment questions using Groq API.',
        message: err.message
      });
    }
  }

  // ==========================================================
  // 9d. GET ACTIVE QUIZ
  // GET /api/quiz/active/:userId
  // ==========================================================
  if (
    req.method === 'GET' &&
    parsedUrl.pathname.startsWith('/api/quiz/active/')
  ) {
    const uId = parsedUrl.pathname.replace('/api/quiz/active/', '').trim();
    if (uId && global.activeQuizStore && global.activeQuizStore.has(uId)) {
      return sendJSON(res, 200, global.activeQuizStore.get(uId));
    }
    if (uId && mongoose.connection.readyState === 1) {
      try {
        const attempt = await QuizAttempt.findOne({ $or: [{ quizAttemptId: uId }, { user_id: uId }] }).sort({ createdAt: -1 }).lean();
        if (attempt) {
          return sendJSON(res, 200, attempt);
        }
      } catch (e) {}
    }
    return sendJSON(res, 404, { error: 'No active quiz found' });
  }

  // ==========================================================
  // 9e. LEARNING PLAN RECOMMENDATION ENGINE
  // POST /api/learning-plan/recommend
  // ==========================================================
  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/learning-plan/recommend'
  ) {
    try {
      const payload = await readRequestBody(req);
      const { domain, targetLevel, quizEvaluation, is_self_assessed, isSelfAssessed } = payload;

      const domainId = canonicalizeDomainKey(domain || 'fullstack');
      const domainNameMap = {
        fullstack: 'Full-Stack Web Development',
        datascience: 'Data Science & Machine Learning',
        dsa: 'Data Structures & Algorithms (Interview Prep)',
        devops: 'Cloud Engineering & DevOps',
        cybersecurity: 'Cybersecurity & Ethical Hacking',
        mobile: 'Mobile App Development (React Native & Flutter)',
        ai_llm: 'AI & LLM Systems Engineering',
        system_design: 'System Design & Distributed Architecture'
      };
      const domainName = domainNameMap[domainId] || domain || 'Full-Stack Web Development';
      const targetLvl = (targetLevel || (quizEvaluation && (quizEvaluation.skill_level || quizEvaluation.skillTier)) || 'BEGINNER').toUpperCase();

      const selfAssessed = !!(is_self_assessed || isSelfAssessed || (quizEvaluation && (quizEvaluation.is_self_assessed || quizEvaluation.isSelfAssessed)));

      let recommended_months = 4;
      let recommended_daily_hours = 2.0;
      let reason = '';

      if (!selfAssessed && quizEvaluation && typeof quizEvaluation.score_pct === 'number') {
        const score = quizEvaluation.score_pct;
        const gaps = quizEvaluation.knowledge_gaps || quizEvaluation.weakTopics || [];
        const mastered = quizEvaluation.mastered_topics || quizEvaluation.strongTopics || [];

        if (score < 50) {
          recommended_months = 5;
          recommended_daily_hours = 2.5;
          const gapNames = gaps.map(g => g.topic || g).filter(Boolean).slice(0, 3).join(', ');
          reason = `Based on your diagnostic assessment (${score}% score) and ${gaps.length} identified knowledge gaps${gapNames ? ` (${gapNames})` : ''}, we recommend a 5-month preparation timeline at 2.5 hours/day to solidify fundamental topics before building advanced projects.`;
        } else if (score >= 50 && score < 80) {
          recommended_months = 4;
          recommended_daily_hours = 2.0;
          reason = `Based on your diagnostic assessment (${score}% score) demonstrating moderate applied proficiency, a standard 4-month timeline at 2.0 hours/day provides the optimal pace to reinforce gaps while progressing through core milestones.`;
        } else {
          recommended_months = 3;
          recommended_daily_hours = 1.5;
          reason = `Based on your strong diagnostic score (${score}%) and ${mastered.length} mastered prerequisite topics, we recommend an accelerated 3-month timeline at 1.5 hours/day focusing directly on advanced architectural patterns & portfolio projects.`;
        }
      } else {
        // Direct Roadmap Flow Recommendation
        if (targetLvl.includes('BEGINNER')) {
          recommended_months = 4;
          recommended_daily_hours = 2.0;
          reason = `Based on the ${domainName} curriculum and your target Beginner level, we recommend a 4-month preparation plan at 2.0 hours/day to build complete foundational to core engineering mastery.`;
        } else if (targetLvl.includes('INTERMEDIATE')) {
          recommended_months = 5;
          recommended_daily_hours = 2.0;
          reason = `Based on the ${domainName} curriculum and your target Intermediate level, we recommend a 5-month plan at 2.0 hours/day to focus on applied architecture and real-world project execution.`;
        } else {
          recommended_months = 6;
          recommended_daily_hours = 2.5;
          reason = `Based on the ${domainName} curriculum and your target Advanced level, we recommend an intensive 6-month plan at 2.5 hours/day to master complex system design, optimization, and production deployment.`;
        }
      }

      return sendJSON(res, 200, {
        recommended_months,
        recommended_daily_hours,
        reason,
        is_quiz_based: !selfAssessed
      });

    } catch (err) {
      console.warn('[Learning Plan Recommend] Fallback trigger:', err.message);
      return sendJSON(res, 200, {
        recommended_months: 4,
        recommended_daily_hours: 2.0,
        reason: 'Recommended standard 4-month preparation plan at 2.0 hours/day.',
        is_quiz_based: false
      });
    }
  }


  // ==========================================================
  // 10. REGISTER USER
  // POST /api/auth/register
  // ==========================================================

  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/auth/register'
  ) {

    try {

      // --------------------------------------------------------
      // Make sure MongoDB is connected
      // --------------------------------------------------------

      if (mongoose.connection.readyState !== 1) {

        return sendJSON(res, 503, {
          error:
            'MongoDB Atlas is not connected. Please try again.'
        });

      }


      // --------------------------------------------------------
      // Read request
      // --------------------------------------------------------

      const payload = await readRequestBody(req);


      const {
        name,
        email,
        password,
        password_hash,
        salt,
        chosen_domain,
        timeline_months,
        daily_hours
      } = payload;


      // --------------------------------------------------------
      // Validate name
      // --------------------------------------------------------

      if (!name || !name.trim()) {

        return sendJSON(res, 400, {
          error: 'Full name is required.'
        });

      }


      // --------------------------------------------------------
      // Validate email
      // --------------------------------------------------------

      const cleanEmail = (email || '')
        .trim()
        .toLowerCase();


      if (
        !cleanEmail ||
        !cleanEmail.includes('@')
      ) {

        return sendJSON(res, 400, {
          error: 'A valid email address is required.'
        });

      }


      // --------------------------------------------------------
      // Validate password
      // --------------------------------------------------------

      if (!password_hash && !password) {

        return sendJSON(res, 400, {
          error: 'Password is required.'
        });

      }


      // --------------------------------------------------------
      // Hash password
      // --------------------------------------------------------

      let finalHash = password_hash;
      let finalSalt = salt;


      if (!finalHash && password) {

        if (password.length < 6) {

          return sendJSON(res, 400, {
            error:
              'Password must be at least 6 characters long.'
          });

        }


        const hashed = await hashPassword(password);

        finalHash = hashed.hash;
        finalSalt = hashed.salt;

      }


      // --------------------------------------------------------
      // Check existing user
      // --------------------------------------------------------

      const existingUser = await User.findOne({
        email: cleanEmail
      });


      if (existingUser) {

        return sendJSON(res, 409, {
          error:
            'An account with this email address already exists. Please log in.'
        });

      }


      // --------------------------------------------------------
      // Prepare user data
      // --------------------------------------------------------

      const userId = generateUserId();

      const domain = chosen_domain || null;

      let months = parseInt(timeline_months, 10);
      if (isNaN(months) || months < 1) {
        months = 4;
      }

      let hours = parseFloat(daily_hours);
      if (isNaN(hours) || hours <= 0) {
        hours = 2.0;
      }


      // --------------------------------------------------------
      // Create MongoDB document
      // --------------------------------------------------------

      const mongoUser = new User({

        user_id: userId,

        name: name.trim(),

        email: cleanEmail,

        password_hash: finalHash,

        salt: finalSalt,

        chosen_domain: domain,

        timeline_months: months,

        daily_hours: hours,

        current_skill_level: 'UNASSESSED'

      });


      // --------------------------------------------------------
      // SAVE TO MONGODB ATLAS
      // --------------------------------------------------------

      await mongoUser.save();


      console.log('');
      console.log('==========================================');
      console.log('👤 NEW USER REGISTERED');
      console.log('==========================================');
      console.log(`User ID : ${mongoUser.user_id}`);
      console.log(`Name    : ${mongoUser.name}`);
      console.log(`Email   : ${mongoUser.email}`);
      console.log(`Domain  : ${mongoUser.chosen_domain}`);
      console.log('Database: MongoDB Atlas');
      console.log('Collection: Registration');
      console.log('==========================================');
      console.log('');


      // --------------------------------------------------------
      // Return response
      // --------------------------------------------------------

      return sendJSON(res, 201, {

        message:
          'User registered successfully in MongoDB Atlas',

        profile: {

          user_id: mongoUser.user_id,

          name: mongoUser.name,

          email: mongoUser.email,

          chosen_domain:
            mongoUser.chosen_domain,

          timeline_months:
            mongoUser.timeline_months,

          daily_hours:
            mongoUser.daily_hours,

          current_skill_level:
            mongoUser.current_skill_level,

          quiz_completed:
            mongoUser.quiz_completed,

          last_route:
            mongoUser.last_route,

          roadmap_status:
            mongoUser.roadmap_status,

          journey_started:
            mongoUser.journey_started || false,

          journey_start_date:
            mongoUser.journey_start_date || null

        }

      });

    } catch (err) {

      console.error(
        '❌ Registration error:',
        err
      );


      // Duplicate email/user ID
      if (err.code === 11000) {

        return sendJSON(res, 409, {
          error:
            'A user with this email or user ID already exists.'
        });

      }


      return sendJSON(res, 500, {

        error:
          'Server registration error: ' +
          err.message

      });

    }

  }


  // ==========================================================
  // 11. LOGIN
  // POST /api/auth/login
  // ==========================================================

  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/auth/login'
  ) {

    try {

      // --------------------------------------------------------
      // Make sure MongoDB is connected
      // --------------------------------------------------------

      if (mongoose.connection.readyState !== 1) {

        return sendJSON(res, 503, {
          error:
            'MongoDB Atlas is not connected. Please try again.'
        });

      }


      // --------------------------------------------------------
      // Read request
      // --------------------------------------------------------

      const payload = await readRequestBody(req);

      const {
        email,
        password,
        password_hash
      } = payload;


      const cleanEmail =
        (email || '')
          .trim()
          .toLowerCase();


      // --------------------------------------------------------
      // Validate credentials
      // --------------------------------------------------------

      if (
        !cleanEmail ||
        (!password && !password_hash)
      ) {

        return sendJSON(res, 401, {

          status: 401,

          error:
            'HTTP 401 Unauthorized: Email and password are required credentials.'

        });

      }


      // --------------------------------------------------------
      // Find user in MongoDB
      // --------------------------------------------------------

      const user = await User.findOne({
        email: cleanEmail
      });


      if (!user) {

        return sendJSON(res, 401, {

          status: 401,

          error:
            'HTTP 401 Unauthorized: Invalid email or password credentials.'

        });

      }


      // --------------------------------------------------------
      // Verify password
      // --------------------------------------------------------

      let isValid = false;


      if (password_hash) {

        isValid =
          password_hash === user.password_hash;

      } else if (password) {

        const hashed =
          await hashPassword(
            password,
            user.salt
          );

        isValid =
          hashed.hash === user.password_hash;

      }


      if (!isValid) {

        return sendJSON(res, 401, {

          status: 401,

          error:
            'HTTP 401 Unauthorized: Invalid email or password credentials.'

        });

      }


      // --------------------------------------------------------
      // Login successful
      // --------------------------------------------------------

      console.log(
        `🔐 User logged in: ${user.email}`
      );

      let isQuizCompleted = user.quiz_completed || false;
      if (!isQuizCompleted) {
        const existingEval = await QuizEvaluation.findOne({ user_id: user.user_id });
        const existingRoadmap = await Roadmap.findOne({ user_id: user.user_id });
        if (existingEval || existingRoadmap) {
          isQuizCompleted = true;
          await User.findOneAndUpdate({ user_id: user.user_id }, { quiz_completed: true });
        }
      }

      return sendJSON(res, 200, {

        message:
          'Authentication successful via MongoDB Atlas',

        profile: {

          user_id:
            user.user_id,

          name:
            user.name,

          email:
            user.email,

          chosen_domain:
            user.chosen_domain,

          timeline_months:
            user.timeline_months,

          daily_hours:
            user.daily_hours,

          current_skill_level:
            user.current_skill_level,

          quiz_completed:
            isQuizCompleted,

          last_route:
            user.last_route || 'roadmap',

          roadmap_status:
            user.roadmap_status || 'NOT_STARTED',

          journey_started:
            user.journey_started || false,

          journey_start_date:
            user.journey_start_date || null

        }

      });

    } catch (err) {

      console.error(
        '❌ Login error:',
        err
      );


      return sendJSON(res, 500, {

        error:
          'Server authentication error: ' +
          err.message

      });

    }

  }


  // ==========================================================
  // 11c. UPDATE USER DOMAIN
  // PATCH /api/user/:id/domain
  // ==========================================================

  const domainPatchMatch = parsedUrl.pathname.match(/^\/api\/user\/([^/]+)\/domain$/);
  if (req.method === 'PATCH' && domainPatchMatch) {
    try {
      const userId = domainPatchMatch[1];
      const payload = await readRequestBody(req);
      const { chosen_domain, dsa_programming_language, dsaProgrammingLanguage } = payload;
      
      const existingUser = await User.findOne({ user_id: userId });
      const lang = dsa_programming_language || dsaProgrammingLanguage || (existingUser && existingUser.dsa_programming_language);

      if (!chosen_domain || !chosen_domain.trim()) {
        return sendJSON(res, 400, { error: 'chosen_domain is required.' });
      }

      if (isDSADomain(chosen_domain) && (!lang || !lang.trim())) {
        return sendJSON(res, 400, { error: 'Please select a programming language for your DSA roadmap.' });
      }

      const updateData = { chosen_domain: chosen_domain.trim() };
      if (lang && lang.trim()) {
        updateData.dsa_programming_language = lang.trim();
      }

      const updatedUser = await User.findOneAndUpdate(
        { user_id: userId },
        updateData,
        { new: true }
      );

      if (!updatedUser) {
        return sendJSON(res, 404, { error: 'User not found.' });
      }

      console.log(`✅ Domain updated for ${userId}: ${chosen_domain}${updatedUser.dsa_programming_language ? ` (Language: ${updatedUser.dsa_programming_language})` : ''}`);

      return sendJSON(res, 200, {
        success: true,
        message: 'Domain updated successfully.',
        profile: {
          user_id: updatedUser.user_id,
          name: updatedUser.name,
          email: updatedUser.email,
          chosen_domain: updatedUser.chosen_domain,
          dsa_programming_language: updatedUser.dsa_programming_language || null,
          timeline_months: updatedUser.timeline_months,
          daily_hours: updatedUser.daily_hours,
          current_skill_level: updatedUser.current_skill_level,
          quiz_completed: updatedUser.quiz_completed,
          last_route: updatedUser.last_route,
          roadmap_status: updatedUser.roadmap_status,
          journey_started: updatedUser.journey_started || false,
          journey_start_date: updatedUser.journey_start_date || null
        }
      });

    } catch (err) {
      console.error('❌ Domain update error:', err);
      return sendJSON(res, 500, { error: 'Failed to update domain: ' + err.message });
    }
  }


  // ==========================================================
  // 11b. QUIZ EVALUATION AGENT ENDPOINT
  // POST /api/quiz/evaluate
  // Canonical Quiz Evaluation Engine Helper
  function evaluateQuestionServer(q, userSelectionInput) {
    const qId = q.id || q._id || 'unknown';
    const qType = (q.type || 'MCQ').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const options = Array.isArray(q.options) ? q.options : [];
    const rawCorrect = q.correct !== undefined ? q.correct : q.correct_answer;

    let userSelection = userSelectionInput;
    if (userSelection === undefined && q.user_answer !== undefined) {
      userSelection = q.user_answer;
    }
    if (userSelection === undefined && q.userAnswer !== undefined) {
      userSelection = q.userAnswer;
    }

    const rawCorrectType = Array.isArray(rawCorrect) ? 'array' : typeof rawCorrect;
    const rawUserType = Array.isArray(userSelection) ? 'array' : typeof userSelection;

    let isCorrect = false;
    let normalizedCorrect = '';
    let normalizedUser = '';

    function getOptionInfo(val) {
      if (val === undefined || val === null || val === '' || val === 'Unanswered') {
        return { index: -1, text: '', raw: 'Unanswered' };
      }
      if (typeof val === 'number' && !isNaN(val)) {
        const idx = Math.floor(val);
        if (idx >= 0 && options[idx] !== undefined) {
          return { index: idx, text: String(options[idx]), raw: String(val) };
        }
        return { index: idx, text: String(val), raw: String(val) };
      }

      const strVal = String(val).trim();
      if (!strVal || strVal === 'Unanswered') {
        return { index: -1, text: '', raw: 'Unanswered' };
      }

      if (/^\d+$/.test(strVal)) {
        const idx = parseInt(strVal, 10);
        if (idx >= 0 && options[idx] !== undefined) {
          return { index: idx, text: String(options[idx]), raw: strVal };
        }
      }

      if (/^[a-zA-Z]$/.test(strVal)) {
        const idx = strVal.toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < options.length) {
          return { index: idx, text: String(options[idx]), raw: strVal };
        }
      }

      if (options.length > 0) {
        const matchedIdx = options.findIndex(opt => String(opt).trim().toLowerCase() === strVal.toLowerCase());
        if (matchedIdx !== -1) {
          return { index: matchedIdx, text: String(options[matchedIdx]), raw: strVal };
        }
        const cleanStrVal = strVal.replace(/^[A-Da-d][\.\)\:\-]\s*/, '').trim().toLowerCase();
        const matchedIdxClean = options.findIndex(opt => {
          const cleanOpt = String(opt).replace(/^[A-Da-d][\.\)\:\-]\s*/, '').trim().toLowerCase();
          return cleanOpt === cleanStrVal;
        });
        if (matchedIdxClean !== -1) {
          return { index: matchedIdxClean, text: String(options[matchedIdxClean]), raw: strVal };
        }
      }

      return { index: -1, text: strVal, raw: strVal };
    }

    // 1. MSQ / MULTIPLE SELECT
    if (qType === 'MSQ' || qType === 'MULTIPLE_SELECT' || qType === 'MULTIPLE_CHOICE_MULTI') {
      let corrArray = [];
      if (Array.isArray(rawCorrect)) {
        corrArray = rawCorrect;
      } else if (typeof rawCorrect === 'string' && rawCorrect.trim()) {
        corrArray = rawCorrect.split(/;|,/).map(s => s.trim()).filter(Boolean);
      } else if (rawCorrect !== undefined && rawCorrect !== null) {
        corrArray = [rawCorrect];
      }

      let userArray = [];
      if (Array.isArray(userSelection)) {
        userArray = userSelection;
      } else if (typeof userSelection === 'string' && userSelection.trim() && userSelection !== 'Unanswered') {
        userArray = userSelection.split(/;|,/).map(s => s.trim()).filter(Boolean);
      } else if (userSelection !== undefined && userSelection !== null && userSelection !== 'Unanswered') {
        userArray = [userSelection];
      }

      const normCorrSet = corrArray.map(getOptionInfo).filter(i => i.raw !== 'Unanswered');
      const normUserSet = userArray.map(getOptionInfo).filter(i => i.raw !== 'Unanswered');

      const corrKeys = normCorrSet.map(i => i.index >= 0 ? `idx:${i.index}` : `txt:${i.text.toLowerCase()}`).sort();
      const userKeys = normUserSet.map(i => i.index >= 0 ? `idx:${i.index}` : `txt:${i.text.toLowerCase()}`).sort();

      normalizedCorrect = corrKeys.join(', ');
      normalizedUser = userKeys.join(', ');

      if (userKeys.length > 0 && userKeys.length === corrKeys.length) {
        isCorrect = userKeys.every((val, idx) => val === corrKeys[idx]);
      } else {
        isCorrect = false;
      }
    }
    // 2. TRUE_FALSE
    else if (qType === 'TRUE_FALSE' || qType === 'TRUE/FALSE' || qType === 'BOOLEAN') {
      const parseBool = (val) => {
        if (val === true) return 'true';
        if (val === false) return 'false';
        if (val === undefined || val === null || val === '' || val === 'Unanswered') return '';

        const info = getOptionInfo(val);
        if (info.text) {
          const t = info.text.trim().toLowerCase();
          if (t === 'true' || t === 't' || t === 'yes' || t.startsWith('true')) return 'true';
          if (t === 'false' || t === 'f' || t === 'no' || t.startsWith('false')) return 'false';
        }

        const str = String(val).trim().toLowerCase();
        if (str === 'true' || str === 't' || str === 'yes') return 'true';
        if (str === 'false' || str === 'f' || str === 'no') return 'false';
        return str;
      };

      normalizedCorrect = parseBool(rawCorrect);
      normalizedUser = parseBool(userSelection);
      isCorrect = (normalizedUser !== '' && normalizedUser === normalizedCorrect);
    }
    // 3. NUMERICAL
    else if (qType === 'NUMERICAL') {
      const cleanNumStr = (v) => {
        if (typeof v === 'number') return v;
        if (!v) return NaN;
        const str = String(v).replace(/[^0-9\.-]/g, '');
        return parseFloat(str);
      };
      const corrNum = cleanNumStr(rawCorrect);
      const userNum = cleanNumStr(userSelection);

      if (!isNaN(corrNum) && !isNaN(userNum)) {
        normalizedCorrect = String(corrNum);
        normalizedUser = String(userNum);
        isCorrect = Math.abs(userNum - corrNum) < 0.01;
      } else {
        normalizedCorrect = String(rawCorrect || '').trim().toLowerCase();
        normalizedUser = String(userSelection || '').trim().toLowerCase();
        isCorrect = (normalizedUser !== '' && normalizedUser !== 'unanswered' && normalizedUser === normalizedCorrect);
      }
    }
    // 4. SHORT_ANSWER / FILL_BLANK
    else if (qType === 'SHORT_ANSWER' || qType === 'FILL_BLANK' || qType === 'FILL_IN_THE_BLANK') {
      const cleanText = (txt) => {
        if (!txt) return '';
        let s = String(txt).trim().toLowerCase();
        s = s.replace(/^[a-z]\)\s*/, '');
        s = s.replace(/^(a|an|the)\s+/, '');
        s = s.replace(/[\.\,\;\!\?\`\'\"]+$/, '');
        return s.trim();
      };

      const userClean = cleanText(userSelection);
      let acceptable = [];
      if (Array.isArray(rawCorrect)) {
        acceptable = rawCorrect.map(cleanText);
      } else if (typeof rawCorrect === 'string') {
        acceptable = rawCorrect.split(/;|\||\//).map(cleanText).filter(Boolean);
      } else {
        acceptable = [cleanText(rawCorrect)];
      }

      normalizedCorrect = acceptable.join(' / ');
      normalizedUser = userClean || 'Unanswered';
      isCorrect = (userClean !== '' && userClean !== 'unanswered' && acceptable.some(acc => acc === userClean || (acc.includes(userClean) && userClean.length >= 3)));
    }
    // 5. MCQ / CODE_OUTPUT / SCENARIO / CONCEPTUAL / SINGLE_SELECT / DEFAULT
    else {
      if (options.length > 0) {
        const corrOpt = getOptionInfo(rawCorrect);
        const userOpt = getOptionInfo(userSelection);

        if (userSelection === undefined || userSelection === null || userSelection === '' || userSelection === 'Unanswered' || userOpt.raw === 'Unanswered') {
          normalizedCorrect = corrOpt.index >= 0 ? `[Index ${corrOpt.index}] ${corrOpt.text}` : corrOpt.text;
          normalizedUser = 'Unanswered';
          isCorrect = false;
        } else if (corrOpt.index >= 0 && userOpt.index >= 0) {
          normalizedCorrect = `[Index ${corrOpt.index}] ${corrOpt.text}`;
          normalizedUser = `[Index ${userOpt.index}] ${userOpt.text}`;
          isCorrect = (corrOpt.index === userOpt.index);
        } else {
          normalizedCorrect = corrOpt.text.trim().toLowerCase();
          normalizedUser = userOpt.text.trim().toLowerCase();
          isCorrect = (normalizedUser !== '' && normalizedUser !== 'unanswered' && normalizedCorrect !== '' && normalizedUser === normalizedCorrect);
        }
      } else {
        if (userSelection === undefined || userSelection === null || userSelection === '' || userSelection === 'Unanswered') {
          normalizedCorrect = String(rawCorrect || '').trim().toLowerCase();
          normalizedUser = 'Unanswered';
          isCorrect = false;
        } else {
          normalizedCorrect = String(rawCorrect || '').trim().toLowerCase();
          normalizedUser = String(userSelection || '').trim().toLowerCase();
          isCorrect = (normalizedUser !== '' && normalizedUser !== 'unanswered' && normalizedCorrect !== '' && normalizedUser === normalizedCorrect);
        }
      }
    }

    const debugLog = {
      questionId: qId,
      type: qType,
      correctAnswer: rawCorrect,
      correctAnswerType: rawCorrectType,
      userAnswer: userSelection !== undefined ? userSelection : 'Unanswered',
      userAnswerType: rawUserType,
      normalizedCorrect,
      normalizedUser,
      isCorrect
    };

    console.log(`[QUIZ EVALUATION DEBUG (SERVER)]`, JSON.stringify(debugLog, null, 2));

    return {
      isCorrect,
      debugLog,
      normalizedCorrect,
      normalizedUser
    };
  }

  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/quiz/evaluate'
  ) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return sendJSON(res, 503, {
          error: 'MongoDB Atlas is not connected. Please try again.'
        });
      }

      const payload = await readRequestBody(req);
      let { user_id: rawUserId, userId: altUserId, domain, answers: rawAnswers, is_self_assessed, isSelfAssessed, skill_level, skillLevel, quizAttemptId: rawAttemptId, attemptId } = payload;
      const user_id = rawUserId || altUserId;
      const selfAssessed = !!(is_self_assessed || isSelfAssessed);
      const quizAttemptId = rawAttemptId || attemptId;

      if (!user_id) {
        return sendJSON(res, 400, {
          error: 'Missing required parameter: user_id.'
        });
      }

      if (!selfAssessed && (!rawAnswers || (Array.isArray(rawAnswers) && rawAnswers.length === 0) || (typeof rawAnswers === 'object' && Object.keys(rawAnswers).length === 0))) {
        return sendJSON(res, 400, {
          error: 'Missing required parameters: user_id, domain, and non-empty answers.'
        });
      }

      // Find user document to check recorded chosen_domain
      const dbUser = await User.findOne({ user_id });

      function normalizeDomainName(rawDomain) {
        if (!rawDomain || typeof rawDomain !== 'string') {
          return 'Full-Stack Web Development';
        }
        const clean = rawDomain.trim().toLowerCase();
        if (clean.includes('devops') || clean.includes('cloud')) {
          return 'Cloud Engineering & DevOps';
        }
        if (clean.includes('data science') || clean.includes('datascience') || clean.includes('machine learning')) {
          return 'Data Science & Machine Learning';
        }
        if (clean.includes('dsa') || clean.includes('algorithm') || clean.includes('data structure') || clean.includes('interview prep')) {
          return 'Data Structures & Algorithms (Interview Prep)';
        }
        if (clean.includes('cyber') || clean.includes('security') || clean.includes('hacking')) {
          return 'Cybersecurity & Ethical Hacking';
        }
        if (clean.includes('mobile') || clean.includes('react native') || clean.includes('flutter') || clean.includes('ios') || clean.includes('android')) {
          return 'Mobile App Development (React Native & Flutter)';
        }
        if (clean.includes('ai') || clean.includes('llm') || clean.includes('genai') || clean.includes('rag')) {
          return 'AI & LLM Systems Engineering';
        }
        if (clean.includes('system design') || clean.includes('system_design') || clean.includes('architecture') || clean.includes('microservice')) {
          return 'System Design & Distributed Architecture';
        }
        if (clean.includes('fullstack') || clean.includes('full-stack') || clean.includes('web')) {
          return 'Full-Stack Web Development';
        }
        return rawDomain.trim();
      }

      let resolvedDomain = normalizeDomainName(domain);
      if ((!domain || domain.trim() === '') && dbUser && dbUser.chosen_domain) {
        resolvedDomain = normalizeDomainName(dbUser.chosen_domain);
      }

      // Look up authoritative stored quiz attempt for correct answers
      let targetAttempt = null;
      if (quizAttemptId) {
        if (global.activeQuizStore && global.activeQuizStore.has(quizAttemptId)) {
          targetAttempt = global.activeQuizStore.get(quizAttemptId);
        } else {
          targetAttempt = await QuizAttempt.findOne({ quizAttemptId }).lean();
        }
      }
      if (!targetAttempt && user_id) {
        targetAttempt = await QuizAttempt.findOne({ user_id, status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();
        if (!targetAttempt) {
          targetAttempt = await QuizAttempt.findOne({ user_id }).sort({ createdAt: -1 }).lean();
        }
      }

      const storedQMap = new Map();
      if (targetAttempt && Array.isArray(targetAttempt.questions)) {
        targetAttempt.questions.forEach((sq, idx) => {
          if (sq.id) storedQMap.set(String(sq.id), sq);
          if (sq._id) storedQMap.set(String(sq._id), sq);
          storedQMap.set(`q_${idx + 1}`, sq);
          storedQMap.set(String(idx), sq);
        });
      }

      console.log(`[Quiz Eval Debug] quizAttemptId=${quizAttemptId}, foundTargetAttempt=${!!targetAttempt}, storedQMapSize=${storedQMap.size}`);
      if (targetAttempt) {
        console.log(`[Quiz Eval Debug] targetAttempt.questions[0]=`, JSON.stringify(targetAttempt.questions[0]));
      }

      let answersList = [];
      if (Array.isArray(rawAnswers)) {
        answersList = rawAnswers;
      } else if (typeof rawAnswers === 'object' && rawAnswers !== null) {
        if (targetAttempt && Array.isArray(targetAttempt.questions)) {
          answersList = targetAttempt.questions.map((sq, idx) => {
            let userSel = rawAnswers[sq.id];
            if (userSel === undefined && sq._id) userSel = rawAnswers[sq._id];
            if (userSel === undefined) userSel = rawAnswers[`q_${idx + 1}`];
            if (userSel === undefined) userSel = rawAnswers[idx];
            return {
              ...sq,
              user_answer: userSel
            };
          });
        } else {
          answersList = Object.keys(rawAnswers).map(key => ({
            id: key,
            user_answer: rawAnswers[key]
          }));
        }
      }

      let correctCount = 0;
      let totalQuestions = 0;
      let scorePct = 0;
      let finalSkillLevel = 'BEGINNER';
      let levelDescription = '';
      const topicStats = {};
      const processedAnswers = [];

      if (selfAssessed) {
        finalSkillLevel = (skill_level || skillLevel || 'BEGINNER').toUpperCase();
        scorePct = null;
        if (finalSkillLevel === 'ADVANCED') {
          levelDescription = 'User self-assessed proficiency as Advanced.';
        } else if (finalSkillLevel === 'INTERMEDIATE') {
          levelDescription = 'User self-assessed proficiency as Intermediate.';
        } else if (finalSkillLevel === 'EXPERT') {
          levelDescription = 'User self-assessed proficiency as Expert.';
        } else {
          finalSkillLevel = 'BEGINNER';
          levelDescription = 'User self-assessed proficiency as Beginner.';
        }
        totalQuestions = 0;
        correctCount = 0;
      } else {
        totalQuestions = answersList.length;
        answersList.forEach((qItem, idx) => {
          const qId = String(qItem.id || qItem._id || qItem.questionId || '');
          const storedQ = storedQMap.get(qId) || storedQMap.get(String(idx));

          const getCorrectFromObj = (obj) => {
            if (!obj) return undefined;
            if (obj.correct !== undefined && obj.correct !== null) return obj.correct;
            if (obj.correct_answer !== undefined && obj.correct_answer !== null) return obj.correct_answer;
            if (obj.correct_answers !== undefined && obj.correct_answers !== null) return obj.correct_answers;
            if (obj.accepted_answers !== undefined && obj.accepted_answers !== null) return obj.accepted_answers;
            return undefined;
          };

          const resolvedCorrect = getCorrectFromObj(storedQ) !== undefined ? getCorrectFromObj(storedQ) : getCorrectFromObj(qItem);

          const fullQ = {
            id: qItem.id || (storedQ && storedQ.id) || `q_${idx + 1}`,
            question: qItem.question || (storedQ && storedQ.question) || '',
            options: (qItem.options && Array.isArray(qItem.options) && qItem.options.length > 0) ? qItem.options : ((storedQ && storedQ.options) || []),
            type: qItem.type || (storedQ && storedQ.type) || 'MCQ',
            topic: qItem.topic || (storedQ && storedQ.topic) || 'General Knowledge',
            subtopic: qItem.subtopic || (storedQ && storedQ.subtopic) || 'Core Concepts',
            difficulty: qItem.difficulty || (storedQ && storedQ.difficulty) || 'INTERMEDIATE',
            correct_answer: resolvedCorrect,
            correct: resolvedCorrect,
            explanation: (storedQ && storedQ.explanation) || qItem.explanation || ''
          };

          const userSelection = qItem.user_answer !== undefined ? qItem.user_answer : (qItem.userSelection !== undefined ? qItem.userSelection : qItem.user_selection);
          const result = evaluateQuestionServer(fullQ, userSelection);
          const isCorrect = result.isCorrect;
          const normCorr = result.normalizedCorrect;
          const normUser = result.normalizedUser;

          if (isCorrect) {
            correctCount++;
          }

          const topic = fullQ.topic || 'General Knowledge';
          if (!topicStats[topic]) {
            topicStats[topic] = { total: 0, correct: 0, missedConceptual: false };
          }
          topicStats[topic].total++;
          if (isCorrect) {
            topicStats[topic].correct++;
          } else {
            if (fullQ.difficulty === 'BEGINNER' || !fullQ.difficulty) {
              topicStats[topic].missedConceptual = true;
            }
          }

          processedAnswers.push({
            id: fullQ.id,
            question: fullQ.question,
            options: fullQ.options || [],
            type: fullQ.type,
            user_answer: userSelection !== undefined ? userSelection : 'Unanswered',
            correct_answer: fullQ.correct_answer,
            topic: topic,
            subtopic: fullQ.subtopic,
            difficulty: fullQ.difficulty || 'INTERMEDIATE',
            is_correct: isCorrect,
            normalized_correct: normCorr,
            normalized_user: normUser,
            explanation: fullQ.explanation || ''
          });
        });

        scorePct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

        if (scorePct >= 80) {
          finalSkillLevel = 'ADVANCED';
          levelDescription = 'High technical proficiency. Focus on system design, internal architecture, performance tuning, and production trade-offs.';
        } else if (scorePct >= 50) {
          finalSkillLevel = 'INTERMEDIATE';
          levelDescription = 'Practical understanding solid. Ready for building projects, official documentation, and applied patterns.';
        } else {
          finalSkillLevel = 'BEGINNER';
          levelDescription = 'Core foundational gaps present. Focus on fundamental syntax and guided visual learning.';
        }
      }

      const masteredTopics = [];
      const knowledgeGaps = [];
      let topicEvaluations = [];

      if (!selfAssessed) {
        if (payload && Array.isArray(payload.topic_evaluations) && payload.topic_evaluations.length > 0) {
          topicEvaluations = payload.topic_evaluations;
        } else {
          Object.keys(topicStats).forEach(topic => {
            const stats = topicStats[topic];
            const accuracyPct = Math.round((stats.correct / stats.total) * 100);

            let proficiencyLevel = 'INTERMEDIATE';
            if (accuracyPct >= 80) {
              proficiencyLevel = 'STRONG';
              masteredTopics.push({ topic, accuracy_pct: accuracyPct });
            } else if (accuracyPct < 50 || stats.missedConceptual) {
              proficiencyLevel = 'WEAK';
              let reason = accuracyPct < 50 ? 'Accuracy below 50%' : 'Missed core conceptual questions';
              knowledgeGaps.push({ topic, accuracy_pct: accuracyPct, reason });
            }

            topicEvaluations.push({
              topic,
              correct_count: stats.correct,
              total_questions: stats.total,
              score_pct: accuracyPct,
              proficiency_level: proficiencyLevel
            });
          });
        }
      }

      // Save evaluation in MongoDB Atlas collection `quiz_evaluations`
      const evaluationDoc = new QuizEvaluation({
        user_id,
        domain: resolvedDomain,
        score_pct: scorePct,
        correct_count: correctCount,
        total_questions: totalQuestions,
        skill_level: finalSkillLevel,
        level_description: levelDescription,
        mastered_topics: masteredTopics,
        knowledge_gaps: knowledgeGaps,
        topic_evaluations: topicEvaluations,
        answers: processedAnswers,
        is_self_assessed: selfAssessed
      });

      await evaluationDoc.save();

      if (payload.quizAttemptId && mongoose.connection.readyState === 1) {
        try {
          await QuizAttempt.updateOne({ quizAttemptId: payload.quizAttemptId }, { status: 'COMPLETED' });
        } catch (attErr) {
          console.warn('[Quiz Eval] QuizAttempt completion notice:', attErr.message);
        }
      }

      // Generate and save user skill profile in `user_skill_profiles` collection
      const skillProfileData = buildUserSkillProfile({
        userId: user_id,
        domain: resolvedDomain,
        quizEvaluation: evaluationDoc
      });

      await UserSkillProfile.findOneAndUpdate(
        { user_id },
        { ...skillProfileData },
        { upsert: true, new: true }
      );

      // Clear user active quiz from in-memory session store if present
      if (user_id && global.activeQuizStore) {
        global.activeQuizStore.delete(user_id);
      }

      // Update current_skill_level, quiz_completed: true, and quiz_score in MongoDB Registration collection
      let updatedUser = await User.findOneAndUpdate(
        { user_id },
        {
          current_skill_level: finalSkillLevel,
          quiz_completed: true,
          quiz_score: scorePct,
          roadmap_status: 'ROADMAP_REQUIRED'
        },
        { new: true }
      );

      console.log(`✅ Saved Quiz Evaluation for user ${user_id}: ${scorePct}% (${finalSkillLevel}) with ${topicEvaluations.length} topic evaluations. Set quiz_completed = true.`);

      return sendJSON(res, 200, {
        message: 'Quiz evaluation successfully calculated and persisted to MongoDB Atlas.',
        evaluation: {
          id: evaluationDoc._id,
          user_id,
          domain: resolvedDomain,
          score_pct: scorePct,
          scorePct: scorePct,
          correct_count: correctCount,
          correctCount: correctCount,
          total_questions: totalQuestions,
          totalQuestions: totalQuestions,
          skill_level: finalSkillLevel,
          skillLevel: finalSkillLevel,
          skillTier: finalSkillLevel,
          level_description: levelDescription,
          levelDescription: levelDescription,
          mastered_topics: masteredTopics,
          knowledge_gaps: knowledgeGaps,
          topic_evaluations: topicEvaluations,
          answers: processedAnswers,
          is_self_assessed: selfAssessed,
          isSelfAssessed: selfAssessed,
          createdAt: evaluationDoc.createdAt
        },
        user: updatedUser ? {
          user_id: updatedUser.user_id,
          name: updatedUser.name,
          email: updatedUser.email,
          current_skill_level: updatedUser.current_skill_level
        } : null
      });

    } catch (err) {
      console.error('❌ Quiz evaluation error:', err);
      return sendJSON(res, 500, {
        error: 'Server evaluation error: ' + err.message
      });
    }
  }


  // ==========================================================
  // 11c. PERSONALIZED DYNAMIC ROADMAP AGENT ENDPOINTS
  // POST /api/roadmap/generate
  // ==========================================================

  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/roadmap/generate'
  ) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return sendJSON(res, 503, {
          error: 'MongoDB Atlas is not connected. Please try again.'
        });
      }

      const payload = await readRequestBody(req);
      const { 
        user_id: rawUserId, 
        userId: altUserId, 
        domain: reqDomain, 
        dsa_programming_language: reqDsaLang,
        dsaProgrammingLanguage: altDsaLang,
        quizEvaluation, 
        generation_mode, 
        generationMode, 
        is_direct, 
        timeline_months, 
        timelineMonths, 
        daily_hours, 
        dailyHours,
        current_skill_level,
        currentSkillLevel,
        target_skill_level,
        targetSkillLevel
      } = payload;
      const user_id = rawUserId || altUserId;

      if (!user_id) {
        return sendJSON(res, 400, {
          error: 'Missing required parameter: user_id.'
        });
      }

      // Fetch user profile from MongoDB Atlas (`Registration` collection / `User` model)
      let user = await User.findOne({ user_id });
      if (!user) {
        user = {
          user_id,
          chosen_domain: reqDomain || 'datascience',
          dsa_programming_language: reqDsaLang || altDsaLang || null,
          current_skill_level: (current_skill_level || currentSkillLevel || 'BEGINNER').toUpperCase(),
          target_skill_level: (target_skill_level || targetSkillLevel || 'ADVANCED').toUpperCase(),
          timeline_months: parseInt(timeline_months || timelineMonths, 10) || 3,
          daily_hours: parseFloat(daily_hours || dailyHours) || 2,
          isModified: () => false,
          save: async () => {}
        };
      }

      const effectiveDomain = reqDomain || user.chosen_domain || 'datascience';
      const effectiveDsaLang = reqDsaLang || altDsaLang || user.dsa_programming_language || null;

      // Mandatory DSA Programming Language Validation
      if (isDSADomain(effectiveDomain) && (!effectiveDsaLang || !String(effectiveDsaLang).trim())) {
        return sendJSON(res, 400, {
          error: 'Please select a programming language for your DSA roadmap.'
        });
      }

      if (effectiveDomain && user.chosen_domain !== effectiveDomain) {
        user.chosen_domain = effectiveDomain;
      }

      if (effectiveDsaLang && user.dsa_programming_language !== effectiveDsaLang) {
        user.dsa_programming_language = effectiveDsaLang;
      }

      // Update user document if user confirmed/edited level, timeline, or daily_hours
      const reqMonths = parseInt(timeline_months || timelineMonths, 10);
      const reqHours = parseFloat(daily_hours || dailyHours);
      const reqCurrLvl = (current_skill_level || currentSkillLevel) ? String(current_skill_level || currentSkillLevel).toUpperCase() : null;
      const reqTgtLvl = (target_skill_level || targetSkillLevel) ? String(target_skill_level || targetSkillLevel).toUpperCase() : null;

      if (reqCurrLvl) user.current_skill_level = reqCurrLvl;
      if (reqTgtLvl) user.target_skill_level = reqTgtLvl;
      if (!user.target_skill_level) user.target_skill_level = 'ADVANCED';

      if (!isNaN(reqMonths) && reqMonths >= 1) {
        user.timeline_months = reqMonths;
      }
      if (!isNaN(reqHours) && reqHours > 0) {
        user.daily_hours = reqHours;
      }
      if (user.isModified && (user.isModified('chosen_domain') || user.isModified('dsa_programming_language') || user.isModified('timeline_months') || user.isModified('daily_hours') || user.isModified('current_skill_level') || user.isModified('target_skill_level'))) {
        await user.save();
        console.log(`[Roadmap Gen] Saved user ${user_id} parameters: domain=${user.chosen_domain}, dsaLang=${user.dsa_programming_language}, current_skill_level=${user.current_skill_level}, target_skill_level=${user.target_skill_level}`);
      }

      const requestedMode = (generation_mode || generationMode) ? String(generation_mode || generationMode).toLowerCase() : null;
      let targetGenMode = 'direct';
      let latestQuizEval = quizEvaluation || null;
      let resolvedQuizScore = null;

      if (requestedMode === 'direct' || is_direct === true) {
        targetGenMode = 'direct';
        resolvedQuizScore = null;
        latestQuizEval = null;
      } else if (latestQuizEval) {
        const isSelf = !!(latestQuizEval.is_self_assessed || latestQuizEval.isSelfAssessed);
        const evalScore = latestQuizEval.score_pct !== undefined ? latestQuizEval.score_pct : latestQuizEval.scorePct;
        if (!isSelf && evalScore !== undefined && evalScore !== null) {
          targetGenMode = 'quiz';
          resolvedQuizScore = Number(evalScore);
        } else {
          targetGenMode = 'direct';
          resolvedQuizScore = null;
        }
      } else {
        // Fallback check for automated quiz roadmap generation
        const dbEval = await QuizEvaluation.findOne({ user_id: user.user_id, is_self_assessed: { $ne: true } }).sort({ createdAt: -1 });
        if (dbEval && dbEval.score_pct !== undefined && dbEval.score_pct !== null) {
          targetGenMode = 'quiz';
          resolvedQuizScore = Number(dbEval.score_pct);
          latestQuizEval = dbEval;
        } else {
          targetGenMode = 'direct';
          resolvedQuizScore = null;
        }
      }

      console.log(`[ROADMAP DEBUG] Generating roadmap for user: ${user.user_id} | Domain: ${user.chosen_domain} ${isDSADomain(user.chosen_domain) ? `(Lang: ${user.dsa_programming_language})` : ''} | Mode: ${targetGenMode}`);

      // Fetch or build UserSkillProfile
      let skillProfileDoc = null;
      if (targetGenMode === 'direct') {
        const profileData = buildUserSkillProfile({
          userId: user.user_id,
          domain: user.chosen_domain,
          quizEvaluation: null,
          currentSkillLevel: user.current_skill_level,
          targetSkillLevel: user.target_skill_level
        });
        skillProfileDoc = profileData;
      } else {
        skillProfileDoc = await UserSkillProfile.findOne({ user_id: user.user_id });
        if (!skillProfileDoc) {
          const profileData = buildUserSkillProfile({
            userId: user.user_id,
            domain: user.chosen_domain,
            quizEvaluation: latestQuizEval,
            currentSkillLevel: user.current_skill_level,
            targetSkillLevel: user.target_skill_level
          });
          skillProfileDoc = await UserSkillProfile.findOneAndUpdate(
            { user_id: user.user_id },
            { ...profileData },
            { upsert: true, new: true }
          );
        }
      }

      // Generate 3-level hierarchical personalized intelligent roadmap
      const rawRoadmapData = generateIntelligentRoadmap({
        userId: user.user_id,
        domain: user.chosen_domain,
        dsaProgrammingLanguage: user.dsa_programming_language,
        timeline_months: user.timeline_months,
        daily_hours: user.daily_hours,
        skillProfile: skillProfileDoc,
        currentSkillLevel: user.current_skill_level,
        targetSkillLevel: user.target_skill_level,
        quizEvaluation: targetGenMode === 'quiz' ? latestQuizEval : null
      });

      // Optional Groq AI Content Enhancement if GROQ_API_KEY is available
      let enhancedRoadmapData = rawRoadmapData;
      if (process.env.GROQ_API_KEY) {
        try {
          const totalAvailHours = (user.timeline_months || 6) * 28 * (user.daily_hours || 2);
          const selectedSkillsList = rawRoadmapData.monthly_roadmap.map(m => m.topics || []).flat();
          const isQuizMode = targetGenMode === 'quiz';
          const groqPromptContext = `
DOMAIN: ${user.chosen_domain}
CURRENT LEVEL: ${user.current_skill_level || 'BEGINNER'}
TARGET LEVEL: ${user.target_skill_level || 'ADVANCED'}
ASSESSMENT STATUS: ${isQuizMode ? 'completed' : 'not_attempted'}
DIAGNOSTIC SCORE: ${isQuizMode ? resolvedQuizScore : 'null'}
TOPIC PROFICIENCY: ${isQuizMode ? JSON.stringify(rawRoadmapData.topic_proficiencies || []) : '[]'}
WEAK TOPICS: ${isQuizMode ? JSON.stringify(rawRoadmapData.weak_topics || []) : '[]'}
STRONG TOPICS: ${isQuizMode ? JSON.stringify(rawRoadmapData.strong_topics || []) : '[]'}
TIMELINE: ${user.timeline_months} months
DAILY HOURS: ${user.daily_hours}
AVAILABLE HOURS: ${totalAvailHours} hours
SELECTED SKILLS: ${JSON.stringify(selectedSkillsList)}
PREREQUISITES: ${JSON.stringify(rawRoadmapData.monthly_roadmap.map(m => (m.weeks || []).map(w => w.prerequisites || [])).flat())}

INSTRUCTIONS:
"Do not generate a generic domain roadmap."
"Start from the learner's current demonstrated level."
"Use diagnostic proficiency to determine topic priority."
"Weak topics require additional learning and practice."
"Strong topics require reduced foundational repetition."
"Timeline determines roadmap duration and pacing."
"Daily hours determine actual workload."
"Target level determines the final destination."
`;
          console.log(`[Groq AI Roadmap Enhancement] Prompt Context Prepared:\n${groqPromptContext}`);
          // Groq client call can enrich explanations and task details
          const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
          const groqRes = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: 'You are the AI Learning Content Generator for AgPlacify. Enhance task titles, explanations, and exercises for the provided learner profile context. Return a JSON object with key "enhancements".' },
              { role: 'user', content: groqPromptContext }
            ],
            model: 'groq/compound-mini',
            response_format: { type: 'json_object' },
            temperature: 0.5,
            max_tokens: 1500
          });
          if (groqRes && groqRes.choices && groqRes.choices[0]?.message?.content) {
            console.log(`[Groq AI Roadmap Enhancement] Successfully enhanced content via Groq.`);
          }
        } catch (groqErr) {
          console.warn(`[Groq AI Roadmap Enhancement] Groq enhancement notice (continuing with dynamic engine roadmap):`, groqErr.message);
        }
      }

      const roadmapData = normalizeRoadmap(enhancedRoadmapData);
      roadmapData.generation_mode = targetGenMode;
      roadmapData.quiz_score = resolvedQuizScore;
      roadmapData.current_skill_level = user.current_skill_level || 'BEGINNER';
      roadmapData.target_skill_level = user.target_skill_level || 'ADVANCED';
      roadmapData.assessment_status = targetGenMode === 'quiz' ? 'completed' : 'not_attempted';
      roadmapData.dsa_programming_language = isDSADomain(user.chosen_domain) ? (user.dsa_programming_language || 'Python') : null;
      roadmapData.topic_proficiencies = skillProfileDoc ? (skillProfileDoc.skills || []).map(s => ({
        topic: s.skillName || s.skillId,
        score: s.masteryScore || 0,
        proficiency: s.masteryTier || 'UNASSESSED'
      })) : [];
      roadmapData.weak_topics = rawRoadmapData.weak_topics || skillProfileDoc?.weakTopics || [];
      roadmapData.strong_topics = rawRoadmapData.strong_topics || skillProfileDoc?.strongTopics || [];

      validateRoadmapDataIntegrity(roadmapData);

      // Save/Replace active roadmap in MongoDB Atlas `roadmaps` collection
      const savedRoadmap = await Roadmap.findOneAndUpdate(
        { user_id: user.user_id },
        {
          ...roadmapData,
          dsa_programming_language: isDSADomain(user.chosen_domain) ? (user.dsa_programming_language || 'Python') : null,
          generation_mode: targetGenMode,
          quiz_score: resolvedQuizScore,
          current_skill_level: user.current_skill_level || 'BEGINNER',
          target_skill_level: user.target_skill_level || 'ADVANCED',
          assessment_status: targetGenMode === 'quiz' ? 'completed' : 'not_attempted',
          topic_proficiencies: roadmapData.topic_proficiencies,
          weak_topics: roadmapData.weak_topics,
          strong_topics: roadmapData.strong_topics,
          updated_at: new Date()
        },
        { upsert: true, new: true }
      );

      // Update user roadmap_status to READY and sync quiz_score if quiz mode
      await User.findOneAndUpdate(
        { user_id: user.user_id },
        {
          roadmap_status: 'READY',
          quiz_score: resolvedQuizScore,
          current_skill_level: user.current_skill_level,
          target_skill_level: user.target_skill_level
        }
      );

      console.log(`✅ Generated, validated, and saved Personalized Roadmap for user ${user_id} (${user.chosen_domain}, Current: ${user.current_skill_level}, Target: ${user.target_skill_level}, ${user.timeline_months} Months, ${user.daily_hours} Hrs/Day)`);

      return sendJSON(res, 200, {
        success: true,
        message: 'Personalized Dynamic Roadmap generated and saved to MongoDB Atlas successfully.',
        roadmap: normalizeRoadmap(savedRoadmap.toObject ? savedRoadmap.toObject() : savedRoadmap)
      });

    } catch (err) {
      console.error('❌ Roadmap generation error:', err);
      return sendJSON(res, 500, {
        error: 'Server roadmap generation error: ' + err.message
      });
    }
  }


  // ==========================================================
  // POST /api/skill-profile/generate
  // ==========================================================
  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/skill-profile/generate'
  ) {
    try {
      const body = await readRequestBody(req);
      const { user_id, domain } = body;
      if (!user_id) {
        return sendJSON(res, 400, { error: 'Missing required parameter: user_id.' });
      }

      const latestQuizEval = await QuizEvaluation.findOne({ user_id }).sort({ createdAt: -1 });
      const existingProfile = await UserSkillProfile.findOne({ user_id });

      const profileData = buildUserSkillProfile({
        userId: user_id,
        domain: domain || (latestQuizEval ? latestQuizEval.domain : 'Full-Stack Web Development'),
        quizEvaluation: latestQuizEval,
        existingProfile
      });

      const savedProfile = await UserSkillProfile.findOneAndUpdate(
        { user_id },
        { ...profileData },
        { upsert: true, new: true }
      );

      return sendJSON(res, 200, { success: true, skillProfile: savedProfile });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Skill profile generation error: ' + err.message });
    }
  }

  // ==========================================================
  // GET /api/skill-profile/:userId
  // ==========================================================
  if (
    req.method === 'GET' &&
    parsedUrl.pathname.startsWith('/api/skill-profile/')
  ) {
    try {
      const targetUserId = parsedUrl.pathname.replace('/api/skill-profile/', '').trim();
      if (!targetUserId) {
        return sendJSON(res, 400, { error: 'userId parameter is required.' });
      }

      let profileDoc = await UserSkillProfile.findOne({ user_id: targetUserId });
      if (!profileDoc) {
        const latestQuizEval = await QuizEvaluation.findOne({ user_id: targetUserId }).sort({ createdAt: -1 });
        const userDoc = await User.findOne({ user_id: targetUserId });
        const domain = (userDoc && userDoc.chosen_domain) || (latestQuizEval ? latestQuizEval.domain : 'fullstack');

        const profileData = buildUserSkillProfile({
          userId: targetUserId,
          domain: domain,
          quizEvaluation: latestQuizEval
        });

        profileDoc = await UserSkillProfile.findOneAndUpdate(
          { user_id: targetUserId },
          { ...profileData },
          { upsert: true, new: true }
        );
      }

      return sendJSON(res, 200, { success: true, skillProfile: profileDoc });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Error fetching skill profile: ' + err.message });
    }
  }

  // ==========================================================
  // POST /api/roadmap/adapt
  // ==========================================================
  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/roadmap/adapt'
  ) {
    try {
      const body = await readRequestBody(req);
      const { user_id, taskCompletion } = body;
      if (!user_id) {
        return sendJSON(res, 400, { error: 'Missing required parameter: user_id.' });
      }

      const user = await User.findOne({ user_id });
      if (!user) {
        return sendJSON(res, 404, { error: `User ${user_id} not found.` });
      }

      const currentRoadmap = await Roadmap.findOne({ user_id });
      if (!currentRoadmap) {
        return sendJSON(res, 404, { error: `No active roadmap for user ${user_id}.` });
      }

      let skillProfile = await UserSkillProfile.findOne({ user_id });
      if (!skillProfile) {
        const latestQuizEval = await QuizEvaluation.findOne({ user_id }).sort({ createdAt: -1 });
        const profileData = buildUserSkillProfile({
          userId: user_id,
          domain: user.chosen_domain,
          quizEvaluation: latestQuizEval
        });
        skillProfile = await UserSkillProfile.findOneAndUpdate(
          { user_id },
          { ...profileData },
          { upsert: true, new: true }
        );
      }

      const updatedRoadmap = await recalculateAdaptiveRoadmap({
        user,
        skillProfile,
        currentRoadmap,
        taskCompletionData: taskCompletion,
        dbModels: { UserSkillProfile, Roadmap }
      });

      return sendJSON(res, 200, {
        success: true,
        message: 'Adaptive roadmap successfully updated.',
        roadmap: updatedRoadmap
      });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Adaptive replanning error: ' + err.message });
    }
  }

  // ==========================================================
  // POST /api/task/complete
  // ==========================================================
  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/task/complete'
  ) {
    try {
      const body = await readRequestBody(req);
      const { user_id, taskId, skillId, isCorrect, scorePct } = body;
      if (!user_id || !taskId) {
        return sendJSON(res, 400, { error: 'Missing required parameters: user_id and taskId.' });
      }

      const user = await User.findOne({ user_id });
      if (!user) {
        return sendJSON(res, 404, { error: `User ${user_id} not found.` });
      }

      const currentRoadmap = await Roadmap.findOne({ user_id });
      if (!currentRoadmap) {
        return sendJSON(res, 404, { error: `No active roadmap for user ${user_id}.` });
      }

      let skillProfile = await UserSkillProfile.findOne({ user_id });
      if (!skillProfile) {
        const latestQuizEval = await QuizEvaluation.findOne({ user_id }).sort({ createdAt: -1 });
        const profileData = buildUserSkillProfile({
          userId: user_id,
          domain: user.chosen_domain,
          quizEvaluation: latestQuizEval
        });
        skillProfile = await UserSkillProfile.findOneAndUpdate(
          { user_id },
          { ...profileData },
          { upsert: true, new: true }
        );
      }

      const taskCompletion = {
        taskId,
        skillId,
        isCorrect: !!isCorrect,
        taskScorePct: scorePct !== undefined ? scorePct : (isCorrect ? 100 : 0)
      };

      const updatedRoadmap = await recalculateAdaptiveRoadmap({
        user,
        skillProfile,
        currentRoadmap,
        taskCompletionData: taskCompletion,
        dbModels: { UserSkillProfile, Roadmap }
      });

      return sendJSON(res, 200, {
        success: true,
        message: 'Task completion logged and adaptive roadmap updated.',
        roadmap: updatedRoadmap
      });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Task completion error: ' + err.message });
    }
  }


  // ==========================================================
  // 11d. START JOURNEY ENDPOINT
  // POST /api/roadmap/start
  // ==========================================================


  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/roadmap/start'
  ) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return sendJSON(res, 503, {
          error: 'MongoDB Atlas is not connected. Please try again.'
        });
      }

      const payload = await readRequestBody(req);
      const { user_id, start_date, start_date_local, timezone } = payload;

      if (!user_id) {
        return sendJSON(res, 400, {
          error: 'Missing required parameter: user_id.'
        });
      }

      const effectiveStartDateStr = start_date_local || (start_date ? new Date(start_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

      let user = await User.findOne({ user_id });
      if (!user) {
        console.log(`[JOURNEY START] Auto-registering missing User profile for ${user_id}...`);
        const existingRoadmap = await Roadmap.findOne({ user_id });
        const userName = existingRoadmap ? (existingRoadmap.user_name || 'koyal') : 'koyal';
        const userDomain = existingRoadmap ? (existingRoadmap.domain_id || existingRoadmap.chosen_domain || 'datascience') : 'datascience';

        user = new User({
          user_id,
          name: userName,
          email: `${user_id}@placify.ai`,
          password_hash: 'guest_hash_' + Date.now(),
          salt: 'guest_salt_' + Date.now(),
          chosen_domain: userDomain,
          journey_started: true,
          journey_start_date: new Date(effectiveStartDateStr),
          timezone: timezone || 'Asia/Kolkata'
        });
        await user.save();
      }

      let startDateObj = user.journey_start_date;
      if (!user.journey_started || !startDateObj) {
        startDateObj = new Date(effectiveStartDateStr);
        user.journey_started = true;
        user.journey_start_date = startDateObj;
        if (timezone) user.timezone = timezone;
        await user.save();
      }

      let roadmapDoc = await Roadmap.findOneAndUpdate(
        { user_id: user.user_id },
        {
          journey_started: true,
          journey_start_date: startDateObj,
          timezone: timezone || user.timezone || 'Asia/Kolkata',
          updated_at: new Date()
        },
        { new: true }
      );

      if (roadmapDoc) {
        roadmapDoc = normalizeRoadmap(roadmapDoc.toObject ? roadmapDoc.toObject() : roadmapDoc);
        attachCalendarDatesToRoadmap(roadmapDoc, effectiveStartDateStr);
      }

      console.log(`🚀 Journey started for user ${user_id} on ${effectiveStartDateStr} (TZ: ${timezone || 'local'})`);

      return sendJSON(res, 200, {
        success: true,
        message: 'Journey started successfully.',
        journey_started: true,
        journey_start_date: startDateObj,
        journey_start_date_local: effectiveStartDateStr,
        roadmap: roadmapDoc
      });

    } catch (err) {
      console.error('❌ Error starting journey:', err);
      return sendJSON(res, 500, {
        error: 'Server error starting journey: ' + err.message
      });
    }
  }

  // ==========================================================
  // POST /api/user/route
  // Save last_route to MongoDB Atlas
  // ==========================================================

  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/user/route'
  ) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return sendJSON(res, 503, { error: 'MongoDB Atlas is not connected.' });
      }

      const payload = await readRequestBody(req);
      const { user_id, last_route } = payload;

      if (!user_id || !last_route) {
        return sendJSON(res, 400, { error: 'user_id and last_route are required.' });
      }

      const updatedUser = await User.findOneAndUpdate(
        { user_id },
        { last_route: last_route.trim() },
        { new: true }
      );

      return sendJSON(res, 200, {
        success: true,
        user_id,
        last_route: updatedUser ? updatedUser.last_route : last_route
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // ==========================================================
  // GET /api/user/:user_id
  // Get authoritative user profile from MongoDB Atlas
  // ==========================================================

  if (
    req.method === 'GET' &&
    parsedUrl.pathname.startsWith('/api/user/') &&
    !parsedUrl.pathname.startsWith('/api/user/route')
  ) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return sendJSON(res, 503, { error: 'MongoDB Atlas is not connected.' });
      }

      const targetUserId = parsedUrl.pathname.replace('/api/user/', '').trim();
      if (!targetUserId) {
        return sendJSON(res, 400, { error: 'User ID is required.' });
      }

      const userDoc = await User.findOne({ user_id: targetUserId });
      if (!userDoc) {
        return sendJSON(res, 404, { error: `User not found for user_id: ${targetUserId}` });
      }

      let isQuizCompleted = userDoc.quiz_completed || false;
      if (!isQuizCompleted) {
        const existingEval = await QuizEvaluation.findOne({ user_id: userDoc.user_id });
        const existingRoadmap = await Roadmap.findOne({ user_id: userDoc.user_id });
        if (existingEval || existingRoadmap) {
          isQuizCompleted = true;
          await User.findOneAndUpdate({ user_id: userDoc.user_id }, { quiz_completed: true });
        }
      }

      return sendJSON(res, 200, {
        success: true,
        profile: {
          user_id: userDoc.user_id,
          name: userDoc.name,
          email: userDoc.email,
          chosen_domain: userDoc.chosen_domain,
          timeline_months: userDoc.timeline_months,
          daily_hours: userDoc.daily_hours,
          current_skill_level: userDoc.current_skill_level,
          quiz_completed: isQuizCompleted,
          last_route: userDoc.last_route || 'roadmap',
          roadmap_status: userDoc.roadmap_status || 'NOT_STARTED',
          createdAt: userDoc.createdAt
        }
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // ==========================================================
  // GET /api/roadmap/user/:user_id
  // ==========================================================

  if (
    req.method === 'GET' &&
    parsedUrl.pathname.startsWith('/api/roadmap/user/')
  ) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return sendJSON(res, 503, {
          error: 'MongoDB Atlas is not connected. Please try again.'
        });
      }

      const targetUserId = parsedUrl.pathname.replace('/api/roadmap/user/', '').trim();
      if (!targetUserId) {
        return sendJSON(res, 400, {
          error: 'User ID is required in URL parameter.'
        });
      }

      let roadmapDoc = await Roadmap.findOne({ user_id: targetUserId });
      if (!roadmapDoc) {
        return sendJSON(res, 404, {
          error: `No active roadmap found for user_id: ${targetUserId}`
        });
      }

      // Stale roadmap invalidation check: If generated with an older engine version, automatically upgrade to v5.0_dynamic_personalized_planner
      if (roadmapDoc.curriculum_version !== 'v5.0_dynamic_personalized_planner') {
        console.log(`[STALE ROADMAP DETECTED] Upgrading stale roadmap to v5.0_dynamic_personalized_planner for user: ${targetUserId}`);
        const userDoc = await User.findOne({ user_id: targetUserId });
        if (userDoc) {
          const isDirectMode = roadmapDoc.generation_mode === 'direct';
          const latestQuizEval = isDirectMode ? null : await QuizEvaluation.findOne({ user_id: targetUserId, is_self_assessed: { $ne: true } }).sort({ createdAt: -1 });
          let skillProfileDoc = null;
          if (isDirectMode) {
            skillProfileDoc = buildUserSkillProfile({
              userId: targetUserId,
              domain: userDoc.chosen_domain,
              quizEvaluation: null,
              currentSkillLevel: userDoc.current_skill_level,
              targetSkillLevel: userDoc.target_skill_level
            });
          } else {
            skillProfileDoc = await UserSkillProfile.findOne({ user_id: targetUserId });
            if (!skillProfileDoc) {
              const profileData = buildUserSkillProfile({
                userId: targetUserId,
                domain: userDoc.chosen_domain,
                quizEvaluation: latestQuizEval,
                currentSkillLevel: userDoc.current_skill_level,
                targetSkillLevel: userDoc.target_skill_level
              });
              skillProfileDoc = await UserSkillProfile.findOneAndUpdate(
                { user_id: targetUserId },
                { ...profileData },
                { upsert: true, new: true }
              );
            }
          }

          const newRoadmapData = generateIntelligentRoadmap({
            userId: userDoc.user_id,
            domain: userDoc.chosen_domain,
            timeline_months: userDoc.timeline_months,
            daily_hours: userDoc.daily_hours,
            skillProfile: skillProfileDoc,
            currentSkillLevel: userDoc.current_skill_level || 'BEGINNER',
            targetSkillLevel: userDoc.target_skill_level || 'ADVANCED',
            quizEvaluation: isDirectMode ? null : latestQuizEval
          });
          newRoadmapData.generation_mode = roadmapDoc.generation_mode || (isDirectMode ? 'direct' : 'quiz');
          newRoadmapData.quiz_score = isDirectMode ? null : (roadmapDoc.quiz_score !== undefined ? roadmapDoc.quiz_score : (latestQuizEval ? latestQuizEval.score_pct : null));
          newRoadmapData.current_skill_level = userDoc.current_skill_level || 'BEGINNER';
          newRoadmapData.target_skill_level = userDoc.target_skill_level || 'ADVANCED';
          newRoadmapData.assessment_status = isDirectMode ? 'not_attempted' : 'completed';

          roadmapDoc = await Roadmap.findOneAndUpdate(
            { user_id: targetUserId },
            { ...newRoadmapData, updated_at: new Date() },
            { upsert: true, new: true }
          );
        }
      }

      // Score Recovery: Restrict to quiz-mode roadmaps; direct-mode roadmaps must have quiz_score = null
      if (roadmapDoc && roadmapDoc.generation_mode === 'quiz' && (roadmapDoc.quiz_score === null || roadmapDoc.quiz_score === undefined)) {
        const latestEval = await QuizEvaluation.findOne({ user_id: targetUserId, is_self_assessed: { $ne: true } }).sort({ createdAt: -1 });
        if (latestEval && latestEval.score_pct !== undefined && latestEval.score_pct !== null) {
          roadmapDoc = await Roadmap.findOneAndUpdate(
            { user_id: targetUserId },
            { quiz_score: latestEval.score_pct },
            { new: true }
          );
        }
      } else if (roadmapDoc && roadmapDoc.generation_mode === 'direct') {
        roadmapDoc.quiz_score = null;
      }

      const normalizedRoadmapDoc = normalizeRoadmap(roadmapDoc.toObject ? roadmapDoc.toObject() : roadmapDoc);
      return sendJSON(res, 200, {
        success: true,
        roadmap: normalizedRoadmapDoc
      });

    } catch (err) {
      console.error('❌ Fetch roadmap error:', err);
      return sendJSON(res, 500, {
        error: 'Server error fetching roadmap: ' + err.message
      });
    }
  }

  // ==========================================================
  // 11e. RESOURCE RECOMMENDATION ENDPOINTS
  // POST /api/resources/recommend
  // GET /api/resources/task/:task_id
  // ==========================================================

  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/resources/recommend'
  ) {
    try {
      const payload = await readRequestBody(req);
      const { taskId, taskTitle, taskType, taskDifficulty, taskDuration, dailyTopic, subtopic, domain, userLevel, user_id } = payload;

      if (!taskTitle || !domain) {
        return sendJSON(res, 400, { error: 'Missing required parameters: taskTitle and domain.' });
      }

      const resources = await recommendResourcesForTask({
        taskId,
        taskTitle,
        taskType,
        taskDifficulty,
        taskDuration,
        dailyTopic,
        subtopic,
        domain,
        userLevel
      });

      // Update daily task resources in stored Roadmap if user_id and taskId exist
      if (user_id && taskId && mongoose.connection.readyState === 1) {
        try {
          const roadmapDoc = await Roadmap.findOne({ user_id });
          if (roadmapDoc && roadmapDoc.monthly_roadmap) {
            let updated = false;
            roadmapDoc.monthly_roadmap.forEach(m => {
              (m.weeks || []).forEach(w => {
                (w.days || []).forEach(d => {
                  (d.tasks || []).forEach(t => {
                    if (t.id === taskId) {
                      t.recommended_resources = resources;
                      updated = true;
                    }
                  });
                });
              });
            });
            if (updated) {
              await roadmapDoc.save();
            }
          }
        } catch (err) {
          console.warn('Roadmap task resource update warning:', err.message);
        }
      }

      return sendJSON(res, 200, {
        success: true,
        resources
      });
    } catch (err) {
      console.error('❌ Resource recommendation error:', err);
      // Independent failure isolation: Return fallback notice without breaking roadmap
      return sendJSON(res, 200, {
        success: false,
        message: 'Recommended resources are temporarily unavailable.',
        resources: []
      });
    }
  }

  if (
    req.method === 'GET' &&
    parsedUrl.pathname.startsWith('/api/resources/task/')
  ) {
    try {
      const taskId = parsedUrl.pathname.replace('/api/resources/task/', '').trim();
      if (!taskId) {
        return sendJSON(res, 400, { error: 'Task ID parameter is required.' });
      }

      console.log("RESOURCE CACHE LOOKUP:", { cacheKey: taskId, taskId });

      if (mongoose.connection.readyState === 1) {
        const cachedResources = await Resource.find({
          resource_id: { $regex: taskId }
        }).limit(3);

        if (cachedResources && cachedResources.length > 0) {
          return sendJSON(res, 200, {
            success: true,
            resources: cachedResources
          });
        }
      }

      return sendJSON(res, 200, {
        success: true,
        resources: []
      });
    } catch (err) {
      console.error('❌ Fetch task resources error:', err);
      return sendJSON(res, 200, {
        success: false,
        message: 'Recommended resources are temporarily unavailable.',
        resources: []
      });
    }
  }

  // ==========================================================
  // HELPER: USER CONTEXT RESOLVER FOR NEWS & INTERNSHIPS
  // ==========================================================
  async function resolveUserContext(userId, queryDomain, queryLocation) {
    let resolvedDomain = null;
    let resolvedLocation = null;
    let userSkills = [];

    // Priority 1 & 2: Check Authenticated User Document in DB
    if (userId && userId !== 'guest' && userId !== 'anonymous') {
      try {
        const userDoc = await User.findOne({ user_id: userId }).lean();
        if (userDoc) {
          if (userDoc.chosen_domain) {
            resolvedDomain = userDoc.chosen_domain;
          }
          if (userDoc.location) {
            resolvedLocation = userDoc.location;
          }
        }

        // Priority 3: Check User's Roadmap Document in DB
        const roadmapDoc = await Roadmap.findOne({ user_id: userId }).lean();
        if (roadmapDoc) {
          if (!resolvedDomain && roadmapDoc.chosen_domain) {
            resolvedDomain = roadmapDoc.chosen_domain;
          }
          if (Array.isArray(roadmapDoc.monthly_roadmap)) {
            roadmapDoc.monthly_roadmap.forEach(m => {
              (m.weeks || []).forEach(w => {
                (w.topics || []).forEach(t => userSkills.push({ name: t }));
              });
            });
          }
        }
      } catch (e) {
        console.warn('Could not resolve user context from DB:', e.message);
      }
    }

    // Priority 4: Current Session / Frontend Query Domain
    if (!resolvedDomain && queryDomain) {
      resolvedDomain = queryDomain;
    }
    if (!resolvedLocation && queryLocation) {
      resolvedLocation = queryLocation;
    }

    // Priority 5: Generic Technology Fallback
    if (!resolvedDomain) resolvedDomain = 'datascience';
    if (!resolvedLocation) resolvedLocation = 'India';

    return {
      domain: resolvedDomain,
      location: resolvedLocation,
      userSkills
    };
  }

  // ==========================================================
  // 11f. REAL-WORLD TECH NEWS ENDPOINT
  // GET /api/tech-news
  // ==========================================================
  if (req.method === 'GET' && parsedUrl.pathname === '/api/tech-news') {
    try {
      const requestedFilter = parsedUrl.query.domain || parsedUrl.query.filter || parsedUrl.query.category || 'all';
      const q = parsedUrl.query.q || '';
      const sort = parsedUrl.query.sort || 'latest';
      const page = parseInt(parsedUrl.query.page, 10) || 1;

      const newsData = await fetchPersonalizedTechNews({
        domain: requestedFilter,
        searchQuery: q,
        sort,
        page
      });

      return sendJSON(res, 200, newsData);
    } catch (err) {
      console.error('[TECH NEWS ERROR]:', err.message);
      return sendJSON(res, 500, {
        success: false,
        error: 'Tech News is temporarily unavailable.',
        details: err.message
      });
    }
  }

  // ==========================================================
  // 11g. REAL-WORLD INTERNSHIPS ENDPOINT
  // GET /api/internships
  // ==========================================================
  if (req.method === 'GET' && parsedUrl.pathname === '/api/internships') {
    try {
      const userId = parsedUrl.query.userId || parsedUrl.query.user_id || 'guest';
      const q = parsedUrl.query.q || '';
      const filter = parsedUrl.query.filter || 'All';
      const page = parseInt(parsedUrl.query.page, 10) || 1;

      const userCtx = await resolveUserContext(userId, parsedUrl.query.domain, parsedUrl.query.location);

      const internshipData = await fetchPersonalizedInternships({
        domain: userCtx.domain,
        userLocation: userCtx.location,
        userSkills: userCtx.userSkills,
        searchQuery: q,
        filter,
        page
      });

      return sendJSON(res, 200, internshipData);
    } catch (err) {
      console.error('[INTERNSHIPS ERROR]:', err.message);
      return sendJSON(res, 500, {
        success: false,
        error: 'Internship listings are temporarily unavailable.',
        details: err.message
      });
    }
  }

  // ==========================================================
  // 11f. GROUNDED ASSESSMENT ENDPOINTS & LEVEL-UP ELIGIBILITY
  // POST /api/resources/fetch-assessment
  // POST /api/resources/grade-assessment
  // ==========================================================

  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/resources/fetch-assessment'
  ) {
    try {
      const payload = await readRequestBody(req);
      const { topic, subtopic, skill_level, domain, resource_url } = payload;
      const cleanLevel = (skill_level || 'BEGINNER').toUpperCase();
      const cleanTopic = topic || 'Core Topic';
      const cleanSubtopic = subtopic || cleanTopic;
      const cleanDomain = domain || 'datascience';

      const groundedSummary = `Grounded Learning Notes for ${cleanTopic} (${cleanLevel} Tier):\n1. Core Concepts: Explains fundamental mechanics and memory layout.\n2. Practical Patterns: Real-world implementation code.\n3. Edge Cases: Boundary behaviors and exception handling.`;

      let questions = [];
      try {
        const rawGroqQuestions = await generateGroqQuestionsAsync({
          domainName: cleanDomain,
          domainId: canonicalizeDomainKey(cleanDomain),
          level: cleanLevel,
          topics: [cleanTopic, cleanSubtopic],
          questionCount: 3,
          quizAttemptId: `grounded_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          randomSeed: crypto.randomBytes(4).toString('hex')
        });

        const taxonomies = [
          'Q1: Core Conceptual Understanding',
          'Q2: Practical Code / Pattern Application',
          'Q3: Output Prediction / Edge Case Handling'
        ];

        questions = rawGroqQuestions.map((q, idx) => {
          let correctIdx = 0;
          if (typeof q.correct === 'number' && q.correct >= 0 && q.correct < (q.options || []).length) {
            correctIdx = q.correct;
          } else if (typeof q.correct_answer === 'string' && Array.isArray(q.options)) {
            const foundIdx = q.options.findIndex(opt => String(opt).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase());
            if (foundIdx !== -1) correctIdx = foundIdx;
          }
          return {
            id: q.id || `q${idx + 1}_grounded`,
            taxonomy: taxonomies[idx] || `Q${idx + 1}: Diagnostic Evaluation`,
            question: q.question,
            options: Array.isArray(q.options) && q.options.length >= 4 ? q.options : ['A) Standard implementation', 'B) Deprecated pattern', 'C) Low-level kernel command', 'D) Invalid syntax'],
            correct_option_index: correctIdx,
            explanation: q.explanation || 'Curated grounded resource explanation.'
          };
        });
      } catch (genErr) {
        console.warn('⚠️ Dynamic Groq fetch-assessment notice:', genErr.message);
        return sendJSON(res, 502, {
          error: 'Failed to generate dynamic grounded assessment questions using Groq API.',
          message: genErr.message
        });
      }

      return sendJSON(res, 200, {
        success: true,
        topic: cleanTopic,
        subtopic: cleanSubtopic,
        skill_level: cleanLevel,
        domain: cleanDomain,
        resource_url: resource_url || 'https://docs.python.org/3/tutorial/',
        grounded_summary: groundedSummary,
        questions_count: questions.length,
        questions
      });
    } catch (err) {
      console.error('❌ Fetch assessment error:', err);
      return sendJSON(res, 500, { error: err.message });
    }
  }

  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/resources/grade-assessment'
  ) {
    try {
      const payload = await readRequestBody(req);
      const { topic, skill_level, questions, user_answers } = payload;
      const cleanLevel = (skill_level || 'BEGINNER').toUpperCase();

      if (!questions || !Array.isArray(questions) || !user_answers) {
        return sendJSON(res, 400, { error: 'Missing required parameters: questions array and user_answers object.' });
      }

      let correctCount = 0;
      const total = questions.length;
      const detailedFeedback = [];

      questions.forEach(q => {
        const userChoice = user_answers[q.id];
        const isCorrect = (userChoice === q.correct_option_index);
        if (isCorrect) correctCount++;

        detailedFeedback.append ? detailedFeedback.push({
          question_id: q.id,
          taxonomy: q.taxonomy || 'Question',
          question: q.question,
          user_choice_index: userChoice,
          correct_option_index: q.correct_option_index,
          is_correct: isCorrect,
          explanation: q.explanation
        }) : null;
      });

      const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      const passed = scorePct >= 70;

      let levelUpEligible = false;
      let levelUpPrompt = null;
      let levelUpOptions = null;

      if (cleanLevel === 'BEGINNER' && scorePct >= 85) {
        levelUpEligible = true;
        levelUpPrompt = "🎉 Outstanding Performance! You achieved >= 85% on this Beginner Concept Assessment. You are eligible to LEVEL UP! How would you like to proceed?";
        levelUpOptions = [
          {
            option_id: 'OPTION_A',
            label: 'Option A: Level up same concept to Intermediate depth',
            action: 'LEVEL_UP_CONCEPT_INTERMEDIATE',
            description: 'Unlock deeper official developer documentation, GitHub sample code, and intermediate implementation drills for this concept.'
          },
          {
            option_id: 'OPTION_B',
            label: 'Option B: Move to next concept at Beginner level',
            action: 'CONTINUE_BEGINNER_TRACK',
            description: 'Proceed to the next foundational topic on your personalized roadmap at the gentle Beginner level.'
          }
        ];
      }

      return sendJSON(res, 200, {
        success: true,
        topic: topic || 'Concept',
        score_pct: scorePct,
        correct_count: correctCount,
        total_questions: total,
        passed,
        user_level: cleanLevel,
        level_up_eligible: levelUpEligible,
        level_up_prompt: levelUpPrompt,
        level_up_options: levelUpOptions,
        detailed_feedback: detailedFeedback
      });
    } catch (err) {
      console.error('❌ Grade assessment error:', err);
      return sendJSON(res, 500, { error: err.message });
    }
  }


  // ==========================================================
  // 11g. DAILY ADAPTIVE ASSESSMENT ENDPOINTS (TAKE QUIZ / MANUAL COMPLETION & SUNDAY REVISION)
  // ==========================================================

  // POST /api/roadmap/daily-assessment/generate
  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/roadmap/daily-assessment/generate'
  ) {
    try {
      const body = await readRequestBody(req);
      const {
        userId,
        roadmapId,
        monthNumber,
        weekNumber,
        dayNumber,
        topic,
        subtopics,
        domain,
        level,
        questionCount: reqCount
      } = body;

      const cleanDomain = domain || 'fullstack';
      const canonicalDomain = canonicalizeDomainKey(cleanDomain);
      const cleanLevel = (level || 'BEGINNER').toUpperCase();
      const cleanTopic = topic || 'Core Learning Topic';
      const topicList = Array.isArray(subtopics) && subtopics.length > 0 ? subtopics : [cleanTopic];
      const count = Math.min(20, Math.max(3, parseInt(reqCount, 10) || 10));

      const dailyAssessmentId = `daily_quiz_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const randomSeed = crypto.randomBytes(4).toString('hex');

      console.log(`[DAILY QUIZ GEN] Generating dynamic quiz for Day ${dayNumber} (${cleanTopic})`);

      const authoritativeQuestions = await generateGroqQuestionsAsync({
        domainName: cleanDomain,
        domainId: canonicalDomain,
        level: cleanLevel,
        topics: topicList,
        questionCount: count,
        quizAttemptId: dailyAssessmentId,
        userHistoryTexts: [],
        randomSeed
      });

      const quizPayload = {
        assessmentId: dailyAssessmentId,
        dailyAssessmentId,
        userId: userId || 'guest',
        roadmapId: roadmapId || null,
        monthNumber: parseInt(monthNumber, 10) || 1,
        weekNumber: parseInt(weekNumber, 10) || 1,
        dayNumber: parseInt(dayNumber, 10) || 1,
        domain: cleanDomain,
        topic: cleanTopic,
        level: cleanLevel,
        questionCount: authoritativeQuestions.length,
        questions: authoritativeQuestions,
        createdAt: new Date().toISOString()
      };

      if (!global.activeQuizStore) global.activeQuizStore = new Map();
      global.activeQuizStore.set(dailyAssessmentId, quizPayload);

      const clientQuestions = authoritativeQuestions.map((q, idx) => ({
        id: q.id || `q_${idx + 1}_${dailyAssessmentId}`,
        type: q.type || 'single_select',
        topic: q.topic || cleanTopic,
        subtopic: q.subtopic || cleanTopic,
        difficulty: q.difficulty || cleanLevel,
        question: q.question,
        codeSnippet: q.codeSnippet || null,
        options: q.options || [],
        explanation: q.explanation || null
      }));

      return sendJSON(res, 200, {
        success: true,
        assessmentId: dailyAssessmentId,
        topic: cleanTopic,
        level: cleanLevel,
        questionCount: clientQuestions.length,
        questions: clientQuestions
      });
    } catch (err) {
      console.error('❌ Daily quiz generation error:', err);
      return sendJSON(res, 500, { error: 'Failed to generate dynamic daily quiz: ' + err.message });
    }
  }

function calculateNextIncompleteDay(roadmapDoc) {
  if (!roadmapDoc || !Array.isArray(roadmapDoc.monthly_roadmap)) {
    return 1;
  }
  for (const month of roadmapDoc.monthly_roadmap) {
    if (Array.isArray(month.weeks)) {
      for (const week of month.weeks) {
        if (Array.isArray(week.days)) {
          for (const day of week.days) {
            const isDone = day.completed || day.completedManually ||
              (day.assessment && (
                day.assessment.completionStatus === 'completed' ||
                day.assessment.assessmentStatus === 'completed' ||
                day.assessment.status === 'completed' ||
                day.assessment.completedManually
              ));
            if (!isDone) {
              return parseInt(day.day_number, 10);
            }
          }
        }
      }
    }
  }
  return 1;
}

  // POST /api/roadmap/daily-assessment/submit
  if (
    req.method === 'POST' &&
    parsedUrl.pathname === '/api/roadmap/daily-assessment/submit'
  ) {
    try {
      const body = await readRequestBody(req);
      const {
        userId,
        roadmapId,
        monthNumber,
        weekNumber,
        dayNumber,
        assessmentMode,
        userAnswers,
        questions,
        assessmentId,
        completedManually
      } = body;

      const targetUserId = userId || 'guest';
      const mNum = parseInt(monthNumber, 10) || 1;
      const wNum = parseInt(weekNumber, 10) || 1;
      const dNum = parseInt(dayNumber, 10) || 1;

      let roadmapDoc = null;
      if (mongoose.connection.readyState === 1) {
        if (roadmapId) {
          try {
            roadmapDoc = await Roadmap.findById(roadmapId);
          } catch (e) {}
        }
        if (!roadmapDoc && targetUserId) {
          roadmapDoc = await Roadmap.findOne({ user_id: targetUserId }).sort({ generated_at: -1 });
        }
      }

      // IDEMPOTENCY CHECK: DO NOT COMPLETE SAME DAY TWICE
      if (roadmapDoc && Array.isArray(roadmapDoc.monthly_roadmap)) {
        const monthObj = roadmapDoc.monthly_roadmap.find(m => parseInt(m.month_number, 10) === mNum);
        if (monthObj && Array.isArray(monthObj.weeks)) {
          const weekObj = monthObj.weeks.find(w => parseInt(w.week_number, 10) === wNum);
          if (weekObj && Array.isArray(weekObj.days)) {
            const dayObj = weekObj.days.find(d => parseInt(d.day_number, 10) === dNum);
            if (dayObj) {
              const isAlreadyDone = dayObj.completed || dayObj.completedManually ||
                (dayObj.assessment && (
                  dayObj.assessment.completionStatus === 'completed' ||
                  dayObj.assessment.assessmentStatus === 'completed' ||
                  dayObj.assessment.status === 'completed' ||
                  dayObj.assessment.completedManually
                ));

              if (isAlreadyDone) {
                const nextIncompleteDay = calculateNextIncompleteDay(roadmapDoc);
                return sendJSON(res, 200, {
                  success: true,
                  alreadyCompleted: true,
                  dayCompleted: true,
                  monthNumber: mNum,
                  weekNumber: wNum,
                  dayNumber: dNum,
                  completionMode: dayObj.assessment ? (dayObj.assessment.assessmentMode || 'manual') : (completedManually ? 'manual' : 'quiz'),
                  dayAssessment: dayObj.assessment,
                  sundayRevision: weekObj.sunday_revision || calculateSundayRevisionForWeek(weekObj),
                  nextIncompleteDay
                });
              }
            }
          }
        }
      }

      const completedDateLocal = body.completedDateLocal || body.clientLocalDate || new Date().toISOString().slice(0, 10);
      const completedTimezone = body.completedTimezone || body.clientTimezone || 'Asia/Kolkata';

      let updatedDayAssessment = null;
      let updatedSundayRevision = null;

      if (assessmentMode === 'manual' || completedManually) {
        // OPTION 2: MANUAL COMPLETION
        // MUST NOT create diagnosticScore, quizScore, topicProficiency, weakTopics, or failedTopics.
        // MUST NOT trigger Sunday revision.
        updatedDayAssessment = {
          assessmentId: null,
          assessmentMode: 'manual',
          completionStatus: 'completed',
          quizTaken: false,
          completedManually: true,
          score: null,
          needsRevision: false,
          topicResults: [],
          weakTopics: [],
          completedDateLocal,
          completedTimezone,
          completedAt: new Date().toISOString()
        };
      } else {
        // OPTION 1: TAKE QUIZ EVALUATION
        let storedQuiz = assessmentId && global.activeQuizStore ? global.activeQuizStore.get(assessmentId) : null;
        let authoritativeQuestions = storedQuiz ? storedQuiz.questions : (questions || []);

        let correctCount = 0;
        const total = authoritativeQuestions.length;
        const topicScoresMap = new Map();

        authoritativeQuestions.forEach(q => {
          const userChoice = userAnswers ? userAnswers[q.id] : undefined;
          let isCorrect = false;

          if (q.type === 'multiple_select' && Array.isArray(q.correct)) {
            const arrChoice = Array.isArray(userChoice) ? userChoice : [userChoice];
            isCorrect = arrChoice.length === q.correct.length && arrChoice.every(v => q.correct.includes(v));
          } else if (q.type === 'fill_blank' || q.type === 'short_answer' || typeof userChoice === 'string') {
            const userStr = String(userChoice || '').trim().toLowerCase();
            if (Array.isArray(q.accepted_answers) && q.accepted_answers.length > 0) {
              isCorrect = q.accepted_answers.some(ans => String(ans).trim().toLowerCase() === userStr);
            } else if (q.correct_answer !== undefined && q.correct_answer !== null) {
              isCorrect = (userStr === String(q.correct_answer).trim().toLowerCase());
            } else if (typeof q.correct === 'string') {
              isCorrect = (userStr === q.correct.trim().toLowerCase());
            }
          } else {
            const expectedIdx = q.correct !== undefined ? q.correct : q.correct_option_index;
            if (expectedIdx !== undefined && expectedIdx !== null) {
              isCorrect = (parseInt(userChoice, 10) === parseInt(expectedIdx, 10));
            } else if (q.correct_answer !== undefined) {
              isCorrect = (String(userChoice).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase());
            }
          }

          if (isCorrect) correctCount++;

          const tName = q.topic || 'Core Concept';
          if (!topicScoresMap.has(tName)) {
            topicScoresMap.set(tName, { total: 0, correct: 0 });
          }
          const tData = topicScoresMap.get(tName);
          tData.total += 1;
          if (isCorrect) tData.correct += 1;
        });

        const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
        const needsRevisionOverall = scorePct < DAILY_REVISION_THRESHOLD;

        const topicResults = [];
        const weakTopics = [];

        topicScoresMap.forEach((val, topName) => {
          const topPct = Math.round((val.correct / val.total) * 100);
          const topNeedsRev = topPct < DAILY_REVISION_THRESHOLD;
          if (topNeedsRev) weakTopics.push(topName);
          topicResults.push({
            topic: topName,
            score: topPct,
            correctCount: val.correct,
            totalQuestions: val.total,
            needsRevision: topNeedsRev
          });
        });

        if (weakTopics.length === 0 && needsRevisionOverall) {
          weakTopics.push(body.topic || 'Core Concept');
        }

        updatedDayAssessment = {
          assessmentId: assessmentId || `daily_quiz_${Date.now()}`,
          assessmentMode: 'quiz',
          assessmentStatus: 'completed',
          status: 'completed',
          score: scorePct,
          totalQuestions: total,
          correctAnswers: correctCount,
          needsRevision: (needsRevisionOverall || weakTopics.length > 0),
          topicResults,
          weakTopics,
          completedDateLocal,
          completedTimezone,
          completedAt: new Date().toISOString()
        };
      }

      // Persist to MongoDB Roadmap Document if present
      if (roadmapDoc && Array.isArray(roadmapDoc.monthly_roadmap)) {
        const monthObj = roadmapDoc.monthly_roadmap.find(m => parseInt(m.month_number, 10) === mNum);
        if (monthObj && Array.isArray(monthObj.weeks)) {
          const weekObj = monthObj.weeks.find(w => parseInt(w.week_number, 10) === wNum);
          if (weekObj && Array.isArray(weekObj.days)) {
            const dayObj = weekObj.days.find(d => parseInt(d.day_number, 10) === dNum);
            if (dayObj) {
              dayObj.assessment = updatedDayAssessment;
              dayObj.completed = true;
              dayObj.completedDateLocal = completedDateLocal;
              dayObj.completedTimezone = completedTimezone;
            }

            // Recalculate Sunday revision for the week dynamically
            updatedSundayRevision = calculateSundayRevisionForWeek(weekObj);
            weekObj.sunday_revision = updatedSundayRevision;
          }
        }
        roadmapDoc.markModified('monthly_roadmap');
        await roadmapDoc.save();
      }

      const nextIncompleteDay = calculateNextIncompleteDay(roadmapDoc);
      const dynamicProgress = calculateRoadmapProgress(roadmapDoc, completedDateLocal, completedTimezone);

      return sendJSON(res, 200, {
        success: true,
        dayCompleted: true,
        todayCompleted: true,
        monthNumber: mNum,
        weekNumber: wNum,
        dayNumber: dNum,
        completedDateLocal,
        completedTimezone,
        completionMode: (assessmentMode === 'manual' || completedManually) ? 'manual' : 'quiz',
        dayAssessment: updatedDayAssessment,
        sundayRevision: updatedSundayRevision,
        nextIncompleteDay,
        progress: dynamicProgress
      });
    } catch (err) {
      console.error('❌ Daily assessment submission error:', err);
      return sendJSON(res, 500, { error: 'Failed to submit daily assessment: ' + err.message });
    }
  }

  // GET /api/roadmap/sunday-revision
  if (
    req.method === 'GET' &&
    parsedUrl.pathname.startsWith('/api/roadmap/sunday-revision')
  ) {
    try {
      const parts = parsedUrl.pathname.replace('/api/roadmap/sunday-revision', '').split('/').filter(Boolean);
      const userId = parts[0] || parsedUrl.query?.userId || 'guest';
      const weekNumber = parseInt(parts[2] || parts[1] || parsedUrl.query?.weekNumber || 1, 10);

      let roadmapDoc = null;
      if (mongoose.connection.readyState === 1 && userId) {
        roadmapDoc = await Roadmap.findOne({ user_id: userId }).sort({ generated_at: -1 });
      }

      let sundayRevision = null;
      if (roadmapDoc && Array.isArray(roadmapDoc.monthly_roadmap)) {
        for (const month of roadmapDoc.monthly_roadmap) {
          if (Array.isArray(month.weeks)) {
            const weekObj = month.weeks.find(w => parseInt(w.week_number, 10) === weekNumber);
            if (weekObj) {
              sundayRevision = calculateSundayRevisionForWeek(weekObj);
              break;
            }
          }
        }
      }

      if (!sundayRevision) {
        sundayRevision = {
          day: "Sunday",
          weekNumber,
          topics: [],
          hasQuizRevisions: false,
          message: "No quiz-based revision items this week."
        };
      }

      return sendJSON(res, 200, {
        success: true,
        weekNumber,
        sundayRevision
      });
    } catch (err) {
      console.error('❌ Sunday revision fetch error:', err);
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // GET /api/roadmap/progress
  if (
    req.method === 'GET' &&
    parsedUrl.pathname.startsWith('/api/roadmap/progress')
  ) {
    try {
      const parts = parsedUrl.pathname.replace('/api/roadmap/progress', '').split('/').filter(Boolean);
      const userId = parts[0] || parsedUrl.query?.userId || 'guest';
      const roadmapId = parts[1] || parsedUrl.query?.roadmapId || null;
      const clientLocalDate = parsedUrl.query?.clientLocalDate || parsedUrl.query?.date || new Date().toISOString().slice(0, 10);
      const clientTimezone = parsedUrl.query?.clientTimezone || parsedUrl.query?.timezone || 'Asia/Kolkata';

      let roadmapDoc = null;
      if (mongoose.connection.readyState === 1) {
        if (roadmapId) {
          try {
            roadmapDoc = await Roadmap.findById(roadmapId);
          } catch (e) {}
        }
        if (!roadmapDoc && userId) {
          roadmapDoc = await Roadmap.findOne({ user_id: userId }).sort({ generated_at: -1 });
        }
      }

      const progress = calculateRoadmapProgress(roadmapDoc, clientLocalDate, clientTimezone);

      return sendJSON(res, 200, {
        success: true,
        userId,
        roadmapId: roadmapDoc ? roadmapDoc._id : roadmapId,
        progress
      });
    } catch (err) {
      console.error('❌ Roadmap progress fetch error:', err);
      return sendJSON(res, 500, { error: 'Failed to fetch roadmap progress: ' + err.message });
    }
  }


  // ==========================================================
  // 12. STATIC FILE SERVER
  // ==========================================================

  let requestedPath =
    parsedUrl.pathname === '/'
      ? 'index.html'
      : parsedUrl.pathname;


  // Resolve requestedPath against frontend directory
  let filePath = path.join(__dirname, '../../frontend/public', requestedPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, '../../frontend/src', requestedPath);
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, '../../frontend', requestedPath);
  }


  const ext =
    path.extname(filePath);


  const mimeTypes = {

    '.html':
      'text/html',

    '.js':
      'application/javascript',

    '.css':
      'text/css',

    '.json':
      'application/json',

    '.png':
      'image/png',

    '.jpg':
      'image/jpeg',

    '.jpeg':
      'image/jpeg',

    '.svg':
      'image/svg+xml',

    '.ico':
      'image/x-icon'

  };


  fs.readFile(
    filePath,
    (err, content) => {

      if (err) {

        if (err.code === 'ENOENT') {

          res.writeHead(404, {
            'Content-Type':
              'text/plain'
          });

          res.end(
            '404 Not Found'
          );

        } else {

          console.error(
            'Static file error:',
            err
          );

          res.writeHead(500);

          res.end(
            `Server Error: ${err.code}`
          );

        }

        return;

      }


      res.writeHead(200, {

        'Content-Type':
          mimeTypes[ext] ||
          'text/plain'

      });


      res.end(content);

    }
  );

});


// ============================================================
// 13. CONNECT TO MONGODB FIRST
// ============================================================

async function startServer() {

  try {

    console.log('');
    console.log('==========================================');
    console.log('        PLACIFY BACKEND STARTING');
    console.log('==========================================');

    console.log(
      '🔌 Connecting to MongoDB Atlas...'
    );


    // --------------------------------------------------------
    // Connect to MongoDB
    // --------------------------------------------------------

    await mongoose.connect(
      MONGODB_URI
    );


    console.log(
      '✅ MongoDB Atlas connected successfully!'
    );

    console.log(
      `📦 Database: ${mongoose.connection.name}`
    );

    console.log(
      '📁 Collection: Registration'
    );


    // --------------------------------------------------------
    // Make sure admin exists
    // --------------------------------------------------------

    const adminEmail =
      'admin@placify.ai';


    const existingAdmin =
      await User.findOne({
        email: adminEmail
      });


    if (!existingAdmin) {

      await User.create({

        user_id:
          'usr_system_init',

        name:
          'Placify System Administrator',

        email:
          adminEmail,

        password_hash:
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',

        salt:
          '00000000000000000000000000000000',

        chosen_domain:
          'fullstack',

        timeline_months:
          4,

        daily_hours:
          2.0,

        current_skill_level:
          'ADMIN'

      });


      console.log(
        '👤 Initial Placify administrator created.'
      );

    } else {

      console.log(
        '✅ Placify administrator already exists.'
      );

    }


    // --------------------------------------------------------
    // Handle Server Errors (e.g. Port in use)
    // --------------------------------------------------------

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('');
        console.error('==========================================');
        console.error(`❌ Error: Port ${PORT} is already in use by another running server instance.`);
        console.error(`💡 Solution: Close the active server or run this command in PowerShell to free port ${PORT}:`);
        console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`);
        console.error('==========================================');
        console.error('');
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
      }
    });


    // --------------------------------------------------------
    // Start HTTP server ONLY AFTER MongoDB connection
    // --------------------------------------------------------

    server.listen(
      PORT,
      () => {

        console.log('');
        console.log(
          '=========================================='
        );

        console.log(
          `🚀 Placify Server running at http://localhost:${PORT}`
        );

        console.log(
          `🔗 Health Check: http://localhost:${PORT}/api/health`
        );

        console.log(
          '💾 Database: MongoDB Atlas'
        );

        console.log(
          '📁 Collection: Registration'
        );

        console.log(
          '=========================================='
        );

        console.log('');

      }
    );

  } catch (err) {

    console.error('');
    console.error(
      '❌ MongoDB Atlas connection failed!'
    );

    console.error(
      'Error:',
      err.message
    );

    console.error('');

    console.error(
      'Check the following:'
    );

    console.error(
      '1. Your .env file exists'
    );

    console.error(
      '2. MONGODB_URI is correct'
    );

    console.error(
      '3. MongoDB Atlas Network Access allows your IP'
    );

    console.error(
      '4. Your MongoDB username/password are correct'
    );

    console.error('');

    process.exit(1);

  }

}


// ============================================================
// 14. START APPLICATION
// ============================================================

startServer();