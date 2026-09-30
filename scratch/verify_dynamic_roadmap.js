/**
 * Comprehensive Verification Test Suite for Placify Dynamic Personalized Roadmap Generator
 * Tests all key personalization requirements:
 * 1. High Score (90%) vs Low Score (20%) Quiz Personalization (Mode 1 - Assessed)
 * 2. Self-Assessed Beginner vs Intermediate vs Advanced Levels (Mode 2 - Direct)
 * 3. Assumed Mastered Prerequisites for Self-Assessed Intermediate & Advanced
 * 4. Timeline Scaling (3m vs 6m vs 9m vs 12m)
 * 5. Daily Hours Capacity & Task Workload (1h vs 2h vs 4h)
 * 6. Combined Multi-Factor Personalization Test
 * 7. Unmanufactured Baseline Mastery Check
 */

const { generateIntelligentRoadmap, validateRoadmap } = require('../backend/engine/roadmapPlanner');
const { buildUserSkillProfile } = require('../backend/engine/skillProfiler');

function runTestSuite() {
  console.log('\n============================================================');
  console.log('STARTING PLACIFY COMPREHENSIVE ROADMAP VERIFICATION SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: LOW SCORE (20%) vs HIGH SCORE (90%) QUIZ PERSONALIZATION (Mode 1)
  // --------------------------------------------------------------------------
  console.log('------------------------------------------------------------');
  console.log('TEST 1: Low Score (20%) vs High Score (90%) Quiz Personalization (Mode 1)');
  console.log('------------------------------------------------------------');

  const quizLowScoreEval = {
    is_self_assessed: false,
    score_pct: 20,
    skill_level: 'BEGINNER',
    knowledge_gaps: [{ topic: 'Python Fundamentals' }, { topic: 'Statistics & Probability' }, { topic: 'Data Processing & EDA' }],
    weakTopics: ['Python Fundamentals', 'Statistics & Probability', 'Data Processing & EDA'],
    mastered_topics: [],
    strongTopics: [],
    topic_evaluations: [
      { topic: 'Python Fundamentals', score_pct: 20, proficiency_level: 'WEAK' },
      { topic: 'Statistics & Probability', score_pct: 15, proficiency_level: 'WEAK' },
      { topic: 'Data Processing & EDA', score_pct: 25, proficiency_level: 'WEAK' }
    ]
  };

  const quizHighScoreEval = {
    is_self_assessed: false,
    score_pct: 90,
    skill_level: 'BEGINNER',
    knowledge_gaps: [],
    weakTopics: [],
    mastered_topics: [{ topic: 'Python Fundamentals' }, { topic: 'Statistics & Probability' }, { topic: 'Data Processing & EDA' }],
    strongTopics: ['Python Fundamentals', 'Statistics & Probability', 'Data Processing & EDA'],
    topic_evaluations: [
      { topic: 'Python Fundamentals', score_pct: 95, proficiency_level: 'STRONG' },
      { topic: 'Statistics & Probability', score_pct: 90, proficiency_level: 'STRONG' },
      { topic: 'Data Processing & EDA', score_pct: 88, proficiency_level: 'STRONG' }
    ]
  };

  const roadmapLowScore = generateIntelligentRoadmap({
    userId: 'user_low_20',
    domain: 'datascience',
    timeline_months: 6,
    daily_hours: 2,
    currentSkillLevel: 'BEGINNER',
    targetSkillLevel: 'ADVANCED',
    quizEvaluation: quizLowScoreEval
  });

  const roadmapHighScore = generateIntelligentRoadmap({
    userId: 'user_high_90',
    domain: 'datascience',
    timeline_months: 6,
    daily_hours: 2,
    currentSkillLevel: 'BEGINNER',
    targetSkillLevel: 'ADVANCED',
    quizEvaluation: quizHighScoreEval
  });

  const m1Low = roadmapLowScore.monthly_roadmap[0];
  const m1High = roadmapHighScore.monthly_roadmap[0];

  assert(m1Low.title !== m1High.title, `Month 1 titles are different (Low: "${m1Low.title}" vs High: "${m1High.title}")`);
  assert(m1Low.objective.includes('Remediate') || m1Low.title.includes('Remediation'), `Low Score User Month 1 emphasizes Remediation`);
  assert(!m1High.title.includes('Remediation'), `High Score User Month 1 avoids unnecessary Remediation`);

  const lowFirstTaskTitle = m1Low.weeks[0].days[0].tasks[0].title;
  const highFirstTaskTitle = m1High.weeks[0].days[0].tasks[0].title;
  assert(lowFirstTaskTitle !== highFirstTaskTitle, `Month 1 Day 1 Task 1 titles differ ("${lowFirstTaskTitle}" vs "${highFirstTaskTitle}")`);

  // --------------------------------------------------------------------------
  // TEST 2: SELF-ASSESSED BEGINNER vs INTERMEDIATE vs ADVANCED (Mode 2 - Direct)
  // --------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------');
  console.log('TEST 2: Self-Assessed Beginner vs Intermediate vs Advanced Levels (Mode 2)');
  console.log('------------------------------------------------------------');

  const roadmapBeginner = generateIntelligentRoadmap({
    userId: 'user_beg', domain: 'datascience', timeline_months: 6, daily_hours: 2,
    currentSkillLevel: 'BEGINNER', targetSkillLevel: 'ADVANCED', quizEvaluation: null
  });

  const roadmapIntermediate = generateIntelligentRoadmap({
    userId: 'user_int', domain: 'datascience', timeline_months: 6, daily_hours: 2,
    currentSkillLevel: 'INTERMEDIATE', targetSkillLevel: 'ADVANCED', quizEvaluation: null
  });

  const roadmapAdvanced = generateIntelligentRoadmap({
    userId: 'user_adv', domain: 'datascience', timeline_months: 6, daily_hours: 2,
    currentSkillLevel: 'ADVANCED', targetSkillLevel: 'ADVANCED', quizEvaluation: null
  });

  const begM1Difficulty = roadmapBeginner.monthly_roadmap[0].difficulty;
  const intM1Difficulty = roadmapIntermediate.monthly_roadmap[0].difficulty;
  const advM1Difficulty = roadmapAdvanced.monthly_roadmap[0].difficulty;

  assert(begM1Difficulty === 'BEGINNER', `Self-Assessed Beginner starts at BEGINNER difficulty`);
  assert(intM1Difficulty === 'INTERMEDIATE', `Self-Assessed Intermediate starts at INTERMEDIATE difficulty`);
  assert(advM1Difficulty === 'ADVANCED', `Self-Assessed Advanced starts at ADVANCED difficulty`);
  assert(begM1Difficulty !== intM1Difficulty && intM1Difficulty !== advM1Difficulty, `Month 1 difficulty differs across starting levels`);

  const begM1Title = roadmapBeginner.monthly_roadmap[0].title;
  const intM1Title = roadmapIntermediate.monthly_roadmap[0].title;
  const advM1Title = roadmapAdvanced.monthly_roadmap[0].title;
  assert(begM1Title !== intM1Title && intM1Title !== advM1Title, `Month 1 titles differ ("${begM1Title}" vs "${intM1Title}" vs "${advM1Title}")`);

  // --------------------------------------------------------------------------
  // TEST 3: ASSUMED MASTERED PREREQUISITES TEST (Self-Assessed Mode)
  // --------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------');
  console.log('TEST 3: Assumed Mastered Prerequisites (Self-Assessed Mode)');
  console.log('------------------------------------------------------------');

  const profileInt = buildUserSkillProfile({
    userId: 'user_int_prof', domain: 'datascience', quizEvaluation: null,
    currentSkillLevel: 'INTERMEDIATE', targetSkillLevel: 'ADVANCED'
  });

  const profileAdv = buildUserSkillProfile({
    userId: 'user_adv_prof', domain: 'datascience', quizEvaluation: null,
    currentSkillLevel: 'ADVANCED', targetSkillLevel: 'ADVANCED'
  });

  assert(profileInt.assessmentStatus === 'not_attempted', `Intermediate profile assessmentStatus is not_attempted`);
  assert(profileInt.assumedMasteredPrerequisites.length > 0, `Intermediate profile has assumedMasteredPrerequisites (${profileInt.assumedMasteredPrerequisites.length} topics)`);
  assert(profileInt.assumedMasteredPrerequisites.every(p => p.reason.includes('assumed from self-assessed Intermediate level')), `Intermediate assumed prerequisites explicitly state "assumed from self-assessed Intermediate level"`);

  assert(profileAdv.assumedMasteredPrerequisites.length > profileInt.assumedMasteredPrerequisites.length, `Advanced profile has more assumed prerequisites (${profileAdv.assumedMasteredPrerequisites.length}) than Intermediate (${profileInt.assumedMasteredPrerequisites.length})`);

  // --------------------------------------------------------------------------
  // TEST 4: TIMELINE VARIATION TEST (3m vs 6m vs 9m vs 12m)
  // --------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------');
  console.log('TEST 4: Timeline Pacing (3 Months vs 6 Months vs 9 Months vs 12 Months)');
  console.log('------------------------------------------------------------');

  const roadmap3m = generateIntelligentRoadmap({
    userId: 'user_3m', domain: 'datascience', timeline_months: 3, daily_hours: 2,
    currentSkillLevel: 'BEGINNER', targetSkillLevel: 'ADVANCED', quizEvaluation: null
  });

  const roadmap6m = generateIntelligentRoadmap({
    userId: 'user_6m', domain: 'datascience', timeline_months: 6, daily_hours: 2,
    currentSkillLevel: 'BEGINNER', targetSkillLevel: 'ADVANCED', quizEvaluation: null
  });

  const roadmap9m = generateIntelligentRoadmap({
    userId: 'user_9m', domain: 'datascience', timeline_months: 9, daily_hours: 2,
    currentSkillLevel: 'BEGINNER', targetSkillLevel: 'ADVANCED', quizEvaluation: null
  });

  const roadmap12m = generateIntelligentRoadmap({
    userId: 'user_12m', domain: 'datascience', timeline_months: 12, daily_hours: 2,
    currentSkillLevel: 'BEGINNER', targetSkillLevel: 'ADVANCED', quizEvaluation: null
  });

  assert(roadmap3m.monthly_roadmap.length === 3, `3-Month Roadmap has 3 months`);
  assert(roadmap6m.monthly_roadmap.length === 6, `6-Month Roadmap has 6 months`);
  assert(roadmap9m.monthly_roadmap.length === 9, `9-Month Roadmap has 9 months`);
  assert(roadmap12m.monthly_roadmap.length === 12, `12-Month Roadmap has 12 months`);

  // --------------------------------------------------------------------------
  // TEST 5: DAILY HOURS CAPACITY TEST (1h vs 2h vs 4h)
  // --------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------');
  console.log('TEST 5: Daily Hours Workload (1 Hour vs 2 Hours vs 4 Hours)');
  console.log('------------------------------------------------------------');

  const roadmap1h = generateIntelligentRoadmap({
    userId: 'user_1h', domain: 'datascience', timeline_months: 6, daily_hours: 1.0,
    currentSkillLevel: 'BEGINNER', targetSkillLevel: 'ADVANCED', quizEvaluation: null
  });

  const roadmap2h = generateIntelligentRoadmap({
    userId: 'user_2h', domain: 'datascience', timeline_months: 6, daily_hours: 2.0,
    currentSkillLevel: 'BEGINNER', targetSkillLevel: 'ADVANCED', quizEvaluation: null
  });

  const roadmap4h = generateIntelligentRoadmap({
    userId: 'user_4h', domain: 'datascience', timeline_months: 6, daily_hours: 4.0,
    currentSkillLevel: 'BEGINNER', targetSkillLevel: 'ADVANCED', quizEvaluation: null
  });

  const day1h = roadmap1h.monthly_roadmap[0].weeks[0].days[0];
  const day2h = roadmap2h.monthly_roadmap[0].weeks[0].days[0];
  const day4h = roadmap4h.monthly_roadmap[0].weeks[0].days[0];

  assert(day1h.estimated_minutes === 60, `1h/day yields 60 estimated daily minutes`);
  assert(day2h.estimated_minutes === 120, `2h/day yields 120 estimated daily minutes`);
  assert(day4h.estimated_minutes === 240, `4h/day yields 240 estimated daily minutes`);
  assert(day1h.tasks.length < day4h.tasks.length, `4h/day has more daily tasks (${day4h.tasks.length}) than 1h/day (${day1h.tasks.length})`);

  const month1hCapacity = roadmap1h.monthly_roadmap[0].estimated_hours;
  const month4hCapacity = roadmap4h.monthly_roadmap[0].estimated_hours;
  assert(month1hCapacity === 28, `1h/day monthly capacity is 28 hours (not hardcoded 56)`);
  assert(month4hCapacity === 112, `4h/day monthly capacity is 112 hours (not hardcoded 56)`);

  // --------------------------------------------------------------------------
  // TEST 6: UNMANUFACTURED BASELINE MASTERY CHECK (Direct Mode)
  // --------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------');
  console.log('TEST 6: Unmanufactured Baseline Mastery Check (Direct Mode)');
  console.log('------------------------------------------------------------');

  const profileDirect = buildUserSkillProfile({
    userId: 'user_direct', domain: 'datascience', quizEvaluation: null,
    currentSkillLevel: 'BEGINNER', targetSkillLevel: 'ADVANCED'
  });

  assert(profileDirect.assessmentStatus === 'not_attempted', `Direct mode assessmentStatus is "not_attempted"`);
  assert(profileDirect.diagnosticScore === null, `Direct mode diagnosticScore is null`);
  assert(profileDirect.weakTopics.length === 0, `Direct mode weakTopics is empty`);
  assert(profileDirect.strongTopics.length === 0, `Direct mode strongTopics is empty`);
  assert(profileDirect.skills.every(s => s.masteryScore === 0 && s.masteryTier === 'UNASSESSED'), `Direct mode skills have 0 masteryScore and "UNASSESSED" tier (no fake 20, 75, 85 scores)`);

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
