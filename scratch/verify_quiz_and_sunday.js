const assert = require('assert');

function parseLocalDate(dStr) {
  if (!dStr) return null;
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

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

console.log('=== TEST 1: SUNDAY REVISION DATE ASSIGNMENT RULE ===');
// User example: Sunday is 21st (e.g. June 21, 2026), Monday is 22nd (June 22, 2026).
// Monday 22nd topic must go to next Sunday (June 28, 2026).
const sun21 = getUpcomingSundayDate('2026-06-21');
const mon22 = getUpcomingSundayDate('2026-06-22');
const tue23 = getUpcomingSundayDate('2026-06-23');
const sat27 = getUpcomingSundayDate('2026-06-27');
const sun28 = getUpcomingSundayDate('2026-06-28');

console.log('Sunday June 21 target:', sun21);
console.log('Monday June 22 target:', mon22);
console.log('Tuesday June 23 target:', tue23);
console.log('Saturday June 27 target:', sat27);
console.log('Sunday June 28 target:', sun28);

assert.strictEqual(sun21, '2026-06-21', 'Sunday 21 target must be 2026-06-21');
assert.strictEqual(mon22, '2026-06-28', 'Monday 22 target must be 2026-06-28 (next Sunday)');
assert.strictEqual(tue23, '2026-06-28', 'Tuesday 23 target must be 2026-06-28');
assert.strictEqual(sat27, '2026-06-28', 'Saturday 27 target must be 2026-06-28');
assert.strictEqual(sun28, '2026-06-28', 'Sunday 28 target must be 2026-06-28');
console.log('✅ TEST 1 PASSED: Monday 22nd successfully targets upcoming Sunday 28th!\n');

console.log('=== TEST 2: QUIZ GENERATION & EVALUATION TEST ===');
async function runQuizGenTest() {
  const http = require('http');
  const postData = JSON.stringify({
    userId: 'test_user_qa',
    roadmapId: 'test_roadmap_qa',
    monthNumber: 1,
    weekNumber: 1,
    dayNumber: 5,
    topic: 'Pandas DataFrames & Manipulation',
    subtopics: ['Pandas DataFrames & Manipulation'],
    domain: 'datascience',
    level: 'INTERMEDIATE',
    questionCount: 5
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/roadmap/daily-assessment/generate',
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
        const data = JSON.parse(body);
        console.log('Quiz Gen Response Status:', res.statusCode);
        console.log('Quiz Questions Count:', data.questions ? data.questions.length : 0);
        assert.ok(data.success, 'Quiz generation must succeed');
        assert.ok(Array.isArray(data.questions) && data.questions.length === 5, 'Must generate 5 questions');

        data.questions.forEach((q, i) => {
          console.log(`Q${i+1} [${q.type}]: ${q.question.substring(0, 60)}...`);
          console.log(`   Options count: ${q.options ? q.options.length : 0}`);
          if (q.options && q.options.length > 0) {
            assert.ok(q.options.length >= 2, `Question ${i+1} must have options if options array is present`);
          } else {
            console.log(`   (Rendered as Text Input Box on UI)`);
          }
        });

        console.log('\n✅ TEST 2 PASSED: Quiz generated with complete question structures!');
      } catch (err) {
        console.error('❌ TEST 2 FAILED:', err.message);
        process.exit(1);
      }
    });
  });

  req.on('error', err => {
    console.error('❌ Request error:', err.message);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

runQuizGenTest();
