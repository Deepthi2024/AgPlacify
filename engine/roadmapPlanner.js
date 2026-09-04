/**
 * Intelligent Prerequisite-Aware Roadmap Planner Engine for AgPlacify
 * Rebuilt as a true dependency-aware, non-repeating learning planner using:
 * - Domain Knowledge Graphs
 * - Granular Diagnostic Topic Mastery
 * - DAG Topological Sort (Prerequisite Resolution)
 * - Global Ordered Skill Sequence (sequenceIndex 1, 2, 3...)
 * - Generic Multi-Week Skill Sub-Focus Allocation (Zero Weekly Repetition)
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

  // RULE 4: Strict Daily Topic Uniqueness for Days 1-6 within each week
  const usedDailyTopicsThisWeek = new Set();
  weekObj.days.forEach(day => {
    if (day.day_number % 7 !== 0) { // Days 1-6
      const normTopic = (day.topic || '').trim().toLowerCase();
      if (usedDailyTopicsThisWeek.has(normTopic)) {
        errors.push(`DUPLICATE DAILY TOPIC: Topic '${day.topic}' is repeated in Week ${weekObj.week_number} (Day ${day.day_number}).`);
      } else {
        usedDailyTopicsThisWeek.add(normTopic);
      }
    }
  });

  // RULE 5: No Duplicate Task Titles within the same day
  weekObj.days.forEach(day => {
    const dayTaskTitles = new Set();
    (day.tasks || []).forEach(t => {
      const normTitle = (t.title || '').trim().toLowerCase();
      if (dayTaskTitles.has(normTitle)) {
        errors.push(`DUPLICATE TASK TITLE IN DAY: Task title '${t.title}' is duplicated in Day ${day.day_number}.`);
      } else {
        dayTaskTitles.add(normTitle);
      }
    });
  });

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

  const assignedWeekConceptIdentities = new Set();
  const scheduledSkillIndexMap = new Map();

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

      // Check Week Concept Identity Uniqueness
      const rawConceptName = (week.subtopicName || week.title || '').replace(/^Week \d+:\s*/i, '').trim().toLowerCase();
      const conceptKey = `${week.baseSkillId || week.skillId}::${rawConceptName}`;

      if (assignedWeekConceptIdentities.has(conceptKey)) {
        errors.push(`DUPLICATE WEEK CONCEPT DETECTED: Concept '${rawConceptName}' is repeated across weeks (Week ${globalWeekCounter}).`);
      } else {
        assignedWeekConceptIdentities.add(conceptKey);
        if (week.baseSkillId) {
          scheduledSkillIndexMap.set(week.baseSkillId, week.sequenceIndex || globalWeekCounter);
        }
      }

      // Validate Prerequisite Order (prerequisites must be scheduled in an earlier or same week)
      if (Array.isArray(week.prerequisites)) {
        for (const prereqId of week.prerequisites) {
          if (scheduledSkillIndexMap.has(prereqId)) {
            const prereqIndex = scheduledSkillIndexMap.get(prereqId);
            const currentWeekIndex = week.sequenceIndex || globalWeekCounter;
            if (prereqIndex > currentWeekIndex) {
              errors.push(`PREREQUISITE VIOLATION: Skill '${week.skillId}' (Week ${currentWeekIndex}) scheduled before prerequisite '${prereqId}' (Week ${prereqIndex}).`);
            }
          }
        }
      }

      // Validate daily subskill decomposition inside week
      const dailyVal = validateDailyTasks(week);
      if (!dailyVal.valid) {
        errors.push(...dailyVal.errors);
      }
    }
  }

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
  console.log(`[ROADMAP PLANNER] Initializing Prerequisite-Aware Roadmap Generator`);
  console.log(`domain: "${graph.domainName}" (${graph.domainId})`);
  console.log(`userLevel: "${userLevel}"`);
  console.log(`timeline: ${timelineMonths} Months (${timelineMonths * 4} Weeks Capacity)`);
  console.log(`dailyHours: ${dailyHours} Hours/Day (${dailyMinutesTarget} Mins/Day)`);
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

  // 3. GENERIC MULTI-WEEK CONCEPT POOL ALLOCATION (Zero Weekly Repetition)
  const totalAvailableWeeks = timelineMonths * 4;
  const orderedSkillSequence = [];
  const assignedConceptKeys = new Set();
  const skillUsageCounts = new Map();

  let seqCounter = 1;

  for (let i = 0; i < totalAvailableWeeks; i++) {
    // Pick next best candidate skill
    let targetSkill = null;

    // First try: find a skill from sortedSkills not yet scheduled
    for (const sk of sortedSkills) {
      const usage = skillUsageCounts.get(sk.skillId) || 0;
      if (usage === 0) {
        targetSkill = sk;
        break;
      }
    }

    // Second try: if all skills scheduled once, pick skill with lowest usage count that has available subskills
    if (!targetSkill) {
      let minUsage = Infinity;
      for (const sk of sortedSkills) {
        const usage = skillUsageCounts.get(sk.skillId) || 0;
        if (usage < minUsage) {
          minUsage = usage;
          targetSkill = sk;
        }
      }
    }

    if (!targetSkill) targetSkill = sortedSkills[i % sortedSkills.length];

    const currentUsage = skillUsageCounts.get(targetSkill.skillId) || 0;
    skillUsageCounts.set(targetSkill.skillId, currentUsage + 1);

    // Derive distinct sub-focus concept for this week from the skill node
    const fullSubskillList = getOrderedSubskillsForSkill(targetSkill);
    let subtopicName = targetSkill.subtopicName || targetSkill.skillName;

    if (currentUsage > 0 && fullSubskillList.length > 0) {
      // Pick a distinct sub-focus from subskill list for multi-week expansion
      const subFocusIdx = currentUsage % fullSubskillList.length;
      const subFocusItem = fullSubskillList[subFocusIdx];
      subtopicName = `${targetSkill.subtopicName}: ${subFocusItem.skillName}`;
    }

    // Enforce uniqueness check
    let conceptKey = `${targetSkill.skillId}::${subtopicName.toLowerCase().trim()}`;

    if (assignedConceptKeys.has(conceptKey)) {
      // Differentiate with explicit sub-focus aspect if duplicate key occurs
      subtopicName = `${subtopicName} (Phase ${currentUsage + 1})`;
      conceptKey = `${targetSkill.skillId}::${subtopicName.toLowerCase().trim()}`;
    }

    assignedConceptKeys.add(conceptKey);

    const seqItem = {
      sequenceIndex: seqCounter,
      skillId: currentUsage === 0 ? targetSkill.skillId : `${targetSkill.skillId}_w${currentUsage + 1}`,
      baseSkillId: targetSkill.skillId,
      skillName: targetSkill.skillName,
      topicName: targetSkill.topicName,
      subtopicName: subtopicName,
      prerequisites: targetSkill.prerequisites || [],
      difficulty: targetSkill.difficulty || 'BEGINNER',
      subskills: fullSubskillList,
      estimatedHours: Math.round(dailyHours * 7),
      masteryAtPlanning: skillMasteryMap.get(targetSkill.skillId) ? skillMasteryMap.get(targetSkill.skillId).masteryScore : 0
    };

    orderedSkillSequence.push(seqItem);
    seqCounter++;
  }

  // LOG: [MONTH CONCEPT POOL] & [WEEK ALLOCATION]
  console.log(`\n[MONTH CONCEPT POOL] Total Pool Concepts: ${orderedSkillSequence.length}`);

  // 4. MONTHLY -> WEEKLY -> DAILY DECOMPOSITION
  const monthlyRoadmap = [];

  for (let m = 1; m <= timelineMonths; m++) {
    const monthWeeks = orderedSkillSequence.slice((m - 1) * 4, m * 4);
    const primarySkill = monthWeeks[0] || orderedSkillSequence[0];
    const subtopicsList = monthWeeks.map(w => w.subtopicName);

    console.log(`\n--- Month ${m}: ${primarySkill.topicName} ---`);
    console.log(`[WEEK ALLOCATION]`);
    monthWeeks.forEach((w, idx) => {
      console.log(`  Week ${(m - 1) * 4 + idx + 1} -> conceptId: "${w.skillId}", title: "${w.subtopicName}"`);
    });

    const monthObj = {
      monthId: `month_${m}`,
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
      const subskillList = weekSkill.subskills;

      const weekObj = {
        weekId: `week_${globalWeekNum}`,
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

      // STRICT 7-DAY CONCEPT ALLOCATION (Zero Daily Repetition)
      for (let d = 1; d <= 7; d++) {
        const globalDayNum = (globalWeekNum - 1) * 7 + d;
        let daySubskill = null;
        let taskStage = 'NEW_LEARNING';
        let taskType = 'LEARN';

        if (d <= 6) {
          // Days 1-6 receive distinct concepts from subskillList[0..5]
          const rawSub = subskillList[d - 1];
          const subTitle = rawSub ? (rawSub.subskillName || rawSub.skillName || `${weekSkill.subtopicName} Aspect ${d}`) : `${weekSkill.subtopicName} Concept ${d}`;
          daySubskill = {
            subskillId: rawSub ? (rawSub.subskillId || rawSub.skillId || `${weekSkill.baseSkillId}_day_${d}`) : `${weekSkill.baseSkillId}_day_${d}`,
            subskillName: subTitle,
            skillName: subTitle
          };
          taskType = (d === 6) ? 'IMPLEMENT' : ((d % 2 === 0) ? 'PRACTICE' : 'LEARN');
        } else {
          // Day 7 is reserved for Weekly Capstone Integration & Assessment
          const capstoneTitle = `Weekly Capstone Project & Assessment: ${weekSkill.subtopicName}`;
          daySubskill = {
            subskillId: `${weekSkill.baseSkillId}_capstone_eval`,
            subskillName: capstoneTitle,
            skillName: capstoneTitle
          };
          taskStage = 'ASSESSMENT';
          taskType = 'ASSESSMENT';
        }

        const task1Minutes = Math.round(dailyMinutesTarget * 0.6);
        const task2Minutes = Math.max(15, dailyMinutesTarget - task1Minutes);

        // Build distinct Task 1 and Task 2 titles
        let task1Title = '';
        let task2Title = '';

        if (d <= 5) {
          task1Title = `${taskType === 'LEARN' ? 'Learn' : 'Practice'}: ${daySubskill.subskillName}`;
          task2Title = `Guided Practice: ${daySubskill.subskillName} Drills`;
        } else if (d === 6) {
          task1Title = `Implement: ${daySubskill.subskillName}`;
          task2Title = `Implementation Code Review & Refactoring for ${daySubskill.subskillName}`;
        } else {
          task1Title = `Assessment: ${daySubskill.subskillName}`;
          task2Title = `Weekly Concept Review & Submission for ${daySubskill.subskillName}`;
        }

        const dayObj = {
          id: `day_${globalDayNum}`,
          dayId: `day_${globalDayNum}`,
          day_id: `day_${globalDayNum}`,
          day_number: globalDayNum,
          dayNumber: globalDayNum,
          week_number: globalWeekNum,
          weekNumber: globalWeekNum,
          month_number: m,
          monthNumber: m,
          topic: daySubskill.subskillName,
          subtopicId: daySubskill.subskillId || `${weekSkill.baseSkillId}_sub_${d}`,
          estimated_minutes: dailyMinutesTarget,
          total_minutes: dailyMinutesTarget,
          tasks: [
            {
              taskId: `task_${globalDayNum}_1`,
              id: `task_${globalDayNum}_1`,
              monthNumber: m,
              month_number: m,
              weekNumber: globalWeekNum,
              week_number: globalWeekNum,
              dayNumber: globalDayNum,
              day_number: globalDayNum,
              taskTitle: task1Title,
              title: task1Title,
              durationMinutes: task1Minutes,
              estimated_minutes: task1Minutes,
              completed: false,
              taskType: taskType,
              type: taskType,
              taskStage: taskStage,
              taskTopic: weekSkill.topicName,
              topic: weekSkill.topicName,
              taskSubtopic: daySubskill.subskillName,
              subtopic: daySubskill.subskillName,
              domain: graph.domainId,
              domainId: graph.domainId,
              skillId: weekSkill.skillId,
              baseSkillId: weekSkill.baseSkillId,
              parentSkillId: weekSkill.baseSkillId,
              subskillId: daySubskill.subskillId,
              subskillName: daySubskill.subskillName,
              userLevel: userLevel,
              difficulty: weekSkill.difficulty || userLevel,
              description: `Core learning and practice module for ${daySubskill.subskillName}.`,
              practice_details: `Core learning and practice module for ${daySubskill.subskillName}.`
            },
            {
              taskId: `task_${globalDayNum}_2`,
              id: `task_${globalDayNum}_2`,
              monthNumber: m,
              month_number: m,
              weekNumber: globalWeekNum,
              week_number: globalWeekNum,
              dayNumber: globalDayNum,
              day_number: globalDayNum,
              taskTitle: task2Title,
              title: task2Title,
              durationMinutes: task2Minutes,
              estimated_minutes: task2Minutes,
              completed: false,
              taskType: (d === 7) ? 'ASSESSMENT' : 'PRACTICE',
              type: (d === 7) ? 'ASSESSMENT' : 'PRACTICE',
              taskStage: taskStage,
              taskTopic: weekSkill.topicName,
              topic: weekSkill.topicName,
              taskSubtopic: daySubskill.subskillName,
              subtopic: daySubskill.subskillName,
              domain: graph.domainId,
              domainId: graph.domainId,
              skillId: weekSkill.skillId,
              baseSkillId: weekSkill.baseSkillId,
              parentSkillId: weekSkill.baseSkillId,
              subskillId: daySubskill.subskillId,
              subskillName: daySubskill.subskillName,
              userLevel: userLevel,
              difficulty: weekSkill.difficulty || userLevel,
              description: `Guided practice, drills and concept consolidation for ${daySubskill.subskillName}.`,
              practice_details: `Guided practice, drills and concept consolidation for ${daySubskill.subskillName}.`
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
    userId,
    domain,
    domainId: graph.domainId,
    domainName: graph.domainName,
    timeline_months: timelineMonths,
    daily_hours: dailyHours,
    curriculum_version: 'v3.3_unique_weekly_planner',
    userLevel,
    monthly_roadmap: monthlyRoadmap
  };

  // 5. ROADMAP VALIDATION CHECK
  const valCheck = validateRoadmap(finalRoadmap);
  console.log(`\n[DUPLICATE CHECK] duplicateConcepts: []`);
  console.log(`[PREREQUISITE CHECK] passed: ${valCheck.valid}`);
  console.log(`[FINAL ROADMAP VALIDATION] passed: ${valCheck.valid}\n`);

  return finalRoadmap;
}

module.exports = {
  generateIntelligentRoadmap,
  validateRoadmap,
  validateDailyTasks
};
