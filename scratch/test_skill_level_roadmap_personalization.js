const assert = require('assert');
const { generateIntelligentRoadmap } = require('../backend/engine/roadmapPlanner');
const { buildUserSkillProfile } = require('../backend/engine/skillProfiler');

console.log(`\n========================================================================`);
console.log(` 🧪 RUNNING PLACIFY FULL PERSONALIZATION & DYNAMIC ROADMAP TEST SUITE`);
console.log(`========================================================================\n`);

let testsPassed = 0;

// ----------------------------------------------------------------------
// TEST 1: Diagnostic Quiz Personalization (User A 90% vs User B 20%)
// ----------------------------------------------------------------------
console.log(`------------------------------------------------------------------------`);
console.log(`TEST 1: Diagnostic Quiz Personalization (High 90% vs Low 20%)`);
console.log(`------------------------------------------------------------------------`);

const userA_eval = {
  score_pct: 90,
  is_self_assessed: false,
  topic_evaluations: [
    { topic: 'Python', score_pct: 95, proficiency_level: 'STRONG' },
    { topic: 'Statistics', score_pct: 90, proficiency_level: 'STRONG' },
    { topic: 'Pandas', score_pct: 88, proficiency_level: 'STRONG' }
  ]
};

const userB_eval = {
  score_pct: 20,
  is_self_assessed: false,
  topic_evaluations: [
    { topic: 'Python', score_pct: 20, proficiency_level: 'WEAK' },
    { topic: 'Statistics', score_pct: 10, proficiency_level: 'WEAK' },
    { topic: 'Pandas', score_pct: 30, proficiency_level: 'WEAK' }
  ]
};

const profileA = buildUserSkillProfile({
  userId: 'user_A',
  domain: 'datascience',
  quizEvaluation: userA_eval,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED'
});

const profileB = buildUserSkillProfile({
  userId: 'user_B',
  domain: 'datascience',
  quizEvaluation: userB_eval,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED'
});

const rmA = generateIntelligentRoadmap({
  userId: 'user_A',
  domain: 'datascience',
  timeline_months: 6,
  daily_hours: 2,
  skillProfile: profileA,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED',
  quizEvaluation: userA_eval
});

const rmB = generateIntelligentRoadmap({
  userId: 'user_B',
  domain: 'datascience',
  timeline_months: 6,
  daily_hours: 2,
  skillProfile: profileB,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED',
  quizEvaluation: userB_eval
});

const firstMonthTitleA = rmA.monthly_roadmap[0].title;
const firstMonthTitleB = rmB.monthly_roadmap[0].title;
const firstWeekTitleA = rmA.monthly_roadmap[0].weeks[0].title;
const firstWeekTitleB = rmB.monthly_roadmap[0].weeks[0].title;

console.log(`User A (90%) Month 1 Title: "${firstMonthTitleA}"`);
console.log(`User B (20%) Month 1 Title: "${firstMonthTitleB}"`);
console.log(`User A (90%) Week 1 Focus: "${firstWeekTitleA}"`);
console.log(`User B (20%) Week 1 Focus: "${firstWeekTitleB}"`);

assert.notStrictEqual(JSON.stringify(rmA.monthly_roadmap), JSON.stringify(rmB.monthly_roadmap), "User A and User B roadmaps MUST NOT be identical!");
assert.notStrictEqual(firstMonthTitleA, firstMonthTitleB, "User A and User B Month 1 titles MUST NOT be identical!");
console.log(`✅ TEST 1 PASSED: Diagnostic scores dynamically change monthly titles and content.\n`);
testsPassed++;


// ----------------------------------------------------------------------
// TEST 2: Beginner vs Intermediate vs Advanced Starting Point (Req 23)
// ----------------------------------------------------------------------
console.log(`------------------------------------------------------------------------`);
console.log(`TEST 2: Starting Level Personalization (BEGINNER vs INTERMEDIATE vs ADVANCED)`);
console.log(`------------------------------------------------------------------------`);

const rmBeg = generateIntelligentRoadmap({
  userId: 'user_beg',
  domain: 'datascience',
  timeline_months: 6,
  daily_hours: 2,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED'
});

const rmInt = generateIntelligentRoadmap({
  userId: 'user_int',
  domain: 'datascience',
  timeline_months: 6,
  daily_hours: 2,
  currentSkillLevel: 'INTERMEDIATE',
  targetSkillLevel: 'ADVANCED'
});

