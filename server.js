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
            mongoUser.current_skill_level

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
            user.current_skill_level

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

      // Update current_skill_level in user collection (`users` / `Registration`)
      let updatedUser = await User.findOneAndUpdate(
        { user_id },
        { current_skill_level: skillLevel },
        { new: true }
      );

      console.log(`✅ Saved Quiz Evaluation for user ${user_id}: ${scorePct}% (${skillLevel}) with ${topicEvaluations.length} topic evaluations`);

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