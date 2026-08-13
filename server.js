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
  revision_details: String
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
// DOMAIN CURRICULA DATA FOR ALL 8 TECH DOMAINS
// ============================================================

const DOMAIN_CURRICULA = {
  fullstack: {
    domainId: 'fullstack',
    domainName: 'Full-Stack Web Development',
    topics: [
      { id: 'fs_js', name: 'JavaScript Fundamentals', subtopics: ['Scope & Hoisting', 'Event Loop & Microtasks', 'Closures & Lexical Memory', 'Prototype Chain', 'ES6+ Async/Await'], difficulty: 'BEGINNER' },
      { id: 'fs_api', name: 'REST API & Backend Architecture', subtopics: ['HTTP Methods & Idempotency', 'Express/Node Middleware', 'API Gateway & Rate Limiting', 'GraphQL & DataLoader', 'Authentication & JWT'], difficulty: 'INTERMEDIATE' },
      { id: 'fs_react', name: 'React & UI Architecture', subtopics: ['Virtual DOM & Reconciliation', 'React Hooks Rules & Fiber', 'Performance & Memoization', 'SSR & Hydration', 'State Management'], difficulty: 'INTERMEDIATE' },
      { id: 'fs_db', name: 'Database Management', subtopics: ['ACID Atomicity & Isolation', 'SQL Joins & Indexing', 'Normalization (3NF)', 'MongoDB Schema Design', 'ORM/ODM Integration'], difficulty: 'INTERMEDIATE' },
      { id: 'fs_sec', name: 'Web Security', subtopics: ['XSS Prevention', 'SQL Injection Mitigation', 'CSRF Defenses', 'Password Hashing (Argon2/bcrypt)', 'CORS Preflight'], difficulty: 'ADVANCED' },
      { id: 'fs_sys', name: 'System Design & Deployment', subtopics: ['Stateless Architecture', 'Reverse Proxies (Nginx)', 'Caching Strategies (Redis)', 'Async Task Queues', 'Docker Containerization'], difficulty: 'ADVANCED' }
    ]
  },
  datascience: {
    domainId: 'datascience',
    domainName: 'Data Science & Machine Learning',
    topics: [
      { id: 'ds_prep', name: 'Python Data Stack & Preprocessing', subtopics: ['Pandas & NumPy Vectorization', 'Handling Missing Data', 'Feature Scaling & Encoding', 'Imbalanced Datasets (SMOTE)', 'Exploratory Data Analysis'], difficulty: 'BEGINNER' },
      { id: 'ds_ml', name: 'Machine Learning Fundamentals', subtopics: ['Supervised vs Unsupervised', 'Bias-Variance Tradeoff', 'L1/L2 Regularization', 'Gradient Descent Optimization', 'Decision Trees & Ensembles'], difficulty: 'INTERMEDIATE' },
      { id: 'ds_unsup', name: 'Unsupervised Learning & PCA', subtopics: ['K-Means Clustering', 'Hierarchical Clustering', 'PCA Eigendecomposition', 'Dimensionality Reduction', 'Silhouette Analysis'], difficulty: 'INTERMEDIATE' },
      { id: 'ds_dl', name: 'Deep Learning & Neural Networks', subtopics: ['Activation Functions (ReLU)', 'Backpropagation Math', 'CNN Architectures', 'Dropout & Batch Norm', 'Loss Functions'], difficulty: 'INTERMEDIATE' },
      { id: 'ds_nlp', name: 'Advanced Deep Learning & NLP', subtopics: ['Self-Attention Mechanism', 'Transformers (BERT vs GPT)', 'Word Embeddings (Word2Vec)', 'Sequence Processing', 'Fine-tuning Models'], difficulty: 'ADVANCED' },
      { id: 'ds_ops', name: 'MLOps & Model Deployment', subtopics: ['Concept Drift Monitoring', 'Model Serialization (ONNX)', 'Feature Stores', 'Canary Deployments', 'Inference Latency Optimization'], difficulty: 'ADVANCED' }
    ]
  },
  dsa: {
    domainId: 'dsa',
    domainName: 'Data Structures & Algorithms (Interview Prep)',
    topics: [
      { id: 'dsa_arr', name: 'Complexity Analysis & Arrays', subtopics: ['Big-O Space & Time', 'Hash Map Collision Handling', 'Two Sum & Pair Lookup', 'Prefix Sum Array', 'Frequency Maps'], difficulty: 'BEGINNER' },
      { id: 'dsa_win', name: 'Two Pointers & Sliding Window', subtopics: ['Fixed Size Window', 'Dynamic Window Shrink', 'Fast & Slow Pointers', 'Subarray Max Sum', 'Kadane Algorithm'], difficulty: 'BEGINNER' },
      { id: 'dsa_stack', name: 'Stacks & Queues', subtopics: ['LIFO & FIFO Mechanics', 'Valid Parentheses Matching', 'Monotonic Stack Pattern', 'Queue via Two Stacks', 'Postfix Expression Evaluation'], difficulty: 'INTERMEDIATE' },
      { id: 'dsa_tree', name: 'Trees & Search Algorithms', subtopics: ['Binary Search Tree Operations', 'In-Order / Pre-Order Traversal', 'Self-Balancing Trees (AVL/RB)', 'Lowest Common Ancestor (LCA)', 'Trie Data Structure'], difficulty: 'INTERMEDIATE' },
      { id: 'dsa_graph', name: 'Graph Algorithms & Shortest Path', subtopics: ['BFS vs DFS Traversal', 'Topological Sort (Kahn Alg)', 'Dijkstra Priority Queue', 'Cycle Detection in DAG', 'Union-Find / Disjoint Set'], difficulty: 'ADVANCED' },
      { id: 'dsa_dp', name: 'Dynamic Programming', subtopics: ['Memoization vs Tabulation', '0/1 Knapsack Pattern', 'Longest Common Subsequence', 'Grid Path DP', 'State Compression DP'], difficulty: 'ADVANCED' }
    ]
  },
  devops: {
    domainId: 'devops',
    domainName: 'Cloud Engineering & DevOps',
    topics: [
      { id: 'dev_linux', name: 'Linux Administration & Shell', subtopics: ['Linux Process Management', 'File Permissions & Systemd', 'Bash Scripting & Automation', 'Networking Utilities (ss/dig/curl)', 'SSH Hardening'], difficulty: 'BEGINNER' },
      { id: 'dev_docker', name: 'Containerization & Docker', subtopics: ['Dockerfile Optimization', 'Multi-stage Builds', 'Docker Container Networking', 'Docker Compose Orchestration', 'Image Security Scanning'], difficulty: 'INTERMEDIATE' },
      { id: 'dev_k8s', name: 'Kubernetes Infrastructure', subtopics: ['Pods, Deployments & ReplicaSets', 'Services & Ingress Controllers', 'Persistent Volumes & Claims', 'Helm Chart Package Mgmt', 'Cluster Autoscaling'], difficulty: 'INTERMEDIATE' },
      { id: 'dev_cicd', name: 'CI/CD Automation', subtopics: ['GitHub Actions Workflows', 'Automated Testing Pipelines', 'Container Registry Push', 'Blue-Green Deployments', 'GitOps with ArgoCD'], difficulty: 'INTERMEDIATE' },
      { id: 'dev_iac', name: 'Infrastructure as Code', subtopics: ['Terraform Syntax & HCL', 'State File Management', 'Terraform Modules', 'Ansible Configuration Mgmt', 'Cloud Resource Provisioning'], difficulty: 'ADVANCED' },
      { id: 'dev_obs', name: 'Cloud Architecture & Observability', subtopics: ['Prometheus Metrics Collection', 'Grafana Dashboarding', 'Distributed Tracing (Jaeger)', 'IAM & Cloud Security', 'Disaster Recovery'], difficulty: 'ADVANCED' }
    ]
  },
  cybersecurity: {
    domainId: 'cybersecurity',
    domainName: 'Cybersecurity & Ethical Hacking',
    topics: [
      { id: 'sec_net', name: 'Networking Protocols & Traffic Analysis', subtopics: ['TCP/IP Handshake & Packets', 'Wireshark Packet Capture', 'Subnetting & Routing', 'DNS & HTTP Vulnerabilities', 'Arp Spoofing Detection'], difficulty: 'BEGINNER' },
      { id: 'sec_web', name: 'Web Application Vulnerabilities', subtopics: ['OWASP Top 10 Deep Dive', 'Cross-Site Scripting (XSS)', 'SQL Injection Exploitation', 'CSRF & Session Hijacking', 'IDOR & Auth Bypasses'], difficulty: 'INTERMEDIATE' },
      { id: 'sec_crypto', name: 'Cryptography & PKI', subtopics: ['Symmetric vs Asymmetric Ciphers', 'Cryptographic Hash Functions', 'Public Key Infrastructure (PKI)', 'TLS Handshake Inspection', 'Digital Signatures'], difficulty: 'INTERMEDIATE' },
      { id: 'sec_def', name: 'Network Defense & Firewalls', subtopics: ['Stateful vs Stateless Firewalls', 'IDS/IPS Rules & Signatures', 'VPN Tunneling Protocols', 'Nmap Network Scanning', 'Zero Trust Architecture'], difficulty: 'INTERMEDIATE' },
      { id: 'sec_sys', name: 'System Hardening & IAM', subtopics: ['Linux/Windows Security Hardening', 'Active Directory Security', 'Role-Based Access Control (RBAC)', 'Kernel Exploitation Protections', 'Privilege Escalation Defenses'], difficulty: 'ADVANCED' },
      { id: 'sec_ir', name: 'Incident Response & Forensics', subtopics: ['SIEM Log Analysis & Splunk', 'Memory & Disk Forensics', 'Threat Hunting Techniques', 'Malware Static Analysis', 'Incident Remediation Playbooks'], difficulty: 'ADVANCED' }
    ]
  },
  mobile: {
    domainId: 'mobile',
    domainName: 'Mobile App Development (React Native & Flutter)',
    topics: [
      { id: 'mob_ui', name: 'Mobile UI Layouts & Components', subtopics: ['Flexbox Layout Engine', 'React Native / Flutter Components', 'Custom Reusable UI Elements', 'Screen Responsiveness', 'Touch & Gesture Handling'], difficulty: 'BEGINNER' },
      { id: 'mob_state', name: 'State Management & Navigation', subtopics: ['Redux / Context / Provider', 'Stack & Tab Navigation', 'Deep Linking Setup', 'Async State Management', 'Form Validation'], difficulty: 'INTERMEDIATE' },
      { id: 'mob_native', name: 'Native Hardware Integration', subtopics: ['Camera & File Access APIs', 'Geolocation & Mapping', 'Push Notifications (FCM)', 'Device Hardware Sensors', 'Native Modules Bridge'], difficulty: 'INTERMEDIATE' },
      { id: 'mob_perf', name: 'Mobile Performance & Local Storage', subtopics: ['AsyncStorage & SQLite DB', 'Image Caching & Lazy Loading', 'Memory Leak Profiling', 'FPS Optimization', 'Offline-First Synchronization'], difficulty: 'INTERMEDIATE' },
      { id: 'mob_sec', name: 'App Security & Authentication', subtopics: ['OAuth 2.0 / OpenID Connect', 'Secure Keychain / Keystore', 'Biometric Auth (Touch/Face ID)', 'SSL Pinning', 'App Obfuscation'], difficulty: 'ADVANCED' },
      { id: 'mob_cicd', name: 'App Store Publishing & CI/CD', subtopics: ['Fastlane Automation', 'iOS Code Signing & Provisioning', 'Android APK/AAB Bundle Signing', 'App Store Connect Submission', 'Google Play Release Management'], difficulty: 'ADVANCED' }
    ]
  },
  ai_llm: {
    domainId: 'ai_llm',
    domainName: 'AI & LLM Systems Engineering',
    topics: [
      { id: 'ai_prompt', name: 'Prompt Engineering & Context', subtopics: ['Zero-shot & Few-shot Prompting', 'System Prompt Design', 'Context Window Allocation', 'Structured Output JSON Generation', 'Prompt Chaining'], difficulty: 'BEGINNER' },
      { id: 'ai_vec', name: 'Embeddings & Vector Databases', subtopics: ['Text Vector Embeddings', 'Cosine & Dot Product Similarity', 'Pinecone / ChromaDB / FAISS', 'HNSW Indexing Algorithms', 'Vector Search Performance'], difficulty: 'INTERMEDIATE' },
      { id: 'ai_rag', name: 'RAG Architectures & Retrieval', subtopics: ['Document Chunking Strategies', 'Hybrid Keyword & Vector Search', 'Re-ranking Models (Cohere)', 'Query Rewriting & Expansion', 'RAG Context Injection'], difficulty: 'INTERMEDIATE' },
      { id: 'ai_ft', name: 'LLM Fine-Tuning & Quantization', subtopics: ['LoRA & QLoRA Parameter Efficient Tuning', 'Instruction Dataset Curation', 'Model Quantization (GGUF / AWQ)', 'Local Serving with Ollama', 'Model Fine-tuning Pipeline'], difficulty: 'ADVANCED' },
      { id: 'ai_agent', name: 'Agent Frameworks & Tool Calling', subtopics: ['ReAct Agent Loop Architecture', 'Function Calling & Schema Binding', 'Multi-Agent Collaboration', 'Memory & State Persistence', 'Autonomous Workflow Control'], difficulty: 'ADVANCED' },
      { id: 'ai_eval', name: 'Evaluation, Safety & Guardrails', subtopics: ['Hallucination Detection Metrics', 'NeMo & Llama Guardrails', 'LLM Benchmark Evaluation', 'Prompt Injection Prevention', 'Cost & Latency Optimization'], difficulty: 'ADVANCED' }
    ]
  },
  system_design: {
    domainId: 'system_design',
    domainName: 'System Design & Distributed Architecture',
    topics: [
      { id: 'sd_scale', name: 'Scalability & Load Balancing', subtopics: ['Horizontal vs Vertical Scaling', 'Load Balancer Algorithms (Layer 4 vs 7)', 'Consistent Hashing', 'Stateless Application Design', 'Rate Limiting Algorithms'], difficulty: 'BEGINNER' },
      { id: 'sd_cache', name: 'Caching & Content Delivery', subtopics: ['Cache-Aside & Write-Through Patterns', 'Redis Cluster & Eviction Policies', 'CDN Static Asset Caching', 'Cache Stampede Prevention', 'Invalidation Strategies'], difficulty: 'INTERMEDIATE' },
      { id: 'sd_db', name: 'Database Sharding & Replication', subtopics: ['Master-Slave Read Replicas', 'Horizontal Sharding Keys', 'CAP Theorem Tradeoffs', 'NoSQL vs SQL Selection', 'Index Tuning'], difficulty: 'INTERMEDIATE' },
      { id: 'sd_queue', name: 'Asynchronous Queues & Streaming', subtopics: ['Message Queues (RabbitMQ)', 'Event Streaming (Kafka Partitioning)', 'Dead Letter Queues', 'Idempotent Consumer Processing', 'Pub/Sub Messaging'], difficulty: 'INTERMEDIATE' },
      { id: 'sd_dist', name: 'Distributed Systems & Consistency', subtopics: ['Consensus Algorithms (Raft)', 'Saga Pattern for Transactions', 'Distributed Locking (Redlock)', 'Two-Phase Commit (2PC)', 'Eventual Consistency'], difficulty: 'ADVANCED' },
      { id: 'sd_micro', name: 'Microservices & API Gateways', subtopics: ['Service Mesh (Istio)', 'Circuit Breaker Pattern (Resilience4j)', 'gRPC vs REST APIs', 'Centralized Logging & Tracing', 'API Gateway Routing'], difficulty: 'ADVANCED' }
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

function generatePersonalizedRoadmapEngine({ user_id, domain, timeline_months, daily_hours, quizEvaluation }) {
  const domainKey = canonicalizeDomainKey(domain);
  const curriculum = DOMAIN_CURRICULA[domainKey] || DOMAIN_CURRICULA.fullstack;

  const timelineMonths = parseInt(timeline_months, 10) || 4;
  const dailyHours = parseFloat(daily_hours) || 2.0;
  const dailyMinutes = Math.round(dailyHours * 60);

  let overallScore = null;
  const topicMap = {};

  if (quizEvaluation) {
    overallScore = quizEvaluation.score_pct !== undefined 
      ? quizEvaluation.score_pct 
      : (quizEvaluation.scorePct !== undefined ? quizEvaluation.scorePct : null);

    const topicEvals = quizEvaluation.topic_evaluations || quizEvaluation.topicEvaluations || [];
    topicEvals.forEach(te => {
      const acc = te.score_pct !== undefined ? te.score_pct : (te.accuracy !== undefined ? te.accuracy : (te.score !== undefined ? te.score : 0));
      let status = te.proficiency_level || te.proficiencyLevel || 'INTERMEDIATE';
      if (acc < 50) status = 'WEAK';
      else if (acc >= 70) status = 'STRONG';
      if (te.topic) {
        topicMap[te.topic] = { score: acc, status };
      }
    });

    (quizEvaluation.knowledge_gaps || quizEvaluation.knowledgeGaps || []).forEach(gap => {
      if (gap.topic) {
        const acc = gap.accuracy_pct !== undefined ? gap.accuracy_pct : (gap.accuracy !== undefined ? gap.accuracy : 35);
        topicMap[gap.topic] = { score: acc, status: 'WEAK' };
      }
    });

    (quizEvaluation.mastered_topics || quizEvaluation.masteredTopics || []).forEach(m => {
      if (m.topic) {
        const acc = m.accuracy_pct !== undefined ? m.accuracy_pct : (m.accuracy !== undefined ? m.accuracy : 85);
        if (!topicMap[m.topic] || topicMap[m.topic].status !== 'WEAK') {
          topicMap[m.topic] = { score: acc, status: 'STRONG' };
        }
      }
    });
  }

  const topicPerformances = curriculum.topics.map(t => {
    let perf = topicMap[t.name];
    if (!perf) {
      const matchedKey = Object.keys(topicMap).find(k => k.toLowerCase().trim() === t.name.toLowerCase().trim());
      if (matchedKey) {
        perf = topicMap[matchedKey];
      }
    }
    if (!perf) {
      if (overallScore !== null) {
        let status = 'INTERMEDIATE';
        if (overallScore < 50) status = 'WEAK';
        else if (overallScore >= 70) status = 'STRONG';
        perf = { score: overallScore, status };
      } else {
        perf = { score: 50, status: 'INTERMEDIATE' };
      }
    }
    return {
      topic: t.name,
      score: perf.score,
      status: perf.status
    };
  });

  const monthlyRoadmap = [];
  const totalDomainTopics = curriculum.topics.length;

  for (let m = 1; m <= timelineMonths; m++) {
    let assignedTopics = [];
    if (timelineMonths >= totalDomainTopics) {
      if (m <= totalDomainTopics) {
        assignedTopics = [curriculum.topics[m - 1]];
      } else {
        const revIdx = (m - 1) % totalDomainTopics;
        assignedTopics = [curriculum.topics[revIdx]];
      }
    } else {
      const startIdx = Math.floor(((m - 1) * totalDomainTopics) / timelineMonths);
      const endIdx = Math.floor((m * totalDomainTopics) / timelineMonths);
      assignedTopics = curriculum.topics.slice(startIdx, Math.max(startIdx + 1, endIdx));
    }

    const assignedNames = assignedTopics.map(t => t.name);
    const assignedSubtopics = assignedTopics.flatMap(t => t.subtopics || []);

    const containsWeak = assignedNames.some(tn => {
      const p = topicPerformances.find(tp => tp.topic === tn);
      return p && p.status === 'WEAK';
    });

    const containsStrong = assignedNames.some(tn => {
      const p = topicPerformances.find(tp => tp.topic === tn);
      return p && p.status === 'STRONG';
    });

    let priority = 'HIGH';
    let difficulty = 'INTERMEDIATE';
    let monthTitle = `Month ${m}: ${assignedNames.join(' & ')}`;
    let objective = `Master core concepts and practical patterns of ${assignedNames.join(', ')}.`;

    if (containsWeak) {
      priority = 'HIGH';
      difficulty = 'BEGINNER';
      monthTitle = `Month ${m}: Remedial Foundations & Intensive Practice (${assignedNames.join(', ')})`;
      objective = `Build strong fundamental clarity, fix diagnostic knowledge gaps, and complete guided practice in ${assignedNames.join(', ')}.`;
    } else if (containsStrong && !containsWeak) {
      priority = 'MEDIUM';
      difficulty = 'ADVANCED';
      monthTitle = `Month ${m}: Fast-Track Advanced Application (${assignedNames.join(', ')})`;
      objective = `Accelerate past basics, optimize implementation patterns, and master advanced interview-level challenges in ${assignedNames.join(', ')}.`;
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

      if (wInMonth === 1) {
        weekTitle = `Week ${overallWeekNum}: Fundamentals & Theoretical Core (${assignedNames[0]})`;
        weekObj = `Deep dive into conceptual foundations and core mechanics of ${assignedSubtopics.slice(0, 3).join(', ')}.`;
        practiceFocus = 'Code walkthroughs, syntax drills, and basic implementation exercises.';
        revisionFocus = 'Flashcards on core definitions and architectural rules.';
        assessmentFocus = 'Diagnostic baseline check.';
      } else if (wInMonth === 2) {
        weekTitle = `Week ${overallWeekNum}: Applied Patterns & Implementation (${assignedNames[0]})`;
        weekObj = `Apply core concepts to practical scenarios and design problems involving ${assignedSubtopics.slice(2, 5).join(', ')}.`;
        practiceFocus = 'Hands-on project features and pattern implementation.';
        revisionFocus = 'Reviewing common pitfalls and error edge-cases.';
        assessmentFocus = 'Mid-month implementation challenge.';
      } else if (wInMonth === 3) {
        weekTitle = `Week ${overallWeekNum}: Advanced Problem Solving & Edge Cases`;
        weekObj = `Solve complex problems, optimize performance, and handle edge cases for ${assignedNames.join(', ')}.`;
        practiceFocus = 'Timed problem solving and multi-step scenario exercises.';
        revisionFocus = 'Code refactoring and optimization techniques.';
        assessmentFocus = 'Advanced problem-solving quiz.';
      } else {
        weekTitle = `Week ${overallWeekNum}: Comprehensive Review, Remediation & Assessment`;
        weekObj = `Consolidate monthly learning, review weak areas, and evaluate complete topic mastery.`;
        practiceFocus = 'Full mini-project integration and complex problem sets.';
        revisionFocus = 'Remedial review of missed concepts during weekly assessments.';
        assessmentFocus = 'End-of-month evaluation milestone.';
      }

      const days = [];
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      for (let d = 1; d <= 7; d++) {
        const dayName = dayNames[d - 1];
        let dayTopic = assignedNames[0];
        let dayTasks = [];

        if (d === 1) {
          const t1Mins = Math.round(dailyMinutes * 0.35);
          const t2Mins = Math.round(dailyMinutes * 0.40);
          const t3Mins = dailyMinutes - t1Mins - t2Mins;
          dayTasks = [
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_1`,
              title: `Learn: ${assignedSubtopics[0] || dayTopic + ' Fundamentals'}`,
              type: 'LEARN',
              estimated_minutes: t1Mins,
              difficulty: containsWeak ? 'BEGINNER' : 'INTERMEDIATE',
              resources_ref: `Documentation & Guide for ${assignedSubtopics[0] || dayTopic}`,
              practice_details: 'Read conceptual overview, inspect architecture diagrams, and take notes.',
              revision_details: 'Summarize 3 key takeaways.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Practice: ${assignedSubtopics[0] || dayTopic} Guided Code Exercises`,
              type: 'PRACTICE',
              estimated_minutes: t2Mins,
              difficulty: containsWeak ? 'BEGINNER' : 'INTERMEDIATE',
              resources_ref: `Code Sandbox & Guided Notebook for ${dayTopic}`,
              practice_details: 'Implement basic code samples and run unit tests.',
              revision_details: 'Fix any syntax or runtime errors.'
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
              practice_details: 'Study design patterns and implementation structure.',
              revision_details: 'Note execution flow.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Implement: ${assignedSubtopics[1] || dayTopic} Feature Module`,
              type: 'IMPLEMENT',
              estimated_minutes: t2Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Hands-on Project Repository for ${dayTopic}`,
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
              title: `Problem Solving: ${dayTopic} Applied Challenges (3 Problems)`,
              type: 'PROBLEM_SOLVING',
              estimated_minutes: t1Mins,
              difficulty: containsStrong ? 'ADVANCED' : 'INTERMEDIATE',
              resources_ref: `Problem Set for ${dayTopic}`,
              practice_details: 'Solve 3 practical problems independently.',
              revision_details: 'Analyze time and space complexity.'
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
              title: `Learn: ${assignedSubtopics[2] || dayTopic + ' Advanced Optimization'}`,
              type: 'LEARN',
              estimated_minutes: t1Mins,
              difficulty: 'ADVANCED',
              resources_ref: `Performance & Edge Cases Deep Dive`,
              practice_details: 'Study performance bottlenecks, memory management, and edge cases.',
              revision_details: 'Highlight optimization techniques.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Implement: ${dayTopic} Performance Optimization`,
              type: 'IMPLEMENT',
              estimated_minutes: t2Mins,
              difficulty: 'ADVANCED',
              resources_ref: `Refactoring Environment`,
              practice_details: 'Optimize existing implementations for lower latency and memory overhead.',
              revision_details: 'Benchmark execution metrics.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_3`,
              title: `Practice: Edge Case Stress Testing`,
              type: 'PRACTICE',
              estimated_minutes: t3Mins,
              difficulty: 'ADVANCED',
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
              title: `Problem Solving: Mixed Domain Exercises`,
              type: 'PROBLEM_SOLVING',
              estimated_minutes: t1Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Mixed Problem Bank`,
              practice_details: 'Solve multi-concept problems combining previous topics.',
              revision_details: 'Check cross-topic dependencies.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Revision: Weak Topic Remediation (${containsWeak ? 'High Priority' : 'Standard Review'})`,
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
              title: `Revision: Consolidated Weekly Knowledge Map`,
              type: 'REVISION',
              estimated_minutes: t1Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Weekly Summary Mind Map`,
              practice_details: 'Review all concepts, formulas, and architecture patterns from Week ' + overallWeekNum,
              revision_details: 'Consolidate personal cheat-sheet.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Project: Mini Capstone Module for ${dayTopic}`,
              type: 'PROJECT',
              estimated_minutes: t2Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Mini-Project Specification`,
              practice_details: 'Build an integrated project module validating all weekly subtopics.',
              revision_details: 'Submit project code for self-evaluation.'
            }
          ];
        } else {
          const t1Mins = Math.round(dailyMinutes * 0.45);
          const t2Mins = dailyMinutes - t1Mins;
          dayTasks = [
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_1`,
              title: `Assessment: Week ${overallWeekNum} Concept Evaluation`,
              type: 'ASSESSMENT',
              estimated_minutes: t1Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Weekly Knowledge Check Quiz`,
              practice_details: 'Complete diagnostic quiz covering all week ' + overallWeekNum + ' subtopics.',
              revision_details: 'Review test score and detailed explanations.'
            },
            {
              id: `task_m${m}_w${overallWeekNum}_d${d}_2`,
              title: `Mock Test: Timed Knowledge Check`,
              type: 'MOCK_TEST',
              estimated_minutes: t2Mins,
              difficulty: 'INTERMEDIATE',
              resources_ref: `Timed Assessment Environment`,
              practice_details: 'Complete timed simulation test under interview conditions.',
              revision_details: 'Analyze score breakdown.'
            }
          ];
        }

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

  return {
    user_id,
    domain: curriculum.domainName,
    domain_id: domainKey,
    timeline_months: timelineMonths,
    daily_hours: dailyHours,
    quiz_score: overallScore,
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

      const roadmapDoc = await Roadmap.findOne({ user_id: targetUserId });
      if (!roadmapDoc) {
        return sendJSON(res, 404, {
          error: `No active roadmap found for user_id: ${targetUserId}`
        });
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