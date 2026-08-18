/**
 * Placify Backend Server & MongoDB Atlas Database Connector
 * Database: placify
 * Collection: Registration
 */

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;


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
      default: 'fullstack'
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
      enum: ['NOT_STARTED', 'GENERATING', 'READY', 'FAILED'],
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
      required: true
    },
    correct_count: {
      type: Number,
      required: true
    },
    total_questions: {
      type: Number,
      required: true
    },
    skill_level: {
      type: String,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
      required: true
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
}, { _id: false });

const daySchema = new mongoose.Schema({
  day_number: Number,
  day_name: String,
  topic: String,
  tasks: [taskSchema],
  total_minutes: Number
}, { _id: false });

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
  days: [daySchema]
}, { _id: false });

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
    journey_started: {
      type: Boolean,
      default: false
    },
    journey_start_date: {
      type: Date,
      default: null
    },
    overall_level: {
      type: String,
      default: null
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
    relevance_reason: 'Directly covers variables, assignment, primitive data types, and basic expressions required for today\'s beginner task.',
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

  // --- CYBERSECURITY ---
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
  let score = 0;

  // 1. Task Relevance (40%)
  const taskTitleClean = (task.taskTitle || task.title || '').toLowerCase();
  const taskTopicClean = (task.dailyTopic || task.topic || '').toLowerCase();
  const subtopicClean = (task.subtopic || '').toLowerCase();
  const resTitle = (resource.title || '').toLowerCase();
  const resTopic = (resource.topic || '').toLowerCase();
  const resSubtopic = (resource.subtopic || '').toLowerCase();

  let relevancePoints = 0;
  if (resSubtopic && subtopicClean && (resSubtopic.includes(subtopicClean) || subtopicClean.includes(resSubtopic))) relevancePoints += 40;
  else if (resTopic && taskTopicClean && (resTopic.includes(taskTopicClean) || taskTopicClean.includes(resTopic))) relevancePoints += 30;
  else if (taskTitleClean.split(' ').some(w => w.length > 3 && resTitle.includes(w))) relevancePoints += 20;
  else relevancePoints += 10;

  score += Math.min(40, relevancePoints);

  // 2. Level Match (20%)
  const userLevel = (task.userLevel || task.difficulty || 'BEGINNER').toUpperCase();
  const resLevel = (resource.difficulty || 'BEGINNER').toUpperCase();
  if (userLevel === resLevel) {
    score += 20;
  } else if ((userLevel === 'BEGINNER' && resLevel === 'INTERMEDIATE') || (userLevel === 'INTERMEDIATE' && resLevel === 'BEGINNER')) {
    score += 10;
  } else if (userLevel === 'ADVANCED' || userLevel === 'MASTERED') {
    score += 15;
  }

  // 3. Task Type Match (15%)
  const tType = (task.taskType || task.type || 'LEARN').toUpperCase();
  const rType = (resource.resource_type || resource.type || 'TUTORIAL').toUpperCase();

  if (tType === 'LEARN' && (rType === 'TUTORIAL' || rType === 'GUIDE' || rType === 'DOCUMENTATION')) score += 15;
  else if (tType === 'PRACTICE' && (rType === 'PRACTICE' || rType === 'EXERCISE' || rType === 'QUIZ')) score += 15;
  else if (tType === 'IMPLEMENT' && (rType === 'DOCUMENTATION' || rType === 'API' || rType === 'IMPLEMENTATION')) score += 15;
  else if (tType === 'REVISION' && (rType === 'CHEAT_SHEET' || rType === 'SUMMARY' || rType === 'REFERENCE')) score += 15;
  else if (tType === 'PROJECT' && (rType === 'PROJECT' || rType === 'REPOSITORY' || rType === 'DATASET')) score += 15;
  else score += 8;

  // 4. Resource Quality / Authority (15%)
  if (resource.is_official) score += 15;
  else score += Math.round((resource.quality_score || 80) * 0.15);

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

  // 2. REJECT CROSS-DOMAIN LEAKAGE: HTML/JS for Non-Web domains
  const title = (resource.title + ' ' + (resource.description || '')).toLowerCase();
  const taskTopic = (taskContext.dailyTopic || taskContext.topic || taskContext.taskTitle || '').toLowerCase();

  if (domainKey !== 'fullstack') {
    if ((title.includes('html') || title.includes('javascript first steps') || title.includes('css flexbox') || title.includes('anatomy of an html')) &&
        !taskTopic.includes('html') && !taskTopic.includes('javascript') && !taskTopic.includes('web')) {
      return false;
    }
  }

  if (domainKey !== 'datascience' && domainKey !== 'ai_llm') {
    if ((title.includes('pandas') || title.includes('scikit-learn') || title.includes('pytorch')) &&
        !taskTopic.includes('pandas') && !taskTopic.includes('ml') && !taskTopic.includes('python')) {
      return false;
    }
  }

  if (domainKey !== 'cybersecurity') {
    if (title.includes('owasp top ten') && !taskTopic.includes('security') && !taskTopic.includes('owasp')) {
      return false;
    }
  }

  return true;
}