const rmAdv = generateIntelligentRoadmap({
  userId: 'user_adv',
  domain: 'datascience',
  timeline_months: 6,
  daily_hours: 2,
  currentSkillLevel: 'ADVANCED',
  targetSkillLevel: 'ADVANCED'
});

console.log(`BEGINNER Month 1 Title: "${rmBeg.monthly_roadmap[0].title}" | Starting Skill: "${rmBeg.monthly_roadmap[0].weeks[0].skillId}"`);
console.log(`INTERMEDIATE Month 1 Title: "${rmInt.monthly_roadmap[0].title}" | Starting Skill: "${rmInt.monthly_roadmap[0].weeks[0].skillId}"`);
console.log(`ADVANCED Month 1 Title: "${rmAdv.monthly_roadmap[0].title}" | Starting Skill: "${rmAdv.monthly_roadmap[0].weeks[0].skillId}"`);

assert.notStrictEqual(rmBeg.monthly_roadmap[0].title, rmInt.monthly_roadmap[0].title, "Beginner and Intermediate Month 1 titles must differ!");
assert.notStrictEqual(rmInt.monthly_roadmap[0].title, rmAdv.monthly_roadmap[0].title, "Intermediate and Advanced Month 1 titles must differ!");
assert.notStrictEqual(rmBeg.monthly_roadmap[0].weeks[0].skillId, rmInt.monthly_roadmap[0].weeks[0].skillId, "Beginner and Intermediate starting skills must differ!");
console.log(`✅ TEST 2 PASSED: Starting level directly controls the initial roadmap content.\n`);
testsPassed++;


// ----------------------------------------------------------------------
// TEST 3: Timeline Personalization (3 Months vs 6 Months vs 12 Months) (Req 25)
// ----------------------------------------------------------------------
console.log(`------------------------------------------------------------------------`);
console.log(`TEST 3: Timeline Pacing (3 Months vs 6 Months vs 12 Months)`);
console.log(`------------------------------------------------------------------------`);

const rm3m = generateIntelligentRoadmap({
  userId: 'user_t3',
  domain: 'datascience',
  timeline_months: 3,
  daily_hours: 2,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED'
});

const rm6m = generateIntelligentRoadmap({
  userId: 'user_t6',
  domain: 'datascience',
  timeline_months: 6,
  daily_hours: 2,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED'
});

const rm12m = generateIntelligentRoadmap({
  userId: 'user_t12',
  domain: 'datascience',
  timeline_months: 12,
  daily_hours: 2,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED'
});

console.log(`3-Month Roadmap Length: ${rm3m.monthly_roadmap.length} Months (${rm3m.monthly_roadmap.length * 4} Weeks)`);
console.log(`6-Month Roadmap Length: ${rm6m.monthly_roadmap.length} Months (${rm6m.monthly_roadmap.length * 4} Weeks)`);
console.log(`12-Month Roadmap Length: ${rm12m.monthly_roadmap.length} Months (${rm12m.monthly_roadmap.length * 4} Weeks)`);

assert.strictEqual(rm3m.monthly_roadmap.length, 3, "3-month roadmap must contain exactly 3 monthly modules");
assert.strictEqual(rm6m.monthly_roadmap.length, 6, "6-month roadmap must contain exactly 6 monthly modules");
assert.strictEqual(rm12m.monthly_roadmap.length, 12, "12-month roadmap must contain exactly 12 monthly modules");
console.log(`✅ TEST 3 PASSED: Timeline changes roadmap duration and monthly pacing.\n`);
testsPassed++;


// ----------------------------------------------------------------------
// TEST 4: Daily Hours Workload Scaling (1 Hour vs 2 Hours vs 4 Hours) (Req 26)
// ----------------------------------------------------------------------
console.log(`------------------------------------------------------------------------`);
console.log(`TEST 4: Daily Hours Workload Scaling (1h vs 2h vs 4h)`);
console.log(`------------------------------------------------------------------------`);

const rm1h = generateIntelligentRoadmap({
  userId: 'user_h1',
  domain: 'datascience',
  timeline_months: 6,
  daily_hours: 1,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED'
});

const rm2h = generateIntelligentRoadmap({
  userId: 'user_h2',
  domain: 'datascience',
  timeline_months: 6,
  daily_hours: 2,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED'
});

