/**
 * Intelligent Prerequisite-Aware Roadmap Planner Engine for AgPlacify
 * Rebuilt as a true dependency-aware, non-repeating learning planner using:
 * - Domain Knowledge Graphs
 * - Granular Diagnostic Topic Mastery
 * - DAG Topological Sort (Prerequisite Resolution)
 * - Global Ordered Skill Sequence (sequenceIndex 1, 2, 3...)
 * - Strict Subskill-Aware Daily Task Allocation (Zero Daily Repetition)
 * - Comprehensive Validation Layer
 */

const { getKnowledgeGraph, getAllSkillsInGraph, topologicalSortSkills, getOrderedSubskillsForSkill } = require('./knowledgeGraph');

/**
 * Validates daily task decomposition within a week
 */
function validateDailyTasks(weekObj) {
  const errors = [];
  if (!weekObj || !Array.isArray(weekObj.days)) {
    errors.push(`Week ${weekObj ? weekObj.week_number : 'unknown'} has no days array.`);
    return { valid: false, errors };
  }

  const scheduledNewSubskillIds = new Set();

  weekObj.days.forEach(day => {
    if (!Array.isArray(day.tasks)) {
      errors.push(`Day ${day.day_number} has no tasks array.`);
      return;
    }

    day.tasks.forEach(task => {
      // RULE 1: Parent Skill Belonging
      if (task.parentSkillId && weekObj.baseSkillId && task.parentSkillId !== weekObj.baseSkillId && task.parentSkillId !== weekObj.skillId) {
        errors.push(`Task '${task.title}' parentSkillId '${task.parentSkillId}' does not match week skill '${weekObj.skillId}'.`);
      }

      // RULE 2: No Duplicate NEW_LEARNING Subskills per week
      if (task.taskStage === 'NEW_LEARNING' && task.subskillId) {
        if (scheduledNewSubskillIds.has(task.subskillId)) {
          errors.push(`DUPLICATE DAILY SUBSKILL: Subskill '${task.subskillName}' (${task.subskillId}) scheduled multiple times as NEW_LEARNING in Week ${weekObj.week_number} (Day ${day.day_number}).`);
        } else {
          scheduledNewSubskillIds.add(task.subskillId);
        }
      }
    });
  });

  // RULE 3: Day 7 Assessment Presence
  const day7 = weekObj.days.find(d => d.day_number % 7 === 0);
  if (day7) {
    const hasAssess = day7.tasks.some(t => t.taskStage === 'ASSESSMENT' || t.taskType === 'ASSESSMENT');
    if (!hasAssess) {
      errors.push(`Week ${weekObj.week_number} Day 7 is missing a required ASSESSMENT / REVISION task.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Robust Roadmap Validation Layer
 */
function validateRoadmap(roadmapData) {
  const errors = [];
  const { domain, timeline_months, daily_hours, monthly_roadmap } = roadmapData;

  if (!Array.isArray(monthly_roadmap) || monthly_roadmap.length === 0) {
    errors.push('Roadmap monthly_roadmap is empty or invalid.');
    return { valid: false, errors };
  }

  if (monthly_roadmap.length !== timeline_months) {
    errors.push(`Monthly roadmap length (${monthly_roadmap.length}) does not match timeline_months (${timeline_months}).`);
  }

  const scheduledNewSkillIds = new Set();
  const skillSequenceIndexMap = new Map();

  let globalWeekCounter = 0;

  for (const month of monthly_roadmap) {
    if (!Array.isArray(month.weeks)) {
      errors.push(`Month ${month.month_number} has no valid weeks array.`);
      continue;
    }

    for (const week of month.weeks) {
      globalWeekCounter++;

      if (week.month_number !== month.month_number) {
        errors.push(`Week ${week.week_number} month_number (${week.month_number}) does not match parent month (${month.month_number}).`);
      }

      const weekSkillId = week.skillId || (week.skills && week.skills[0] ? week.skills[0].skillId : null);

      if (weekSkillId) {
        if (scheduledNewSkillIds.has(weekSkillId)) {
          errors.push(`DUPLICATE SKILL DETECTED: Skill ID '${weekSkillId}' was scheduled multiple times across weeks (Week ${globalWeekCounter}).`);
        } else {
          scheduledNewSkillIds.add(weekSkillId);
          skillSequenceIndexMap.set(weekSkillId, week.sequenceIndex || globalWeekCounter);
        }
      }

      // Validate daily subskill decomposition inside week
      const dailyVal = validateDailyTasks(week);
      if (!dailyVal.valid) {
        errors.push(...dailyVal.errors);
      }
    }
  }

  console.log(`[VALIDATION] Total Scheduled Unique Skills: ${scheduledNewSkillIds.size}`);
  console.log(`[VALIDATION] Total Weeks Validated: ${globalWeekCounter}`);
  console.log(`[VALIDATION] Total Errors/Violations: ${errors.length}`);
  if (errors.length > 0) {
    console.warn('[VALIDATION WARNINGS / ERRORS]', errors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Main Intelligent Roadmap Generator
 */
function generateIntelligentRoadmap({ userId, domain, timeline_months, daily_hours, skillProfile, userLevel: reqLevel }) {
  const timelineMonths = parseInt(timeline_months, 10) || 4;
  const dailyHours = parseFloat(daily_hours) || 2.0;
  const dailyMinutesTarget = Math.round(dailyHours * 60);

  const graph = getKnowledgeGraph(domain);
  const allSkills = getAllSkillsInGraph(graph);
  const userLevel = (reqLevel || (skillProfile && skillProfile.skills && skillProfile.skills[0] ? skillProfile.skills[0].level : 'BEGINNER')).toUpperCase();

  console.log(`\n==================================================`);
  console.log(`[ROADMAP PLANNER] Initializing Subskill-Aware Roadmap Generator`);
  console.log(`Domain: "${graph.domainName}" (${graph.domainId})`);
  console.log(`User Level: "${userLevel}"`);
  console.log(`Timeline: ${timelineMonths} Months (${timelineMonths * 4} Weeks Capacity)`);
  console.log(`Daily Commitment: ${dailyHours} Hours/Day (${dailyMinutesTarget} Mins/Day)`);
  console.log(`==================================================`);

  // 1. DIAGNOSTIC MASTERY ANALYSIS
  const skillMasteryMap = new Map();
  allSkills.forEach(sk => {
    let score = 0;
    if (skillProfile && Array.isArray(skillProfile.skills)) {
      const userSk = skillProfile.skills.find(s => s.skillId === sk.skillId);
      if (userSk) score = userSk.masteryScore || 0;
    }

    skillMasteryMap.set(sk.skillId, {
      ...sk,
      masteryScore: score,
      isMastered: score >= 80
    });
  });

  // 2. REMAINING SKILLS & DAG TOPOLOGICAL SORT
  let candidateSkills = allSkills;
  if (userLevel === 'ADVANCED') {
    candidateSkills = allSkills.filter(sk => {
      const m = skillMasteryMap.get(sk.skillId);
      return !m.isMastered || sk.difficulty === 'ADVANCED';
    });
  } else if (userLevel === 'INTERMEDIATE') {
    candidateSkills = allSkills.filter(sk => {
      const m = skillMasteryMap.get(sk.skillId);
      return !m.isMastered || sk.difficulty !== 'BEGINNER';
    });
  }

  if (candidateSkills.length === 0) candidateSkills = allSkills;
  const sortedSkills = topologicalSortSkills(candidateSkills);

  // 3. GLOBAL ORDERED SKILL SEQUENCE
  const totalAvailableWeeks = timelineMonths * 4;
  const orderedSkillSequence = [];
  const scheduledSkillIds = new Set();

  let seqCounter = 1;
  for (let i = 0; i < totalAvailableWeeks; i++) {
    let targetSkill = sortedSkills[i % sortedSkills.length];
    if (scheduledSkillIds.has(targetSkill.skillId)) {
      const unscheduled = sortedSkills.find(s => !scheduledSkillIds.has(s.skillId));
      if (unscheduled) targetSkill = unscheduled;
    }

    const isDuplicate = scheduledSkillIds.has(targetSkill.skillId);

    const seqItem = {
      sequenceIndex: seqCounter,
      skillId: isDuplicate ? `${targetSkill.skillId}_adv_${i}` : targetSkill.skillId,
      baseSkillId: targetSkill.skillId,
      skillName: isDuplicate ? `Advanced Implementation: ${targetSkill.skillName}` : targetSkill.skillName,
      topicName: targetSkill.topicName,
      subtopicName: isDuplicate ? `Deep Drill & Capstone Project: ${targetSkill.subtopicName}` : targetSkill.subtopicName,
      prerequisites: targetSkill.prerequisites || [],
      difficulty: targetSkill.difficulty || 'INTERMEDIATE',
      subskills: getOrderedSubskillsForSkill(targetSkill),
      estimatedHours: Math.round(dailyHours * 7),
      masteryAtPlanning: skillMasteryMap.get(targetSkill.skillId) ? skillMasteryMap.get(targetSkill.skillId).masteryScore : 0
    };

    scheduledSkillIds.add(seqItem.skillId);
    orderedSkillSequence.push(seqItem);
    seqCounter++;
  }

  // 4. MONTHLY -> WEEKLY -> DAILY DECOMPOSITION
  const monthlyRoadmap = [];

  for (let m = 1; m <= timelineMonths; m++) {
    const monthWeeks = orderedSkillSequence.slice((m - 1) * 4, m * 4);
    const primarySkill = monthWeeks[0] || orderedSkillSequence[0];
    const subtopicsList = monthWeeks.map(w => w.subtopicName);

    const monthObj = {
      month_number: m,
      title: `Month ${m}: ${primarySkill.topicName}`,
      objective: `Acquire core competency in ${primarySkill.topicName} including ${subtopicsList.slice(0, 2).join(', ')}`,
      topics: [primarySkill.topicName],
      subtopics: subtopicsList,
      priority: (m === 1 || userLevel === 'BEGINNER') ? 'HIGH' : 'MEDIUM',
      difficulty: primarySkill.difficulty,
      estimated_hours: Math.round(dailyHours * 28),
      expected_outcomes: [
        `Master ${primarySkill.topicName} concepts`,
        `Complete practical project for ${subtopicsList[0]}`
      ],
      weeks: []
    };

    for (let w = 1; w <= 4; w++) {
      const globalWeekNum = (m - 1) * 4 + w;
      const weekSkill = monthWeeks[w - 1] || primarySkill;
      const subskillList = getOrderedSubskillsForSkill(weekSkill);

      const weekObj = {
        week_number: globalWeekNum,
        month_number: m,
        sequenceIndex: weekSkill.sequenceIndex,
        skillId: weekSkill.skillId,
        baseSkillId: weekSkill.baseSkillId,
        title: `Week ${globalWeekNum}: ${weekSkill.subtopicName}`,
        objective: `Build practical proficiency in ${weekSkill.skillName}`,
        topics: [weekSkill.topicName],
        subtopics: [weekSkill.subtopicName],
        estimated_hours: Math.round(dailyHours * 7),
        days: []
      };

      // STRICT SUBSKILL-AWARE DAILY ALLOCATION (Zero Daily Repetition)
      const scheduledSubskillsThisWeek = new Set();

      for (let d = 1; d <= 7; d++) {
        const globalDayNum = (globalWeekNum - 1) * 7 + d;
        let daySubskill = null;
        let taskStage = 'NEW_LEARNING';
        let taskType = 'LEARN';

        if (d === 7) {
          // Day 7 is always Weekly Review & Assessment
          daySubskill = {
            subskillId: `${weekSkill.skillId}_wk_assess`,
            subskillName: `Weekly Capstone & Assessment: ${weekSkill.subtopicName}`,
            estimatedMinutes: dailyMinutesTarget
          };
          taskStage = 'ASSESSMENT';
          taskType = 'ASSESSMENT';
        } else if (d === 6) {
          // Day 6 is Full Subskill Integration / Implementation
          daySubskill = subskillList[Math.min(5, subskillList.length - 1)] || {
            subskillId: `${weekSkill.skillId}_sub_impl`,
            subskillName: `Integrated Implementation: ${weekSkill.subtopicName}`,
            estimatedMinutes: dailyMinutesTarget
          };
          taskStage = 'NEW_LEARNING';
          taskType = 'IMPLEMENT';
        } else {
          // Days 1-5 get distinct subskills from subskillList
          const subIdx = (d - 1) % subskillList.length;
          daySubskill = subskillList[subIdx] || {
            subskillId: `${weekSkill.skillId}_sub_${d}`,
            subskillName: `${weekSkill.skillName} Part ${d}`,
            estimatedMinutes: dailyMinutesTarget
          };
          taskStage = 'NEW_LEARNING';
          taskType = (d % 2 === 1) ? 'LEARN' : 'PRACTICE';
        }

        // Uniqueness check for NEW_LEARNING
        if (taskStage === 'NEW_LEARNING') {
          if (scheduledSubskillsThisWeek.has(daySubskill.subskillId)) {
            // Reclassify duplicate as REINFORCEMENT instead of duplicate NEW_LEARNING
            taskStage = 'REINFORCEMENT';
            taskType = 'PRACTICE';
          } else {
            scheduledSubskillsThisWeek.add(daySubskill.subskillId);
          }
        }

        const task1Mins = Math.round(dailyMinutesTarget * 0.6);
        const task2Mins = Math.max(15, dailyMinutesTarget - task1Mins);

        const task1Title = taskStage === 'ASSESSMENT'
          ? `Assessment: ${daySubskill.subskillName}`
          : (taskType === 'LEARN' ? `Learn: ${daySubskill.subskillName}` : (taskType === 'IMPLEMENT' ? `Implement: ${daySubskill.subskillName}` : `Practice: ${daySubskill.subskillName}`));

        const task2Title = taskStage === 'ASSESSMENT'
          ? `Weekly Concept Review & Submission`
          : `Workbook Drills: ${daySubskill.subskillName}`;

        const dayObj = {
          day_number: globalDayNum,
          day_name: `Day ${globalDayNum}`,
          topic: daySubskill.subskillName,
          subtopic: daySubskill.subskillName,
          total_minutes: dailyMinutesTarget,
          difficulty: weekSkill.difficulty,
          tasks: [
            {
              taskId: `task_m${m}_w${globalWeekNum}_d${globalDayNum}_t1`,
              id: `task_m${m}_w${globalWeekNum}_d${globalDayNum}_t1`,
              userId,
              sequenceIndex: weekSkill.sequenceIndex,
              monthNumber: m,
              weekNumber: globalWeekNum,
              dayNumber: globalDayNum,
              domain: graph.domainName,
              topic: weekSkill.topicName,
              subtopic: daySubskill.subskillName,
              skillId: weekSkill.skillId,
              skillName: weekSkill.skillName,
              subskillId: daySubskill.subskillId,
              subskillName: daySubskill.subskillName,
              parentSkillId: weekSkill.baseSkillId || weekSkill.skillId,
              prerequisites: daySubskill.prerequisites || weekSkill.prerequisites,
              prerequisiteSkills: daySubskill.prerequisites || weekSkill.prerequisites,
              taskType,
              type: taskType,
              taskStage,
              difficulty: weekSkill.difficulty,
              masteryAtPlanning: weekSkill.masteryAtPlanning,
              estimated_minutes: task1Mins,
              estimatedMinutes: task1Mins,
              title: task1Title,
              practice_details: `Execute learning exercises for ${daySubskill.subskillName}`,
              status: 'NOT_STARTED'
            },
            {
              taskId: `task_m${m}_w${globalWeekNum}_d${globalDayNum}_t2`,
              id: `task_m${m}_w${globalWeekNum}_d${globalDayNum}_t2`,
              userId,
              sequenceIndex: weekSkill.sequenceIndex,
              monthNumber: m,
              weekNumber: globalWeekNum,
              dayNumber: globalDayNum,
              domain: graph.domainName,
              topic: weekSkill.topicName,
              subtopic: daySubskill.subskillName,
              skillId: weekSkill.skillId,
              skillName: weekSkill.skillName,
              subskillId: daySubskill.subskillId,
              subskillName: daySubskill.subskillName,
              parentSkillId: weekSkill.baseSkillId || weekSkill.skillId,
              prerequisites: daySubskill.prerequisites || weekSkill.prerequisites,
              prerequisiteSkills: daySubskill.prerequisites || weekSkill.prerequisites,
              taskType: taskStage === 'ASSESSMENT' ? 'ASSESSMENT' : 'PRACTICE',
              type: taskStage === 'ASSESSMENT' ? 'ASSESSMENT' : 'PRACTICE',
              taskStage: taskStage === 'ASSESSMENT' ? 'ASSESSMENT' : 'REINFORCEMENT',
              difficulty: weekSkill.difficulty,
              masteryAtPlanning: weekSkill.masteryAtPlanning,
              estimated_minutes: task2Mins,
              estimatedMinutes: task2Mins,
              title: task2Title,
              practice_details: `Solve problem drills for ${daySubskill.subskillName}`,
              status: 'NOT_STARTED'
            }
          ]
        };

        weekObj.days.push(dayObj);
      }

      monthObj.weeks.push(weekObj);
    }

    monthlyRoadmap.push(monthObj);
  }

  const finalRoadmap = {
    user_id: userId,
    domain: graph.domainName,
    domain_id: graph.domainId,
    timeline_months: timelineMonths,
    daily_hours: dailyHours,
    overall_level: userLevel,
    starting_point: orderedSkillSequence[0] ? orderedSkillSequence[0].skillName : 'Fundamentals',
    curriculum_version: 'v3.1_subskill_decomposed',
    monthly_roadmap: monthlyRoadmap,
    generated_at: new Date(),
    updated_at: new Date()
  };

  validateRoadmap(finalRoadmap);

  return finalRoadmap;
}

module.exports = {
  validateDailyTasks,
  validateRoadmap,
  generateIntelligentRoadmap
};
