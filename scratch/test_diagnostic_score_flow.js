const http = require('http');
const assert = require('assert');

function postJSON(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
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
          resolve(JSON.parse(responseBody));
        } catch (e) {
          resolve(responseBody);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJSON(urlStr) {
  return new Promise((resolve, reject) => {
    http.get(urlStr, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseBody));
        } catch (e) {
          resolve(responseBody);
        }
      });
    }).on('error', reject);
  });
}

async function verifyAllScoreCases() {
  console.log('🧪 Starting Multi-Case Diagnostic Score Data Flow Verification...\n');

  // CASE 1: Quiz Evaluation with 80% Score
  console.log('▶️ CASE 1: Quiz Completed with 80% Score');
  const user1Email = `score80_${Date.now()}@placify.ai`;
  const reg1 = await postJSON('http://localhost:5000/api/auth/register', {
    name: 'Score 80 Tester',
    email: user1Email,
    password: 'password123',
    chosen_domain: 'fullstack'
  });
  const u1 = (reg1.profile && reg1.profile.user_id) || reg1.user_id || (reg1.user && reg1.user.user_id);

  const eval1 = await postJSON('http://localhost:5000/api/quiz/evaluate', {
    user_id: u1,
    domain: 'Full-Stack Web Development',
    answers: [
      { question_id: 'fs_js_q1', chosen_option_index: 1 },
      { question_id: 'fs_js_q2', chosen_option_index: 2 },
      { question_id: 'fs_js_q3', chosen_option_index: 0 },
      { question_id: 'fs_js_q4', chosen_option_index: 0 }
    ]
  });

  const rm1 = await postJSON('http://localhost:5000/api/roadmap/generate', {
    user_id: u1,
    quizEvaluation: eval1.evaluation
  });

  const score1 = eval1.evaluation.score_pct !== undefined ? eval1.evaluation.score_pct : eval1.evaluation.scorePct;
  assert.strictEqual(rm1.roadmap.quiz_score, score1, `Case 1 POST roadmap.quiz_score must match ${score1}% (got ${rm1.roadmap.quiz_score})`);
  const fetchedRm1 = await getJSON(`http://localhost:5000/api/roadmap/user/${u1}`);
  assert.strictEqual(fetchedRm1.roadmap.quiz_score, score1, `Case 1 GET roadmap.quiz_score must match ${score1}% (got ${fetchedRm1.roadmap.quiz_score})`);
  console.log(`   ✅ PASS: Diagnostic score ${score1}% correctly persisted & retrieved!\n`);

  // CASE 2: Quiz Evaluation with 65% Score
  console.log('▶️ CASE 2: Quiz Completed with 65% Score');
  const user2Email = `score65_${Date.now()}@placify.ai`;
  const reg2 = await postJSON('http://localhost:5000/api/auth/register', {
    name: 'Score 65 Tester',
    email: user2Email,
    password: 'password123',
    chosen_domain: 'datascience'
  });
  const u2 = (reg2.profile && reg2.profile.user_id) || reg2.user_id || (reg2.user && reg2.user.user_id);

  const eval2 = await postJSON('http://localhost:5000/api/quiz/evaluate', {
    user_id: u2,
    domain: 'Data Science & Machine Learning',
    answers: [
      { question_id: 'ds_ml_q1', chosen_option_index: 2 },
      { question_id: 'ds_ml_q2', chosen_option_index: 1 },
      { question_id: 'ds_ml_q3', chosen_option_index: 0 },
      { question_id: 'ds_ml_q4', chosen_option_index: 0 },
      { question_id: 'ds_ml_q5', chosen_option_index: 1.6 }
    ]
  });

  const rm2 = await postJSON('http://localhost:5000/api/roadmap/generate', {
    user_id: u2,
    quizEvaluation: eval2.evaluation
  });

  const score2 = eval2.evaluation.score_pct !== undefined ? eval2.evaluation.score_pct : eval2.evaluation.scorePct;
  assert.strictEqual(rm2.roadmap.quiz_score, score2, `Case 2 POST roadmap.quiz_score must match ${score2}% (got ${rm2.roadmap.quiz_score})`);
  const fetchedRm2 = await getJSON(`http://localhost:5000/api/roadmap/user/${u2}`);
  assert.strictEqual(fetchedRm2.roadmap.quiz_score, score2, `Case 2 GET roadmap.quiz_score must match ${score2}% (got ${fetchedRm2.roadmap.quiz_score})`);
  console.log(`   ✅ PASS: Diagnostic score ${score2}% correctly persisted & retrieved!\n`);

  // CASE 3: Directed Level Preserved Independently
  console.log('▶️ CASE 3: Quiz Score Preserved & Directed Level = ADVANCED');
  const user3Email = `score_adv_${Date.now()}@placify.ai`;
  const reg3 = await postJSON('http://localhost:5000/api/auth/register', {
    name: 'Directed Advanced Tester',
    email: user3Email,
    password: 'password123',
    chosen_domain: 'cybersecurity'
  });
  const u3 = (reg3.profile && reg3.profile.user_id) || reg3.user_id || (reg3.user && reg3.user.user_id);

  // Set user directed level to ADVANCED
  await postJSON('http://localhost:5000/api/user/route', {
    user_id: u3,
    last_route: 'roadmap',
    current_skill_level: 'ADVANCED'
  });

  const eval3 = await postJSON('http://localhost:5000/api/quiz/evaluate', {
    user_id: u3,
    domain: 'Cybersecurity & Ethical Hacking',
    answers: [
      { question_id: 'sec_q1', chosen_option_index: 1 },
      { question_id: 'sec_q2', chosen_option_index: 1 },
      { question_id: 'sec_q3', chosen_option_index: 0 }
    ]
  });

  const rm3 = await postJSON('http://localhost:5000/api/roadmap/generate', {
    user_id: u3,
    quizEvaluation: eval3.evaluation
  });

  const score3 = eval3.evaluation.score_pct !== undefined ? eval3.evaluation.score_pct : eval3.evaluation.scorePct;
  assert.strictEqual(rm3.roadmap.quiz_score, score3, `Case 3 roadmap.quiz_score must match ${score3}% (got ${rm3.roadmap.quiz_score})`);
  const fetchedUser3 = await getJSON(`http://localhost:5000/api/user/${u3}`);
  assert.strictEqual(fetchedUser3.profile.current_skill_level, 'ADVANCED', 'Case 3 directed level ADVANCED must be preserved');
  console.log(`   ✅ PASS: Directed level ADVANCED and Diagnostic score ${score3}% preserved independently!\n`);

  console.log('🎉 ========================================================');
  console.log('🎉 ALL DIAGNOSTIC SCORE FLOW VERIFICATION CASES PASSED!');
  console.log('🎉 ========================================================');
  process.exit(0);
}

verifyAllScoreCases().catch(err => {
  console.error('❌ Score verification error:', err);
  process.exit(1);
});