const rm4h = generateIntelligentRoadmap({
  userId: 'user_h4',
  domain: 'datascience',
  timeline_months: 6,
  daily_hours: 4,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED'
});

const monthHours1h = rm1h.monthly_roadmap[0].estimated_hours;
const monthHours2h = rm2h.monthly_roadmap[0].estimated_hours;
const monthHours4h = rm4h.monthly_roadmap[0].estimated_hours;

console.log(`1 Hour/Day  -> Monthly Hours: ${monthHours1h} Hours | Day 1 Task Count: ${rm1h.monthly_roadmap[0].weeks[0].days[0].tasks.length}`);
console.log(`2 Hours/Day -> Monthly Hours: ${monthHours2h} Hours | Day 1 Task Count: ${rm2h.monthly_roadmap[0].weeks[0].days[0].tasks.length}`);
console.log(`4 Hours/Day -> Monthly Hours: ${monthHours4h} Hours | Day 1 Task Count: ${rm4h.monthly_roadmap[0].weeks[0].days[0].tasks.length}`);

assert.strictEqual(monthHours1h, 28, "1 hour/day monthly workload must be 28 hours (not 56)");
assert.strictEqual(monthHours2h, 56, "2 hours/day monthly workload must be 56 hours");
assert.strictEqual(monthHours4h, 112, "4 hours/day monthly workload must be 112 hours (not 56)");
assert.ok(monthHours4h > monthHours2h && monthHours2h > monthHours1h, "Monthly hours must scale with daily hours!");
console.log(`✅ TEST 4 PASSED: Monthly and daily workload scale dynamically with daily hours (56 hours is NOT hardcoded).\n`);
testsPassed++;


// ----------------------------------------------------------------------
// TEST 5: Full Profile Combination Test (Req 27)
// ----------------------------------------------------------------------
console.log(`------------------------------------------------------------------------`);
console.log(`TEST 5: Full Combination Test (User A vs User B vs User C)`);
console.log(`------------------------------------------------------------------------`);

const combA = generateIntelligentRoadmap({
  userId: 'comb_A',
  domain: 'datascience',
  timeline_months: 3,
  daily_hours: 1,
  currentSkillLevel: 'BEGINNER',
  targetSkillLevel: 'ADVANCED',
  quizEvaluation: userB_eval
});

const combB = generateIntelligentRoadmap({
  userId: 'comb_B',
  domain: 'datascience',
  timeline_months: 6,
  daily_hours: 2,
  currentSkillLevel: 'INTERMEDIATE',
  targetSkillLevel: 'ADVANCED',
  quizEvaluation: userA_eval
});

const combC = generateIntelligentRoadmap({
  userId: 'comb_C',
  domain: 'datascience',
  timeline_months: 12,
  daily_hours: 4,
  currentSkillLevel: 'ADVANCED',
  targetSkillLevel: 'ADVANCED',
  quizEvaluation: null
});

console.log(`User A (Beg, Low Quiz, 3m, 1h) -> ${combA.monthly_roadmap.length}m, ${combA.monthly_roadmap[0].estimated_hours}h/mo, Title: "${combA.monthly_roadmap[0].title}"`);
console.log(`User B (Int, High Quiz, 6m, 2h) -> ${combB.monthly_roadmap.length}m, ${combB.monthly_roadmap[0].estimated_hours}h/mo, Title: "${combB.monthly_roadmap[0].title}"`);
console.log(`User C (Adv, Direct, 12m, 4h)   -> ${combC.monthly_roadmap.length}m, ${combC.monthly_roadmap[0].estimated_hours}h/mo, Title: "${combC.monthly_roadmap[0].title}"`);

assert.notStrictEqual(combA.monthly_roadmap.length, combB.monthly_roadmap.length);
assert.notStrictEqual(combB.monthly_roadmap.length, combC.monthly_roadmap.length);
assert.notStrictEqual(combA.monthly_roadmap[0].estimated_hours, combC.monthly_roadmap[0].estimated_hours);
assert.notStrictEqual(combA.monthly_roadmap[0].title, combB.monthly_roadmap[0].title);
console.log(`✅ TEST 5 PASSED: Full combinations produce completely unique personalized roadmaps.\n`);
testsPassed++;

console.log(`========================================================================`);
console.log(` 🎉 ALL ${testsPassed}/5 FULL PERSONALIZATION TEST SUITES PASSED CLEANLY!`);
console.log(`========================================================================\n`);
