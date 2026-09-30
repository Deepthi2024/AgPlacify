const assert = require('assert');
const http = require('http');

function postJSON(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = JSON.stringify(data);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, json });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getJSON(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, json });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('==================================================');
  console.log('🚀 TESTING DAILY ADAPTIVE ASSESSMENT WITH TWO OPTIONS');
  console.log('==================================================\n');

  const testUserId = `user_test_assessment_${Date.now()}`;

  // 1. Generate a test roadmap first
  console.log('📌 1. Generating test roadmap...');
  const genRes = await postJSON('http://localhost:5000/api/roadmap/generate', {
    user_id: testUserId,
    domain: 'fullstack',
    timeline_months: 3,
    daily_hours: 2,
    current_skill_level: 'BEGINNER',
    target_skill_level: 'ADVANCED'
  });

  assert.strictEqual(genRes.status, 200, 'Roadmap generation must return 200');
  const roadmap = genRes.json.roadmap;
  const roadmapId = roadmap._id || roadmap.roadmap_id || roadmap.id;
  assert.ok(roadmapId, 'Roadmap must have valid ID');
  console.log(`✅ Roadmap generated successfully for user "${testUserId}" (ID: ${roadmapId})\n`);

  // --------------------------------------------------
  // TEST 1: FAILED QUIZ (< 70%) ON MONDAY (DAY 1)
  // --------------------------------------------------
  console.log('📌 TEST 1: Submitting FAILED Quiz (< 70%) for Day 1 (Python Functions)...');
  const questionsDay1 = [
    { id: 'q1_d1', question: 'What does def keyword do?', topic: 'Python Functions', correct: 0 },
    { id: 'q2_d1', question: 'How to return values?', topic: 'Python Functions', correct: 1 },
    { id: 'q3_d1', question: 'What is a lambda expression?', topic: 'Python Functions', correct: 2 },
    { id: 'q4_d1', question: 'What are default arguments?', topic: 'Python Functions', correct: 0 },
    { id: 'q5_d1', question: 'What is variable scope?', topic: 'Python Functions', correct: 3 }
  ];

  // Provide only 2 correct answers out of 5 = 40%
  const answersDay1 = {
    'q1_d1': 0, // Correct
    'q2_d1': 1, // Correct
    'q3_d1': 0, // Incorrect
    'q4_d1': 2, // Incorrect
    'q5_d1': 1  // Incorrect
  };

  const submitRes1 = await postJSON('http://localhost:5000/api/roadmap/daily-assessment/submit', {
    userId: testUserId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 1,
    topic: 'Python Functions',
    assessmentMode: 'quiz',
    userAnswers: answersDay1,
    questions: questionsDay1,
    assessmentId: `quiz_d1_${Date.now()}`
  });

  assert.strictEqual(submitRes1.status, 200, 'Submit quiz must return 200');
  const day1Ass = submitRes1.json.dayAssessment;
  const sunRev1 = submitRes1.json.sundayRevision;

  console.log(`   Score: ${day1Ass.score}% | Correct: ${day1Ass.correctAnswers}/${day1Ass.totalQuestions}`);
  console.log(`   Needs Revision: ${day1Ass.needsRevision}`);
  console.log(`   Weak Topics: ${JSON.stringify(day1Ass.weakTopics)}`);

  assert.strictEqual(day1Ass.score, 40, 'Score should be exactly 40%');
  assert.strictEqual(day1Ass.needsRevision, true, 'Score < 70% must set needsRevision = true');
  assert.strictEqual(sunRev1.hasQuizRevisions, true, 'Sunday Revision must be active');
  assert.ok(sunRev1.topics.some(t => t.topic.includes('Python Functions')), 'Python Functions must be added to Sunday Revision');
  console.log('✅ TEST 1 PASSED: Failed quiz score (40%) correctly added topic to Sunday Revision.\n');

  // --------------------------------------------------
  // TEST 2: SUCCESSFUL QUIZ (>= 70%) ON WEDNESDAY (DAY 3)
  // --------------------------------------------------
  console.log('📌 TEST 2: Submitting SUCCESSFUL Quiz (100%) for Day 3 (Statistics)...');
  const questionsDay3 = [
    { id: 'q1_d3', question: 'What is mean?', topic: 'Statistics', correct: 0 },
    { id: 'q2_d3', question: 'What is median?', topic: 'Statistics', correct: 1 },
    { id: 'q3_d3', question: 'What is mode?', topic: 'Statistics', correct: 2 },
    { id: 'q4_d3', question: 'What is standard deviation?', topic: 'Statistics', correct: 0 },
    { id: 'q5_d3', question: 'What is variance?', topic: 'Statistics', correct: 3 }
  ];

  // Provide 5 correct answers out of 5 = 100%
  const answersDay3 = {
    'q1_d3': 0, 'q2_d3': 1, 'q3_d3': 2, 'q4_d3': 0, 'q5_d3': 3
  };

  const submitRes3 = await postJSON('http://localhost:5000/api/roadmap/daily-assessment/submit', {
    userId: testUserId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 3,
    topic: 'Statistics',
    assessmentMode: 'quiz',
    userAnswers: answersDay3,
    questions: questionsDay3,
    assessmentId: `quiz_d3_${Date.now()}`
  });

  assert.strictEqual(submitRes3.status, 200);
  const day3Ass = submitRes3.json.dayAssessment;
  const sunRev3 = submitRes3.json.sundayRevision;

  console.log(`   Score: ${day3Ass.score}% | Needs Revision: ${day3Ass.needsRevision}`);
  assert.strictEqual(day3Ass.score, 100, 'Score should be 100%');
  assert.strictEqual(day3Ass.needsRevision, false, 'Score >= 70% must set needsRevision = false');
  assert.ok(!sunRev3.topics.some(t => t.topic.includes('Statistics')), 'Passed topic (Statistics) must NOT be added to Sunday Revision');
  console.log('✅ TEST 2 PASSED: Successful quiz (100%) did not trigger Sunday Revision.\n');

  // --------------------------------------------------
  // TEST 3: MANUAL COMPLETION ON TUESDAY (DAY 2) & THURSDAY (DAY 4)
  // --------------------------------------------------
  console.log('📌 TEST 3: Marking Day 2 (Pandas) and Day 4 (NumPy) Complete Manually...');
  const submitRes2 = await postJSON('http://localhost:5000/api/roadmap/daily-assessment/submit', {
    userId: testUserId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 2,
    topic: 'Pandas DataFrames',
    assessmentMode: 'manual',
    completedManually: true
  });

  assert.strictEqual(submitRes2.status, 200);
  const day2Ass = submitRes2.json.dayAssessment;

  console.log(`   Day 2 Mode: ${day2Ass.assessmentMode} | Completed: ${day2Ass.completedManually} | Score: ${day2Ass.score}`);
  assert.strictEqual(day2Ass.assessmentMode, 'manual');
  assert.strictEqual(day2Ass.completedManually, true);
  assert.strictEqual(day2Ass.score, null, 'Manual completion score must be null');
  assert.strictEqual(day2Ass.needsRevision, false, 'Manual completion needsRevision must be false');
  assert.deepStrictEqual(day2Ass.weakTopics, [], 'Manual completion weakTopics must be empty');

  const submitRes4 = await postJSON('http://localhost:5000/api/roadmap/daily-assessment/submit', {
    userId: testUserId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 4,
    topic: 'NumPy Arrays',
    assessmentMode: 'manual',
    completedManually: true
  });
  assert.strictEqual(submitRes4.status, 200);

  console.log('✅ TEST 3 PASSED: Manual completion recorded cleanly with null score and no weak topics.\n');

  // --------------------------------------------------
  // TEST 4: MIXED WEEK SUNDAY REVISION VERIFICATION
  // --------------------------------------------------
  console.log('📌 TEST 4: Verifying Sunday Revision for the mixed week...');
  const getSunRes = await getJSON(`http://localhost:5000/api/roadmap/sunday-revision/${testUserId}/${roadmapId}/1`);
  assert.strictEqual(getSunRes.status, 200);
  const sundayRevision = getSunRes.json.sundayRevision;

  console.log('   Sunday Revision Topics:', sundayRevision.topics);
  const revTopicNames = sundayRevision.topics.map(t => t.topic);

  assert.ok(revTopicNames.includes('Python Functions'), 'Sunday Revision MUST contain Python Functions (40% quiz score)');
  assert.ok(!revTopicNames.includes('Pandas DataFrames'), 'Sunday Revision MUST NOT contain Pandas DataFrames (manual completion)');
  assert.ok(!revTopicNames.includes('NumPy Arrays'), 'Sunday Revision MUST NOT contain NumPy Arrays (manual completion)');
  assert.ok(!revTopicNames.includes('Statistics'), 'Sunday Revision MUST NOT contain Statistics (100% quiz score)');

  console.log('✅ TEST 4 PASSED: Sunday Revision contains ONLY the failed quiz topic ("Python Functions") and excludes manual/passed days.\n');

  // --------------------------------------------------
  // TEST 5: TOPIC-WISE WEAKNESS EVALUATION
  // --------------------------------------------------
  console.log('📌 TEST 5: Submitting Multi-Topic Quiz (Overall 71%, but "Statistics" topic 33%)...');
  const multiTopicQuestions7 = [
    { id: 'mq1', question: 'Python Q1', topic: 'Python Functions', correct: 0 },
    { id: 'mq2', question: 'Python Q2', topic: 'Python Functions', correct: 0 },
    { id: 'mq3', question: 'Python Q3', topic: 'Python Functions', correct: 0 },
    { id: 'mq4', question: 'Python Q4', topic: 'Python Functions', correct: 0 },
    { id: 'mq5', question: 'Stats Q1', topic: 'Statistics', correct: 0 },
    { id: 'mq6', question: 'Stats Q2', topic: 'Statistics', correct: 0 },
    { id: 'mq7', question: 'Stats Q3', topic: 'Statistics', correct: 0 }
  ];
  const userAnswersMulti = {
    'mq1': 0, 'mq2': 0, 'mq3': 0, 'mq4': 0, // Python 4/4 = 100%
    'mq5': 0, 'mq6': 1, 'mq7': 2  // Stats 1/3 = 33%
  };

  const submitRes5 = await postJSON('http://localhost:5000/api/roadmap/daily-assessment/submit', {
    userId: testUserId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 5,
    topic: 'Machine Learning',
    assessmentMode: 'quiz',
    userAnswers: userAnswersMulti,
    questions: multiTopicQuestions7,
    assessmentId: `quiz_d5_${Date.now()}`
  });

  assert.strictEqual(submitRes5.status, 200);
  const day5Ass = submitRes5.json.dayAssessment;
  const sunRev5 = submitRes5.json.sundayRevision;

  console.log(`   Overall Score: ${day5Ass.score}% | Topic Results:`, day5Ass.topicResults);
  assert.ok(day5Ass.score >= 70, 'Overall score is >= 70%');
  assert.ok(day5Ass.weakTopics.includes('Statistics'), 'Statistics must be identified as weak topic');
  assert.ok(sunRev5.topics.some(t => t.topic === 'Statistics'), 'Statistics topic MUST be added to Sunday Revision due to topic-level failure');
  console.log('✅ TEST 5 PASSED: Topic-level failure (Statistics 33%) triggered Sunday Revision despite overall quiz score >= 70%.\n');

  // --------------------------------------------------
  // TEST 6: REPEATED WEAK TOPICS PRIORITY BOOST
  // --------------------------------------------------
  console.log('📌 TEST 6: Testing repeated weak performance priority boost for "Python Functions"...');
  // Submit a second weak quiz for Python Functions on Saturday (Day 6)
  const submitRes6 = await postJSON('http://localhost:5000/api/roadmap/daily-assessment/submit', {
    userId: testUserId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 6,
    topic: 'Python Functions',
    assessmentMode: 'quiz',
    userAnswers: { 'q1_d6': 1, 'q2_d6': 1 }, // 0%
    questions: [
      { id: 'q1_d6', topic: 'Python Functions', correct: 0 },
      { id: 'q2_d6', topic: 'Python Functions', correct: 0 }
    ],
    assessmentId: `quiz_d6_${Date.now()}`
  });

  assert.strictEqual(submitRes6.status, 200);
  const sunRev6 = submitRes6.json.sundayRevision;
  const pythonRevItem = sunRev6.topics.find(t => t.topic.includes('Python Functions'));

  console.log('   Python Functions Sunday Revision item:', pythonRevItem);
  assert.ok(pythonRevItem, 'Python Functions must be present in Sunday Revision');
  assert.strictEqual(pythonRevItem.priority, 'VERY HIGH', 'Repeated weak topic must have VERY HIGH priority');
  assert.strictEqual(pythonRevItem.occurrences, 2, 'Must record 2 occurrences of weakness');
  console.log('✅ TEST 6 PASSED: Repeated weak topic received priority boost to VERY HIGH.\n');

  console.log('==================================================');
  console.log('🎉 ALL 6 DAILY ADAPTIVE ASSESSMENT VERIFICATION TESTS PASSED!');
  console.log('==================================================');
}

runTests().catch(err => {
  console.error('❌ Verification test failed:', err);
  process.exit(1);
});
