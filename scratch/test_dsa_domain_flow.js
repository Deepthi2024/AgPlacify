const http = require('http');

function requestJSON(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr)
      }
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(buf);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: buf });
        }
      });
    });
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

async function runTests() {
  console.log('\n==================================================');
  console.log('🧪 PLACIFY DSA DOMAIN FLOW INTEGRATION TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // TEST 1: Register test user
  const ts = Date.now();
  const regRes = await requestJSON('POST', '/api/auth/register', {
    name: 'DSA Tester',
    email: `dsa_tester_${ts}@example.com`,
    password: 'Password123!',
    domain: 'dsa'
  });
  const userId = (regRes.body.profile && regRes.body.profile.user_id) || (regRes.body.user && regRes.body.user.user_id);
  assert(regRes.status === 200 || regRes.status === 201, 'User Registration', `user_id: ${userId}`);

  // TEST 2: DSA Roadmap without language -> MUST fail with 400
  const noLangGen = await requestJSON('POST', '/api/roadmap/generate', {
    user_id: userId,
    domain: 'dsa'
  });
  assert(
    noLangGen.status === 400 && noLangGen.body.error && noLangGen.body.error.includes('Please select a programming language'),
    'DSA Roadmap without Language Validation (Blocked with 400)',
    `Status: ${noLangGen.status}, Error: "${noLangGen.body.error}"`
  );

  // TEST 3: Update Domain with DSA + Python
  const patchPython = await requestJSON('PATCH', `/api/user/${userId}/domain`, {
    chosen_domain: 'dsa',
    dsa_programming_language: 'Python'
  });
  assert(
    patchPython.status === 200 && patchPython.body.profile && patchPython.body.profile.dsa_programming_language === 'Python',
    'Update Domain DSA + Python',
    `Language saved: ${patchPython.body.profile ? patchPython.body.profile.dsa_programming_language : 'none'}`
  );

  // TEST 4: Generate DSA Roadmap with Python
  const genPython = await requestJSON('POST', '/api/roadmap/generate', {
    user_id: userId,
    domain: 'dsa',
    dsa_programming_language: 'Python'
  });
  assert(
    genPython.status === 200 && genPython.body.roadmap && genPython.body.roadmap.dsa_programming_language === 'Python',
    'Generate DSA Roadmap with Python',
    `Roadmap language: ${genPython.body.roadmap ? genPython.body.roadmap.dsa_programming_language : 'none'}`
  );

  if (genPython.body.roadmap && genPython.body.roadmap.monthly_roadmap) {
    const month1 = genPython.body.roadmap.monthly_roadmap[0];
    const week1 = month1 ? month1.weeks[0] : null;
    const week1Title = week1 ? (week1.subtopicName || week1.title || '') : '';
    assert(
      week1Title.toLowerCase().includes('python'),
      'DSA Python Roadmap Phase 1 starts with Python Basics',
      `Week 1 Topic: "${week1Title}"`
    );
  }

  // TEST 5: Generate DSA Roadmap with Java
  const patchJava = await requestJSON('PATCH', `/api/user/${userId}/domain`, {
    chosen_domain: 'dsa',
    dsa_programming_language: 'Java'
  });
  assert(patchJava.status === 200 && patchJava.body.profile && patchJava.body.profile.dsa_programming_language === 'Java', 'Update Domain DSA + Java', `Saved: ${patchJava.body.profile ? patchJava.body.profile.dsa_programming_language : 'none'}`);

  const genJava = await requestJSON('POST', '/api/roadmap/generate', {
    user_id: userId,
    domain: 'dsa',
    dsa_programming_language: 'Java'
  });
  assert(
    genJava.status === 200 && genJava.body.roadmap && genJava.body.roadmap.dsa_programming_language === 'Java',
    'Generate DSA Roadmap with Java',
    `Roadmap language: ${genJava.body.roadmap ? genJava.body.roadmap.dsa_programming_language : 'none'}`
  );
  if (genJava.body.roadmap && genJava.body.roadmap.monthly_roadmap) {
    const week1 = genJava.body.roadmap.monthly_roadmap[0].weeks[0];
    const week1Title = week1.subtopicName || week1.title || '';
    assert(
      week1Title.toLowerCase().includes('java'),
      'DSA Java Roadmap Phase 1 starts with Java Basics',
      `Week 1 Topic: "${week1Title}"`
    );
  }

  // TEST 6: Generate DSA Roadmap with C++
  const patchCpp = await requestJSON('PATCH', `/api/user/${userId}/domain`, {
    chosen_domain: 'dsa',
    dsa_programming_language: 'C++'
  });
  assert(patchCpp.status === 200 && patchCpp.body.profile && patchCpp.body.profile.dsa_programming_language === 'C++', 'Update Domain DSA + C++', `Saved: ${patchCpp.body.profile ? patchCpp.body.profile.dsa_programming_language : 'none'}`);

  const genCpp = await requestJSON('POST', '/api/roadmap/generate', {
    user_id: userId,
    domain: 'dsa',
    dsa_programming_language: 'C++'
  });
  assert(
    genCpp.status === 200 && genCpp.body.roadmap && genCpp.body.roadmap.dsa_programming_language === 'C++',
    'Generate DSA Roadmap with C++',
    `Roadmap language: ${genCpp.body.roadmap ? genCpp.body.roadmap.dsa_programming_language : 'none'}`
  );
  if (genCpp.body.roadmap && genCpp.body.roadmap.monthly_roadmap) {
    const week1 = genCpp.body.roadmap.monthly_roadmap[0].weeks[0];
    const week1Title = week1.subtopicName || week1.title || '';
    assert(
      week1Title.toLowerCase().includes('c++'),
      'DSA C++ Roadmap Phase 1 starts with C++ Basics',
      `Week 1 Topic: "${week1Title}"`
    );
  }

  // TEST 7: Generate DSA Roadmap with JavaScript
  const patchJs = await requestJSON('PATCH', `/api/user/${userId}/domain`, {
    chosen_domain: 'dsa',
    dsa_programming_language: 'JavaScript'
  });
  assert(patchJs.status === 200 && patchJs.body.profile && patchJs.body.profile.dsa_programming_language === 'JavaScript', 'Update Domain DSA + JavaScript', `Saved: ${patchJs.body.profile ? patchJs.body.profile.dsa_programming_language : 'none'}`);

  const genJs = await requestJSON('POST', '/api/roadmap/generate', {
    user_id: userId,
    domain: 'dsa',
    dsa_programming_language: 'JavaScript'
  });
  assert(
    genJs.status === 200 && genJs.body.roadmap && genJs.body.roadmap.dsa_programming_language === 'JavaScript',
    'Generate DSA Roadmap with JavaScript',
    `Roadmap language: ${genJs.body.roadmap ? genJs.body.roadmap.dsa_programming_language : 'none'}`
  );
  if (genJs.body.roadmap && genJs.body.roadmap.monthly_roadmap) {
    const week1 = genJs.body.roadmap.monthly_roadmap[0].weeks[0];
    const week1Title = week1.subtopicName || week1.title || '';
    assert(
      week1Title.toLowerCase().includes('javascript') || week1Title.toLowerCase().includes('js'),
      'DSA JavaScript Roadmap Phase 1 starts with JavaScript Basics',
      `Week 1 Topic: "${week1Title}"`
    );
  }

  // TEST 8: Non-DSA Domain (Full-Stack Web Development) -> NO language required, works normally
  const fsdReg = await requestJSON('POST', '/api/auth/register', {
    name: 'FSD Tester',
    email: `fsd_tester_${ts}@example.com`,
    password: 'Password123!',
    domain: 'fullstack'
  });
  const fsdUser = (fsdReg.body.profile && fsdReg.body.profile.user_id) || (fsdReg.body.user && fsdReg.body.user.user_id);
  const genFsd = await requestJSON('POST', '/api/roadmap/generate', {
    user_id: fsdUser,
    domain: 'fullstack'
  });
  assert(
    genFsd.status === 200 && genFsd.body.roadmap && !genFsd.body.roadmap.dsa_programming_language,
    'Non-DSA Domain (Full-Stack) Unaffected',
    `Status: ${genFsd.status}, domain: ${genFsd.body.roadmap ? genFsd.body.roadmap.domain : ''}`
  );

  // TEST 9: Non-DSA Domain (Cybersecurity) -> Unaffected
  const cyberReg = await requestJSON('POST', '/api/auth/register', {
    name: 'Cyber Tester',
    email: `cyber_tester_${ts}@example.com`,
    password: 'Password123!',
    domain: 'cybersecurity'
  });
  const cyberUser = (cyberReg.body.profile && cyberReg.body.profile.user_id) || (cyberReg.body.user && cyberReg.body.user.user_id);
  const genCyber = await requestJSON('POST', '/api/roadmap/generate', {
    user_id: cyberUser,
    domain: 'cybersecurity'
  });
  assert(
    genCyber.status === 200 && genCyber.body.roadmap && !genCyber.body.roadmap.dsa_programming_language,
    'Non-DSA Domain (Cybersecurity) Unaffected',
    `Status: ${genCyber.status}`
  );

  // TEST 10: Non-DSA Domain (Data Science) -> Unaffected
  const dsReg = await requestJSON('POST', '/api/auth/register', {
    name: 'DS Tester',
    email: `ds_tester_${ts}@example.com`,
    password: 'Password123!',
    domain: 'datascience'
  });
  const dsUser = (dsReg.body.profile && dsReg.body.profile.user_id) || (dsReg.body.user && dsReg.body.user.user_id);
  const genDs = await requestJSON('POST', '/api/roadmap/generate', {
    user_id: dsUser,
    domain: 'datascience'
  });
  assert(
    genDs.status === 200 && genDs.body.roadmap && !genDs.body.roadmap.dsa_programming_language,
    'Non-DSA Domain (Data Science) Unaffected',
    `Status: ${genDs.status}`
  );

  console.log('\n==================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
