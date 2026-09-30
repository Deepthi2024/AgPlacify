const http = require('http');

function postJSON(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body = JSON.stringify(data);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('==================================================');
  console.log('🚀 TESTING IDEMPOTENCY AND NEXT INCOMPLETE DAY');
  console.log('==================================================\n');

  const userId = `test_user_idemp_${Date.now()}`;
  console.log(`📌 1. Creating roadmap for user ${userId}...`);
  const genRes = await postJSON('http://localhost:5000/api/roadmap/generate', { user_id: userId, generation_mode: 'direct' });
  const roadmap = genRes.data.roadmap;
  const roadmapId = roadmap.roadmap_id || roadmap._id;
  console.log(`✅ Roadmap ID: ${roadmapId}`);

  console.log('\n📌 2. Submitting Manual Completion for Day 1...');
  const sub1 = await postJSON('http://localhost:5000/api/roadmap/daily-assessment/submit', {
    userId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 1,
    assessmentMode: 'manual',
    completedManually: true
  });

  console.log('   Response Day 1:', sub1.data);
  if (sub1.data.dayCompleted && sub1.data.nextIncompleteDay === 2) {
    console.log('✅ Day 1 completed successfully! nextIncompleteDay = 2');
  } else {
    console.error('❌ Day 1 completion error:', sub1.data);
    process.exit(1);
  }

  console.log('\n📌 3. Submitting DUPLICATE Completion for Day 1 (Idempotency Test)...');
  const sub1Dup = await postJSON('http://localhost:5000/api/roadmap/daily-assessment/submit', {
    userId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 1,
    assessmentMode: 'manual',
    completedManually: true
  });

  console.log('   Response Duplicate Day 1:', sub1Dup.data);
  if (sub1Dup.data.alreadyCompleted && sub1Dup.data.nextIncompleteDay === 2) {
    console.log('✅ IDEMPOTENCY PASSED! Duplicate submission returned alreadyCompleted: true and nextIncompleteDay = 2');
  } else {
    console.error('❌ Idempotency test failed:', sub1Dup.data);
    process.exit(1);
  }

  console.log('\n📌 4. Submitting Quiz Completion for Day 2 (Score 35% - Low Score progression test)...');
  const sub2 = await postJSON('http://localhost:5000/api/roadmap/daily-assessment/submit', {
    userId,
    roadmapId,
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 2,
    assessmentMode: 'quiz',
    userAnswers: { q1: 0 },
    questions: [{ id: 'q1', question: 'Test Q', options: ['A', 'B'], correct: 1, topic: 'Python' }]
  });

  console.log('   Response Day 2 (Quiz 0%):', sub2.data);
  if (sub2.data.dayCompleted && sub2.data.nextIncompleteDay === 3) {
    console.log('✅ LOW SCORE PROGRESSION PASSED! Day 2 completed (score 0%) and nextIncompleteDay = 3');
  } else {
    console.error('❌ Low score progression failed:', sub2.data);
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('🎉 ALL IDEMPOTENCY & PROGRESSION TESTS PASSED 100%!');
  console.log('==================================================');
}

run().catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
});
