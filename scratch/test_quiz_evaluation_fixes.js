const http = require('http');
const assert = require('assert');

function postJSON(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyText = JSON.stringify(data);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyText)
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(buf);
          resolve({ status: res.statusCode, json: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: buf });
        }
      });
    });
    req.on('error', reject);
    req.write(bodyText);
    req.end();
  });
}

async function runEvaluationTests() {
  console.log('=====================================================');
  console.log('   RUNNING QUIZ EVALUATION COMPREHENSIVE TEST SUITE');
  console.log('=====================================================\n');

  // Test 1: Direct submission with correct_answer provided (legacy / test script mode)
  console.log('TEST 1: Direct submission with correct_answer provided');
  const user1 = `eval_test_user_${Date.now()}`;
  const test1Payload = {
    user_id: user1,
    domain: 'Cloud Engineering & DevOps',
    answers: [
      {
        id: 'q1',
        question: 'What is Kubernetes Ingress?',
        options: ['HTTP/HTTPS Routing', 'Storage Engine', 'Database', 'CPU Governor'],
        user_answer: 0,
        correct_answer: 0,
        type: 'SINGLE_SELECT',
        topic: 'Kubernetes',
        difficulty: 'INTERMEDIATE'
      },
      {
        id: 'q2',
        question: 'Docker containers share host OS kernel?',
        options: ['True', 'False'],
        user_answer: 0,
        correct_answer: 0,
        type: 'TRUE_FALSE',
        topic: 'Containerization',
        difficulty: 'BEGINNER'
      },
      {
        id: 'q3',
        question: 'Default HTTP port number?',
        user_answer: '80',
        correct_answer: '80',
        type: 'NUMERICAL',
        topic: 'Networking',
        difficulty: 'BEGINNER'
      },
      {
        id: 'q4',
        question: 'What tool provisions cloud infrastructure declaratively using HCL?',
        user_answer: 'terraform',
        correct_answer: 'Terraform',
        type: 'SHORT_ANSWER',
        topic: 'IaC',
        difficulty: 'INTERMEDIATE'
      }
    ]
  };

  const res1 = await postJSON('http://localhost:5000/api/quiz/evaluate', test1Payload);
  assert.strictEqual(res1.status, 200, `Expected status 200, got ${res1.status}`);
  assert.strictEqual(res1.json.evaluation.score_pct, 100, `Expected 100% score, got ${res1.json.evaluation.score_pct}%`);
  assert.strictEqual(res1.json.evaluation.correct_count, 4, `Expected 4 correct answers`);
  console.log('✅ TEST 1 PASSED: 100% score evaluated correctly for direct question payload!');

  // Test 2: Full flow - Quiz Generation + Answer Evaluation using quizAttemptId lookup
  console.log('\nTEST 2: Generate dynamic quiz & submit answers via quizAttemptId');
  const user2 = `eval_gen_user_${Date.now()}`;
  const genRes = await postJSON('http://localhost:5000/api/quiz/generate', {
    userId: user2,
    domain: 'Full-Stack Web Development',
    level: 'BEGINNER',
    questionCount: 4
  });

  assert.strictEqual(genRes.status, 200, `Quiz gen failed: ${genRes.status}`);
  const quizAttemptId = genRes.json.quizAttemptId;
  const questions = genRes.json.questions;
  assert.ok(quizAttemptId, 'quizAttemptId should be returned');
  assert.ok(questions.length >= 4, `Should return at least 4 questions, got ${questions.length}`);
  assert.strictEqual(questions[0].correct_answer, undefined, 'correct_answer MUST be stripped from frontend payload');

  console.log(`Generated quiz attempt ${quizAttemptId} with ${questions.length} questions.`);

  // Submit answers using quizAttemptId without sending correct_answer
  const submittedAnswers = questions.map((q, idx) => ({
    id: q.id,
    user_answer: (idx % 2 === 0) ? 0 : 1 // select option 0 for even questions, 1 for odd
  }));

  const evalRes2 = await postJSON('http://localhost:5000/api/quiz/evaluate', {
    user_id: user2,
    domain: 'Full-Stack Web Development',
    quizAttemptId: quizAttemptId,
    answers: submittedAnswers
  });

  assert.strictEqual(evalRes2.status, 200, `Quiz eval failed: ${evalRes2.status}`);
  assert.ok(typeof evalRes2.json.evaluation.score_pct === 'number', 'score_pct must be numeric');
  assert.ok(Array.isArray(evalRes2.json.evaluation.answers), 'answers list must be returned');
  assert.strictEqual(evalRes2.json.evaluation.answers.length, questions.length, `Evaluated answers count should match ${questions.length}`);

  const evaluatedQ1 = evalRes2.json.evaluation.answers[0];
  console.log('evaluatedQ1:', JSON.stringify(evaluatedQ1, null, 2));
  assert.ok(evaluatedQ1.correct_answer !== undefined, 'Server MUST populate correct_answer in evaluation report');
  assert.ok(typeof evaluatedQ1.is_correct === 'boolean', 'is_correct MUST be boolean');

  console.log(`Evaluated Score: ${evalRes2.json.evaluation.score_pct}% (${evalRes2.json.evaluation.correct_count}/4 correct)`);
  console.log('✅ TEST 2 PASSED: quizAttemptId server-side lookup evaluated correct answers!');

  // Test 3: Short Answer & Fill Blank normalization test
  console.log('\nTEST 3: Short Answer / Fill in the blank punctuation & case normalization');
  const user3 = `eval_norm_user_${Date.now()}`;
  const test3Payload = {
    user_id: user3,
    domain: 'Data Science & Machine Learning',
    answers: [
      {
        id: 'sa1',
        question: 'What technique prevents overfitting by penalizing large weights?',
        user_answer: ' Regularization. ',
        correct_answer: 'regularization',
        type: 'SHORT_ANSWER',
        topic: 'ML Foundations'
      },
      {
        id: 'sa2',
        question: 'Library used for array manipulation in Python?',
        user_answer: 'numpy',
        correct_answer: 'NumPy / num py',
        type: 'FILL_BLANK',
        topic: 'Python ML'
      }
    ]
  };

  const evalRes3 = await postJSON('http://localhost:5000/api/quiz/evaluate', test3Payload);
  assert.strictEqual(evalRes3.status, 200);
  assert.strictEqual(evalRes3.json.evaluation.score_pct, 100, `Expected 100% score for normalized text, got ${evalRes3.json.evaluation.score_pct}%`);
  console.log('✅ TEST 3 PASSED: Text normalization correctly matched trimmed/punctuated input!');

  console.log('\n=====================================================');
  console.log('  🎉 ALL QUIZ EVALUATION TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================\n');
}

runEvaluationTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
