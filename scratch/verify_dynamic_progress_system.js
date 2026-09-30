const assert = require('assert');
const http = require('http');

function requestJSON(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', err => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runProgressVerificationSuite() {
  console.log('====================================================');
  console.log('📌 STARTING DYNAMIC PROGRESS SYSTEM VERIFICATION SUITE');
  console.log('====================================================\n');

  const testUserId = `test_progress_user_${Date.now()}`;
  const localDate = '2026-09-05';
  const timezone = 'Asia/Kolkata';

  // STEP 1: Generate dynamic roadmap for test user
  console.log('1. Generating dynamic roadmap for test user...');
  const genRes = await requestJSON('POST', '/api/roadmap/generate', {
    user_id: testUserId,
    domain: 'datascience',
    timeline_months: 4,
    daily_hours: 2,
    current_skill_level: 'BEGINNER',
    target_skill_level: 'ADVANCED'
  });

  assert.strictEqual(genRes.status, 200, 'Roadmap generation must succeed');
  assert.ok(genRes.data.success, 'Roadmap generation response must be successful');
  const roadmapObj = genRes.data.personalizedRoadmap || genRes.data.roadmap;
  const roadmapId = roadmapObj ? (roadmapObj._id || roadmapObj.roadmap_id) : 'test_rd';
  console.log(`   ✅ Roadmap generated with ID: ${roadmapId}\n`);

  // STEP 2: Fetch initial progress
  console.log('2. Fetching initial roadmap progress...');
  const p1Res = await requestJSON('GET', `/api/roadmap/progress/${testUserId}/${roadmapId}?clientLocalDate=${localDate}&clientTimezone=${timezone}`);
  assert.strictEqual(p1Res.status, 200, 'Progress API must return 200');
  const p1 = p1Res.data.progress;
  console.log('   Initial Progress:', JSON.stringify(p1.overall));
  assert.strictEqual(p1.overall.percent, 0, 'Initial overall progress must be 0%');
  assert.strictEqual(p1.overall.completedDays, 0, 'Initial completed days must be 0');
  assert.strictEqual(p1.assessment.quizzesTaken, 0, 'Initial quizzes taken must be 0');
  console.log('   ✅ Initial progress is cleanly 0%.\n');

  // STEP 3: Submit Manual Completion for Day 1
  console.log('3. Submitting Manual Completion for Day 1...');
  const mRes = await requestJSON('POST', '/api/roadmap/daily-assessment/submit', {
    userId: testUserId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 1,
    assessmentMode: 'manual',
    completedManually: true,
    completedDateLocal: localDate,
    completedTimezone: timezone
  });

  assert.strictEqual(mRes.status, 200, 'Manual submission must succeed');
  assert.ok(mRes.data.progress, 'Response must contain updated progress object');
  const p2 = mRes.data.progress;
  console.log('   Progress after Day 1 Manual Completion:', JSON.stringify(p2.overall));
  assert.strictEqual(p2.overall.completedDays, 1, 'Completed days must be 1');
  assert.ok(p2.overall.percent > 0, 'Overall percent must be > 0%');
  assert.strictEqual(p2.assessment.quizzesTaken, 0, 'Manual completion MUST NOT increase quizzesTaken');
  assert.strictEqual(p2.revision.requiredTopicsCount, 0, 'Manual completion MUST NOT create revision items');
  console.log('   ✅ Day 1 manual completion correctly updated completion progress while keeping quiz stats 0.\n');

  // STEP 4: Submit Quiz Completion with 20% score for Day 2
  console.log('4. Submitting Quiz Completion (20% score) for Day 2...');
  const qRes = await requestJSON('POST', '/api/roadmap/daily-assessment/submit', {
    userId: testUserId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 2,
    assessmentMode: 'quiz',
    completedManually: false,
    userAnswers: { q1: 0, q2: 1, q3: 1, q4: 1, q5: 1 },
    questions: [
      { id: 'q1', topic: 'Python Basics', correct: 0 },
      { id: 'q2', topic: 'Python Basics', correct: 0 },
      { id: 'q3', topic: 'Python Basics', correct: 0 },
      { id: 'q4', topic: 'Python Basics', correct: 0 },
      { id: 'q5', topic: 'Python Basics', correct: 0 }
    ],
    completedDateLocal: localDate,
    completedTimezone: timezone
  });

  assert.strictEqual(qRes.status, 200, 'Quiz submission must succeed');
  const p3 = qRes.data.progress;
  console.log('   Progress after Day 2 Quiz Completion:', JSON.stringify(p3.overall));
  console.log('   Quiz Statistics:', JSON.stringify(p3.assessment));
  console.log('   Sunday Revision Status:', JSON.stringify(p3.revision));

  assert.strictEqual(p3.overall.completedDays, 2, 'Completed days must be 2');
  assert.strictEqual(p3.assessment.quizzesTaken, 1, 'Quizzes taken must be 1');
  assert.strictEqual(p3.assessment.averageScore, 20, 'Quiz average score must record actual quiz score (20%)');
  assert.ok(p3.revision.requiredTopicsCount > 0 || qRes.data.dayAssessment.needsRevision, 'Low quiz score must trigger Sunday Revision topic');
  console.log('   ✅ Quiz completion (20% score) marked Day 2 as 100% completed for roadmap progress, while recording 20% under quiz performance & triggering revision.\n');

  // STEP 5: Idempotency Check (Submit Day 1 again)
  console.log('5. Testing Idempotency (Submitting Day 1 Manual Completion again)...');
  const mRes2 = await requestJSON('POST', '/api/roadmap/daily-assessment/submit', {
    userId: testUserId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 1,
    assessmentMode: 'manual',
    completedManually: true,
    completedDateLocal: localDate,
    completedTimezone: timezone
  });

  assert.strictEqual(mRes2.status, 200, 'Re-submission must succeed');
  assert.strictEqual(mRes2.data.alreadyCompleted, true, 'Response must indicate day was already completed');
  const p4Res = await requestJSON('GET', `/api/roadmap/progress/${testUserId}/${roadmapId}?clientLocalDate=${localDate}&clientTimezone=${timezone}`);
  const p4 = p4Res.data.progress;
  assert.strictEqual(p4.overall.completedDays, 2, 'Re-submitting completed day MUST NOT double-count progress');
  console.log('   ✅ Idempotency test passed! Completed days remain 2.\n');

  console.log('====================================================');
  console.log('🎉 ALL DYNAMIC PROGRESS VERIFICATION TESTS PASSED!');
  console.log('====================================================\n');
}

runProgressVerificationSuite().catch(err => {
  console.error('❌ VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