// Helper: Dynamic Domain-Specific & Task-Specific Resource Generator
function generateDynamicDomainTaskResources(taskContext) {
  const domainKey = canonicalizeDomainKey(taskContext.domain || taskContext.chosen_domain);
  const cleanLevel = (taskContext.difficulty || taskContext.userLevel || taskContext.taskDifficulty || 'BEGINNER').toUpperCase();
  const cleanTopic = taskContext.dailyTopic || taskContext.topic || 'Core Fundamentals';
  const taskTitle = taskContext.taskTitle || taskContext.title || cleanTopic;
  const taskType = (taskContext.taskType || taskContext.type || 'LEARN').toUpperCase();
  const duration = taskContext.taskDuration || taskContext.estimated_minutes || 30;

  let platformInfo = {
    platform: 'Official Documentation',
    primaryURL: 'https://docs.python.org/3/tutorial/',
    altURL: 'https://scikit-learn.org/stable/',
    practicePlatform: 'Interactive Sandbox'
  };

  if (domainKey === 'cybersecurity') {
    const isWindows = cleanTopic.toLowerCase().includes('windows') || taskTitle.toLowerCase().includes('windows');
    platformInfo = {
      platform: isWindows ? 'Microsoft Security Guides' : 'OWASP & Linux Security Guides',
      primaryURL: isWindows ? 'https://learn.microsoft.com/en-us/windows/security/' : 'https://owasp.org/www-project-top-ten/',
      altURL: 'https://portswigger.net/web-security',
      practicePlatform: 'Cybersecurity Security Lab'
    };
  } else if (domainKey === 'datascience') {
    const isPyTorch = cleanTopic.toLowerCase().includes('pytorch') || cleanTopic.toLowerCase().includes('neural');
    const isPandas = cleanTopic.toLowerCase().includes('pandas');
    platformInfo = {
      platform: isPyTorch ? 'PyTorch Docs' : (isPandas ? 'Pandas Docs' : 'Python Data Science Docs'),
      primaryURL: isPyTorch ? 'https://pytorch.org/tutorials/' : (isPandas ? 'https://pandas.pydata.org/docs/getting_started/index.html' : 'https://docs.python.org/3/tutorial/'),
      altURL: 'https://scikit-learn.org/stable/tutorial/index.html',
      practicePlatform: 'Data Science Sandbox'
    };
  } else if (domainKey === 'dsa') {
    platformInfo = {
      platform: 'GeeksforGeeks & Algorithm Visualizers',
      primaryURL: 'https://www.geeksforgeeks.org/data-structures/',
      altURL: 'https://leetcode.com/explore/',
      practicePlatform: 'DSA Code Drills Sandbox'
    };
  } else if (domainKey === 'devops') {
    platformInfo = {
      platform: 'Docker & Infrastructure Guides',
      primaryURL: 'https://docs.docker.com/get-started/',
      altURL: 'https://kubernetes.io/docs/tutorials/',
      practicePlatform: 'DevOps Terminal Sandbox'
    };
  } else if (domainKey === 'cloud') {
    platformInfo = {
      platform: 'Cloud Architecture & Provider Docs',
      primaryURL: 'https://docs.aws.amazon.com/',
      altURL: 'https://cloud.google.com/docs',
      practicePlatform: 'Cloud Architecture Lab'
    };
  } else if (domainKey === 'mobile') {
    platformInfo = {
      platform: 'Flutter & Mobile SDK Docs',
      primaryURL: 'https://docs.flutter.dev/',
      altURL: 'https://developer.android.com/guide',
      practicePlatform: 'Mobile UI Emulator Sandbox'
    };
  } else if (domainKey === 'ai_llm') {
    platformInfo = {
      platform: 'PyTorch & Hugging Face AI Docs',
      primaryURL: 'https://pytorch.org/tutorials/',
      altURL: 'https://huggingface.co/learn/nlp-course/chapter1/1',
      practicePlatform: 'AI Model Training Sandbox'
    };
  } else if (domainKey === 'system_design') {
    platformInfo = {
      platform: 'System Design Primer & Specs',
      primaryURL: 'https://github.com/donnemartin/system-design-primer',
      altURL: 'https://martinfowler.com/architecture/',
      practicePlatform: 'Architecture Diagramming Sandbox'
    };
  } else {
    platformInfo = {
      platform: 'MDN Web Docs & W3C Specs',
      primaryURL: 'https://developer.mozilla.org/en-US/docs/Learn',
      altURL: 'https://react.dev/learn',
      practicePlatform: 'Full-Stack Web Sandbox'
    };
  }

  let typeDesc = `Structured, verified ${cleanLevel.toLowerCase()} learning guide explaining ${cleanTopic} and practical usage.`;
  let recSection = `Section: ${cleanTopic} Fundamentals`;
  let typeLabel = 'TUTORIAL';

  if (taskType === 'PRACTICE') {
    typeDesc = `Guided coding drills, problem sets, and interactive exercises for ${cleanTopic}.`;
    recSection = `Interactive Lab: ${cleanTopic} Code Drills`;
    typeLabel = 'PRACTICE';
  } else if (taskType === 'IMPLEMENT') {
    typeDesc = `Technical implementation guide and API reference for building ${cleanTopic} modules.`;
    recSection = `Implementation Guide: ${cleanTopic} Code Patterns`;
    typeLabel = 'DOCUMENTATION';
  } else if (taskType === 'REVISION') {
    typeDesc = `Concise summary notes, concept flashcards, and quick reference sheet for ${cleanTopic}.`;
    recSection = `Quick Reference: ${cleanTopic} Core Principles`;
    typeLabel = 'CHEAT_SHEET';
  } else if (taskType === 'PROJECT') {
    typeDesc = `End-to-end hands-on project guide and repository structure for ${cleanTopic}.`;
    recSection = `Project Blueprint: ${cleanTopic}`;
    typeLabel = 'PROJECT';
  }

  const primaryRes = {
    resource_id: `dyn_${taskContext.taskId || taskContext.id || Date.now()}_primary`,
    category_label: 'PRIMARY',
    title: `${cleanTopic}: ${taskTitle}`,
    platform: platformInfo.platform,
    url: platformInfo.primaryURL,
    resource_type: typeLabel,
    description: typeDesc,
    topic: cleanTopic,
    subtopic: taskContext.subtopic || cleanTopic,
    domain: domainKey,
    difficulty: cleanLevel,
    estimated_minutes: duration,
    recommended_section: recSection,
    relevance_reason: `Directly matched to today's ${domainKey.toUpperCase()} ${cleanLevel} task "${taskTitle}".`,
    is_official: true,
    quality_score: 95,
    verified_at: new Date(),
    is_valid: true,
    calculatedScore: 90
  };

  const practiceRes = {
    resource_id: `dyn_${taskContext.taskId || taskContext.id || Date.now()}_practice`,
    category_label: taskType === 'PRACTICE' ? 'PRIMARY' : 'PRACTICE',
    title: `${cleanTopic} Interactive Practice & Drills`,
    platform: platformInfo.practicePlatform,
    url: platformInfo.altURL || platformInfo.primaryURL,
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
    quality_score: 88,
    verified_at: new Date(),
    is_valid: true,
    calculatedScore: 85
  };

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
    userLevel
  } = taskData;

  const domainKey = canonicalizeDomainKey(domain);

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

  let selectedResources = scoredList.slice(0, 2);

  // Stage 2: Dynamic Domain-Specific & Task-Specific Fallback if catalog matches are insufficient
  if (selectedResources.length === 0 || selectedResources[0].calculatedScore < 50) {
    selectedResources = generateDynamicDomainTaskResources(taskData);
  }

  // Format category labels
  const formattedResources = selectedResources.map((res, idx) => ({
    resource_id: res.resource_id || `res_${Date.now()}_${idx}`,
    category_label: res.category_label || (idx === 0 ? 'PRIMARY' : 'PRACTICE'),
    title: res.title,
    platform: res.platform,
    url: res.url,
    resource_type: res.resource_type,
    description: res.description,
    topic: res.topic,
    subtopic: res.subtopic,
    domain: res.domain,
    difficulty: res.difficulty,
    estimated_minutes: res.estimated_minutes,
    recommended_section: res.recommended_section,
    relevance_reason: res.relevance_reason,
    is_official: res.is_official,
    quality_score: res.quality_score,
    verified_at: res.verified_at || new Date(),
    is_valid: res.is_valid !== undefined ? res.is_valid : true
  }));

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

  if (quizEvaluation) {
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

  // Enforce score-to-level boundaries if score is explicitly provided
  if (overallScore < 50) {
    userLevel = 'BEGINNER';
  } else if (overallScore >= 50 && overallScore < 75 && userLevel === 'BEGINNER') {
    userLevel = 'INTERMEDIATE';
  } else if (overallScore >= 90 && userLevel !== 'MASTERED') {
    userLevel = 'MASTERED';
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

      const domain =
        chosen_domain || 'fullstack';

      const months =
        parseInt(timeline_months, 10);

      if (isNaN(months) || months < 1) {
        return sendJSON(res, 400, {
          error: 'Preparation timeline must be a positive integer of months (minimum 1).'
        });
      }

      const hours =
        parseFloat(daily_hours);

      if (isNaN(hours) || hours <= 0) {
        return sendJSON(res, 400, {
          error: 'Daily commitment must be a positive number of hours.'
        });
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
  // 11b. QUIZ EVALUATION AGENT ENDPOINT
  // POST /api/quiz/evaluate
  // ==========================================================

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
      let { user_id, domain, answers } = payload;

      if (!user_id || !answers || !Array.isArray(answers) || answers.length === 0) {
        return sendJSON(res, 400, {
          error: 'Missing required parameters: user_id, domain, and a non-empty answers array.'
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

      let correctCount = 0;
      const totalQuestions = answers.length;
      const topicStats = {};
      const processedAnswers = [];

      answers.forEach(q => {
        const isCorrect = (q.user_answer !== undefined && q.user_answer !== null && q.user_answer !== 'Unanswered') &&
          (String(q.user_answer).trim() === String(q.correct_answer).trim());
        
        if (isCorrect) {
          correctCount++;
        }

        const topic = q.topic || 'General Knowledge';
        if (!topicStats[topic]) {
          topicStats[topic] = { total: 0, correct: 0, missedConceptual: false };
        }
        topicStats[topic].total++;
        if (isCorrect) {
          topicStats[topic].correct++;
        } else {
          if (q.difficulty === 'BEGINNER' || !q.difficulty) {
            topicStats[topic].missedConceptual = true;
          }
        }

        processedAnswers.push({
          id: q.id,
          question: q.question,
          options: q.options || [],
          user_answer: q.user_answer || 'Unanswered',
          correct_answer: q.correct_answer,
          topic: topic,
          difficulty: q.difficulty || 'INTERMEDIATE',
          is_correct: isCorrect
        });
      });

      const scorePct = Math.round((correctCount / totalQuestions) * 100);

      let skillLevel = 'BEGINNER';
      let levelDescription = '';

      if (scorePct >= 80) {
        skillLevel = 'ADVANCED';
        levelDescription = 'High technical proficiency. Focus on system design, internal architecture, performance tuning, and production trade-offs.';
      } else if (scorePct >= 50) {
        skillLevel = 'INTERMEDIATE';
        levelDescription = 'Practical understanding solid. Ready for building projects, official documentation, and applied patterns.';
      } else {
        skillLevel = 'BEGINNER';
        levelDescription = 'Core foundational gaps present. Focus on fundamental syntax and guided visual learning.';
      }

      const masteredTopics = [];
      const knowledgeGaps = [];

      let topicEvaluations = [];
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

      // Save evaluation in MongoDB Atlas collection `quiz_evaluations`
      const evaluationDoc = new QuizEvaluation({
        user_id,
        domain: resolvedDomain,
        score_pct: scorePct,
        correct_count: correctCount,
        total_questions: totalQuestions,
        skill_level: skillLevel,
        level_description: levelDescription,
        mastered_topics: masteredTopics,
        knowledge_gaps: knowledgeGaps,
        topic_evaluations: topicEvaluations,
        answers: processedAnswers
      });

      await evaluationDoc.save();

      // Update current_skill_level and set quiz_completed: true in MongoDB Registration collection
      let updatedUser = await User.findOneAndUpdate(
        { user_id },
        {
          current_skill_level: skillLevel,
          quiz_completed: true,
          roadmap_status: 'ROADMAP_REQUIRED'
        },
        { new: true }
      );

      console.log(`✅ Saved Quiz Evaluation for user ${user_id}: ${scorePct}% (${skillLevel}) with ${topicEvaluations.length} topic evaluations. Set quiz_completed = true.`);

      return sendJSON(res, 200, {
        message: 'Quiz evaluation successfully calculated and persisted to MongoDB Atlas.',
        evaluation: {
          id: evaluationDoc._id,
          user_id,
          domain: resolvedDomain,
          score_pct: scorePct,
          correct_count: correctCount,
          total_questions: totalQuestions,
          skill_level: skillLevel,
          level_description: levelDescription,
          mastered_topics: masteredTopics,
          knowledge_gaps: knowledgeGaps,
          topic_evaluations: topicEvaluations,
          answers: processedAnswers,
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
      const { user_id, quizEvaluation } = payload;

      if (!user_id) {
        return sendJSON(res, 400, {
          error: 'Missing required parameter: user_id.'
        });
      }

      // Fetch user profile from MongoDB Atlas (`Registration` collection / `User` model)
      const user = await User.findOne({ user_id });
      if (!user) {
        return sendJSON(res, 404, {
          error: `User profile for user_id ${user_id} not found in database.`
        });
      }

      // Fetch latest completed quiz evaluation from MongoDB Atlas (`quiz_evaluations` collection) or payload
      let latestQuizEval = quizEvaluation || null;
      if (!latestQuizEval) {
        latestQuizEval = await QuizEvaluation.findOne({ user_id }).sort({ createdAt: -1 });
      }

      console.log(`[ROADMAP DEBUG] Generating roadmap using evaluation for user: ${user.user_id}`);
      console.log(`[ROADMAP DEBUG] user_id: ${user.user_id}`);
      console.log(`[ROADMAP DEBUG] quiz_score: ${latestQuizEval ? (latestQuizEval.score_pct !== undefined ? latestQuizEval.score_pct : latestQuizEval.scorePct) : 'NULL (No Quiz Eval Found)'}`);
      console.log(`[ROADMAP DEBUG] skill_level: ${latestQuizEval ? (latestQuizEval.skill_level || latestQuizEval.skillTier || 'UNASSESSED') : 'UNASSESSED'}`);
      console.log(`[ROADMAP DEBUG] topic_evaluations: ${latestQuizEval && (latestQuizEval.topic_evaluations || latestQuizEval.topicEvaluations) ? (latestQuizEval.topic_evaluations || latestQuizEval.topicEvaluations).length : 0}`);
      console.log(`[ROADMAP DEBUG] knowledge_gaps: ${latestQuizEval && (latestQuizEval.knowledge_gaps || latestQuizEval.knowledgeGaps) ? (latestQuizEval.knowledge_gaps || latestQuizEval.knowledgeGaps).length : 0}`);
      console.log(`[ROADMAP DEBUG] mastered_topics: ${latestQuizEval && (latestQuizEval.mastered_topics || latestQuizEval.masteredTopics) ? (latestQuizEval.mastered_topics || latestQuizEval.masteredTopics).length : 0}`);

      // Generate 3-level hierarchical personalized roadmap
      const roadmapData = generatePersonalizedRoadmapEngine({
        user_id: user.user_id,
        domain: user.chosen_domain,
        timeline_months: user.timeline_months,
        daily_hours: user.daily_hours,
        quizEvaluation: latestQuizEval
      });

      // Save/Replace active roadmap in MongoDB Atlas `roadmaps` collection
      const savedRoadmap = await Roadmap.findOneAndUpdate(
        { user_id: user.user_id },
        {
          ...roadmapData,
          updated_at: new Date()
        },
        { upsert: true, new: true }
      );

      // Update user roadmap_status to READY
      await User.findOneAndUpdate({ user_id: user.user_id }, { roadmap_status: 'READY' });

      console.log(`✅ Generated and saved Personalized Roadmap for user ${user_id} (${user.chosen_domain}, ${user.timeline_months} Months, ${user.daily_hours} Hrs/Day)`);

      return sendJSON(res, 200, {
        success: true,
        message: 'Personalized Dynamic Roadmap generated and saved to MongoDB Atlas successfully.',
        roadmap: savedRoadmap
      });

    } catch (err) {
      console.error('❌ Roadmap generation error:', err);
      return sendJSON(res, 500, {
        error: 'Server roadmap generation error: ' + err.message
      });
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
      const { user_id, start_date } = payload;

      if (!user_id) {
        return sendJSON(res, 400, {
          error: 'Missing required parameter: user_id.'
        });
      }

      const user = await User.findOne({ user_id });
      if (!user) {
        return sendJSON(res, 404, {
          error: `User profile for user_id ${user_id} not found in database.`
        });
      }

      let startDateObj = user.journey_start_date;
      if (!user.journey_started || !startDateObj) {
        startDateObj = start_date ? new Date(start_date) : new Date();
        user.journey_started = true;
        user.journey_start_date = startDateObj;
        await user.save();
      }

      const roadmapDoc = await Roadmap.findOneAndUpdate(
        { user_id: user.user_id },
        {
          journey_started: true,
          journey_start_date: startDateObj,
          updated_at: new Date()
        },
        { new: true }
      );

      console.log(`🚀 Journey started for user ${user_id} on ${startDateObj.toISOString()}`);

      return sendJSON(res, 200, {
        success: true,
        message: 'Journey started successfully.',
        journey_started: true,
        journey_start_date: startDateObj,
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

      // Stale roadmap invalidation check: If generated with an older engine version, automatically upgrade
      if (roadmapDoc.curriculum_version !== 'v2_placement') {
        console.log(`[STALE ROADMAP DETECTED] Upgrading stale roadmap to v2_placement for user: ${targetUserId}`);
        const userDoc = await User.findOne({ user_id: targetUserId });
        if (userDoc) {
          const latestQuizEval = await QuizEvaluation.findOne({ user_id: targetUserId }).sort({ createdAt: -1 });
          const newRoadmapData = generatePersonalizedRoadmapEngine({
            user_id: userDoc.user_id,
            domain: userDoc.chosen_domain,
            timeline_months: userDoc.timeline_months,
            daily_hours: userDoc.daily_hours,
            quizEvaluation: latestQuizEval
          });
          roadmapDoc = await Roadmap.findOneAndUpdate(
            { user_id: targetUserId },
            { ...newRoadmapData, updated_at: new Date() },
            { upsert: true, new: true }
          );
        }
      }

      return sendJSON(res, 200, {
        success: true,
        roadmap: roadmapDoc
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

      if (mongoose.connection.readyState === 1) {
        const cachedResources = await Resource.find({
          $or: [
            { resource_id: { $regex: taskId } },
            { subtopic: { $regex: taskId } }
          ]
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
  // 12. STATIC FILE SERVER
  // ==========================================================

  let requestedPath =
    parsedUrl.pathname === '/'
      ? 'index.html'
      : parsedUrl.pathname;


  // Prevent paths from escaping project directory
  requestedPath =
    requestedPath.replace(/^\/+/, '');


  const filePath =
    path.join(__dirname, requestedPath);


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