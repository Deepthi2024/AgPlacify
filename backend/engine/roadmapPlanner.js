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

const { getKnowledgeGraph, getAllSkillsInGraph, topologicalSortSkills, getOrderedSubskillsForSkill, isDSADomain } = require('./knowledgeGraph');

/**
 * Validates daily task decomposition within a week
 */
function validateDailyTasks(weekObj) {
  const errors = [];
  if (!weekObj || !Array.isArray(weekObj.days)) {
    errors.push(`Week ${weekObj ? weekObj.week_number : 'unknown'} has no days array.`);
    return { valid: false, errors };
  }

  const scheduledNewSubskillDays = new Set();

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

      // RULE 2: No Duplicate NEW_LEARNING Subskills across different days in a week
      if (task.taskStage === 'NEW_LEARNING' && task.subskillId) {
        const dayKey = `${day.day_number}:${task.subskillId}`;
        if (scheduledNewSubskillDays.has(task.subskillId) && !scheduledNewSubskillDays.has(dayKey)) {
          errors.push(`DUPLICATE DAILY SUBSKILL: Subskill '${task.subskillName}' (${task.subskillId}) scheduled across multiple days in Week ${weekObj.week_number} (Day ${day.day_number}).`);
        } else {
          scheduledNewSubskillDays.add(task.subskillId);
          scheduledNewSubskillDays.add(dayKey);
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
function generateIntelligentRoadmap({
  userId,
  domain,
  timeline_months,
  daily_hours,
  skillProfile,
  currentSkillLevel: reqCurrentLevel,
  targetSkillLevel: reqTargetLevel,
  quizEvaluation,
  userLevel: reqLevel,
  dsaProgrammingLanguage: reqDsaLang,
  dsa_programming_language: altDsaLang
}) {
  const dsaProgrammingLanguage = reqDsaLang || altDsaLang || (skillProfile && skillProfile.dsa_programming_language) || null;
  const timelineMonths = parseInt(timeline_months, 10) || 6;
  const dailyHours = parseFloat(daily_hours) || 2.0;
  const dailyMinutesTarget = Math.round(dailyHours * 60);

  const graph = getKnowledgeGraph(domain, dsaProgrammingLanguage);
  const allSkills = getAllSkillsInGraph(graph);

  // 1. SEPARATE DECLARED CURRENT SKILL LEVEL FROM TARGET SKILL LEVEL
  const currentSkillLevel = (
    reqCurrentLevel ||
    (skillProfile && skillProfile.current_skill_level) ||
    reqLevel ||
    'BEGINNER'
  ).toUpperCase();

  const targetSkillLevel = (
    reqTargetLevel ||
    (skillProfile && skillProfile.target_skill_level) ||
    'ADVANCED'
  ).toUpperCase();

  const hasQuiz = !!(quizEvaluation && !quizEvaluation.is_self_assessed && !quizEvaluation.isSelfAssessed && quizEvaluation.score_pct !== null && quizEvaluation.scorePct !== null);

  console.log(`\n==================================================`);
  console.log(`[ROADMAP PLANNER] Dynamic Learner-Specific Generator`);
  console.log(`Domain: "${graph.domainName}" (${graph.domainId})`);
  if (isDSADomain(domain)) {
    console.log(`DSA Selected Programming Language: "${dsaProgrammingLanguage || 'Python'}"`);
  }
  console.log(`Current Level: "${currentSkillLevel}" | Target Level: "${targetSkillLevel}"`);
  console.log(`Timeline: ${timelineMonths} Months (${timelineMonths * 4} Weeks Capacity)`);
  console.log(`Daily Hours: ${dailyHours} Hours/Day (${dailyMinutesTarget} Mins/Day)`);
  console.log(`Quiz Assessment Status: "${hasQuiz ? 'completed' : 'not_attempted'}"`);
  console.log(`==================================================`);

  // 2. BUILD DETAILED SKILL MASTERY & DIAGNOSTIC PROFICIENCY MAP
  const skillMasteryMap = new Map();
  const weakTopics = new Set();
  const strongTopics = new Set();

  if (hasQuiz) {
    if (Array.isArray(quizEvaluation.knowledge_gaps)) {
      quizEvaluation.knowledge_gaps.forEach(g => weakTopics.add((g.topic || g.topicName || g || '').toLowerCase()));
    }
    if (Array.isArray(quizEvaluation.weakTopics)) {
      quizEvaluation.weakTopics.forEach(w => weakTopics.add(String(w).toLowerCase()));
    }
    if (Array.isArray(quizEvaluation.mastered_topics)) {
      quizEvaluation.mastered_topics.forEach(m => strongTopics.add((m.topic || m.topicName || m || '').toLowerCase()));
    }
    if (Array.isArray(quizEvaluation.strongTopics)) {
      quizEvaluation.strongTopics.forEach(s => strongTopics.add(String(s).toLowerCase()));
    }
  } else if (skillProfile) {
    (skillProfile.weakTopics || []).forEach(w => weakTopics.add(String(w).toLowerCase()));
    (skillProfile.strongTopics || []).forEach(s => strongTopics.add(String(s).toLowerCase()));
  }

  allSkills.forEach(sk => {
    let score = 0;
    let isWeak = false;
    let isStrong = false;

    const sName = (sk.skillName || '').toLowerCase();
    const tName = (sk.topicName || '').toLowerCase();
    const subName = (sk.subtopicName || '').toLowerCase();

    // Check quiz topic evaluations
    if (hasQuiz && Array.isArray(quizEvaluation.topic_evaluations)) {
      const tMatch = quizEvaluation.topic_evaluations.find(t => {
        const topStr = (t.topic || '').toLowerCase();
        return topStr.includes(tName) || tName.includes(topStr) || topStr.includes(sName) || sName.includes(topStr);
      });
      if (tMatch) {
        score = tMatch.score_pct !== undefined ? tMatch.score_pct : score;
        if (tMatch.proficiency_level === 'WEAK' || score < 50) isWeak = true;
        if (tMatch.proficiency_level === 'STRONG' || score >= 80) isStrong = true;
      }
    }

    // Check skill profile array
    if (skillProfile && Array.isArray(skillProfile.skills)) {
      const userSk = skillProfile.skills.find(s => s.skillId === sk.skillId);
      if (userSk) {
        score = userSk.masteryScore || score;
        if (userSk.masteryTier === 'WEAK' || (score > 0 && score < 50)) isWeak = true;
        if (userSk.masteryTier === 'STRONG' || userSk.masteryTier === 'MASTERED' || score >= 80) isStrong = true;
      }
    }

    // Check global weak/strong sets
    for (const w of weakTopics) {
      if (tName.includes(w) || sName.includes(w) || subName.includes(w) || w.includes(tName) || w.includes(sName)) {
        isWeak = true;
      }
    }
    for (const s of strongTopics) {
      if (tName.includes(s) || sName.includes(s) || subName.includes(s) || s.includes(tName) || s.includes(sName)) {
        isStrong = true;
      }
    }

    skillMasteryMap.set(sk.skillId, {
      ...sk,
      masteryScore: score,
      isMastered: isStrong || score >= 80,
      isWeak,
      isStrong
    });
  });

  // 3. DYNAMIC CURRICULUM SELECTION & LEVEL-BASED STARTING POINT
  // Filter skills based on current level and target level
  let selectedSkills = [];

  if (currentSkillLevel === 'ADVANCED') {
    // Advanced learner starts strictly with Advanced/Application topics or weak prerequisite gaps
    selectedSkills = allSkills.filter(sk => {
      const m = skillMasteryMap.get(sk.skillId);
      return sk.difficulty === 'ADVANCED' || (m && m.isWeak);
    });
    if (selectedSkills.length === 0) {
      selectedSkills = allSkills.filter(sk => sk.difficulty !== 'BEGINNER');
    }
  } else if (currentSkillLevel === 'INTERMEDIATE') {
    // Intermediate learner starts with Intermediate topics + weak prerequisite gaps
    selectedSkills = allSkills.filter(sk => {
      const m = skillMasteryMap.get(sk.skillId);
      if (sk.difficulty === 'BEGINNER') {
        return m && m.isWeak; // Only include beginner topics if explicitly weak
      }
      return true;
    });
  } else {
    // Beginner learner starts with Beginner topics, but skips topics demonstrated as Strong/Mastered
    selectedSkills = allSkills.filter(sk => {
      const m = skillMasteryMap.get(sk.skillId);
      if (m && m.isStrong && m.isMastered && sk.difficulty === 'BEGINNER') {
        // Skip basic repetition if already strong in quiz
        return false;
      }
      return true;
    });
  }

  if (selectedSkills.length === 0) {
    selectedSkills = [...allSkills];
  }

  // Preserve prerequisite DAG order
  let sortedCurriculum = topologicalSortSkills(selectedSkills);

  // Separate weak remedial skills, core progression skills, and advanced extension skills
  const remedialSkills = sortedCurriculum.filter(sk => skillMasteryMap.get(sk.skillId)?.isWeak);
  const standardSkills = sortedCurriculum.filter(sk => !skillMasteryMap.get(sk.skillId)?.isWeak && !skillMasteryMap.get(sk.skillId)?.isStrong);
  const advancedExtensionSkills = sortedCurriculum.filter(sk => skillMasteryMap.get(sk.skillId)?.isStrong);

  // Assemble dynamic skill progression: Remedial skills first -> Core progression -> Advanced extensions
  let finalPlannedSkills = [];
  const addedIds = new Set();

  // Add remedial skills first (with prerequisite order)
  remedialSkills.forEach(sk => {
    if (!addedIds.has(sk.skillId)) {
      finalPlannedSkills.push(sk);
      addedIds.add(sk.skillId);
    }
  });

  // Add standard skills matching current level progression
  standardSkills.forEach(sk => {
    if (!addedIds.has(sk.skillId)) {
      finalPlannedSkills.push(sk);
      addedIds.add(sk.skillId);
    }
  });

  // Add advanced extension skills
  advancedExtensionSkills.forEach(sk => {
    if (!addedIds.has(sk.skillId)) {
      finalPlannedSkills.push(sk);
      addedIds.add(sk.skillId);
    }
  });

  // If curriculum skills are fewer than total timeline weeks, expand subskill focuses dynamically
  const totalWeeksNeeded = timelineMonths * 4;
  const weeklySkillPlan = [];
  const assignedConceptKeys = new Set();

  let skillIndex = 0;
  for (let w = 1; w <= totalWeeksNeeded; w++) {
    const baseSkill = finalPlannedSkills[skillIndex % finalPlannedSkills.length];
    const skillUsageCount = Math.floor((w - 1) / finalPlannedSkills.length);
    const fullSubskills = getOrderedSubskillsForSkill(baseSkill);
    const skMastery = skillMasteryMap.get(baseSkill.skillId);

    let weekSubtopic = baseSkill.subtopicName || baseSkill.skillName;
    if (skillUsageCount > 0 && fullSubskills.length > 0) {
      const subIdx = skillUsageCount % fullSubskills.length;
      weekSubtopic = `${baseSkill.subtopicName}: ${fullSubskills[subIdx].skillName}`;
    }

    let conceptKey = `${baseSkill.skillId}::${weekSubtopic.toLowerCase().trim()}`;
    if (assignedConceptKeys.has(conceptKey)) {
      weekSubtopic = `${weekSubtopic} (Phase ${skillUsageCount + 1})`;
      conceptKey = `${baseSkill.skillId}::${weekSubtopic.toLowerCase().trim()}`;
    }
    assignedConceptKeys.add(conceptKey);

    weeklySkillPlan.push({
      weekIndex: w,
      skillId: skillUsageCount === 0 ? baseSkill.skillId : `${baseSkill.skillId}_w${skillUsageCount + 1}`,
      baseSkillId: baseSkill.skillId,
      skillName: baseSkill.skillName,
      topicName: baseSkill.topicName,
      subtopicName: weekSubtopic,
      prerequisites: baseSkill.prerequisites || [],
      difficulty: baseSkill.difficulty || 'BEGINNER',
      isWeak: skMastery ? skMastery.isWeak : false,
      isStrong: skMastery ? skMastery.isStrong : false,
      subskills: fullSubskills,
      masteryScore: skMastery ? skMastery.masteryScore : 0
    });

    skillIndex++;
  }

  // Helper function for monthly level progression
  function getDynamicMonthLevel(monthIndex, totalMonths) {
    if (currentSkillLevel === 'ADVANCED') return 'ADVANCED';
    if (currentSkillLevel === 'INTERMEDIATE') {
      if (targetSkillLevel === 'ADVANCED') {
        return monthIndex <= Math.ceil(totalMonths / 2) ? 'INTERMEDIATE' : 'ADVANCED';
      }
      return 'INTERMEDIATE';
    }
    // currentSkillLevel === 'BEGINNER'
    if (targetSkillLevel === 'ADVANCED') {
      if (monthIndex <= Math.ceil(totalMonths / 3)) return 'BEGINNER';
      if (monthIndex <= Math.ceil((totalMonths * 2) / 3)) return 'INTERMEDIATE';
      return 'ADVANCED';
    }
    if (targetSkillLevel === 'INTERMEDIATE') {
      if (monthIndex <= Math.ceil(totalMonths / 2)) return 'BEGINNER';
      return 'INTERMEDIATE';
    }
    return 'BEGINNER';
  }

  // 4. MONTHLY -> WEEKLY -> DAILY ROADMAP GENERATION
  const monthlyRoadmap = [];

  for (let m = 1; m <= timelineMonths; m++) {
    const monthWeeks = weeklySkillPlan.slice((m - 1) * 4, m * 4);
    const primarySkill = monthWeeks[0] || weeklySkillPlan[0];
    const monthDifficulty = getDynamicMonthLevel(m, timelineMonths);
    const monthSubtopics = monthWeeks.map(w => w.subtopicName);
    const monthlyCapacityHours = Math.round(dailyHours * 28); // Calculated dynamically from actual learning days * dailyHours

    let dynamicMonthTitle = `Month ${m}: ${primarySkill.skillName} (${monthDifficulty} Mastery & Applied Drills)`;
    if (primarySkill.isWeak) {
      dynamicMonthTitle = `Month ${m}: ${primarySkill.skillName} (Foundational Remediation & Gap Closure)`;
    } else if (primarySkill.isStrong) {
      dynamicMonthTitle = `Month ${m}: ${primarySkill.skillName} (Advanced System Projects & Performance Tuning)`;
    }

    const monthObj = {
      monthId: `month_${m}`,
      month_number: m,
      title: dynamicMonthTitle,
      objective: primarySkill.isWeak
        ? `Remediate diagnostic gaps and build core practical strength in ${primarySkill.skillName}`
        : (primarySkill.isStrong
          ? `Accelerate advanced applied implementations and optimization in ${primarySkill.skillName}`
          : `Build ${monthDifficulty.toLowerCase()} proficiency in ${primarySkill.skillName} covering ${monthSubtopics.slice(0, 2).join(', ')}`),
      topics: Array.from(new Set([primarySkill.skillName, primarySkill.topicName])),
      subtopics: monthSubtopics,
      priority: (m === 1 || primarySkill.isWeak) ? 'HIGH' : 'MEDIUM',
      difficulty: monthDifficulty,
      estimated_hours: monthlyCapacityHours,
      expected_outcomes: [
        `Master ${primarySkill.skillName} at ${monthDifficulty} level`,
        `Complete practical implementation for ${monthSubtopics[0] || primarySkill.skillName}`
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
        sequenceIndex: globalWeekNum,
        skillId: weekSkill.skillId,
        baseSkillId: weekSkill.baseSkillId,
        title: `Week ${globalWeekNum}: ${weekSkill.subtopicName}`,
        objective: weekSkill.isWeak
          ? `Remediate foundational knowledge gaps and master ${weekSkill.skillName}`
          : (weekSkill.isStrong
            ? `Execute advanced architectural implementations in ${weekSkill.skillName}`
            : `Build ${monthDifficulty.toLowerCase()} practical mastery in ${weekSkill.subtopicName}`),
        topics: [weekSkill.topicName],
        subtopics: [weekSkill.subtopicName],
        difficulty: monthDifficulty,
        estimated_hours: Math.round(dailyHours * 7),
        days: []
      };

      // 7-DAY DAILY DECOMPOSITION ACCORDING TO DAILY HOURS CAPACITY
      for (let d = 1; d <= 7; d++) {
        const globalDayNum = (globalWeekNum - 1) * 7 + d;
        let daySubskill = null;
        let taskStage = weekSkill.isWeak ? 'REMEDIATION' : (weekSkill.isStrong ? 'ADVANCED_APPLICATION' : 'NEW_LEARNING');
        let taskType = 'LEARN';

        if (d <= 6) {
          const rawSub = subskillList[d - 1];
          const subTitle = rawSub ? (rawSub.subskillName || rawSub.skillName || `${weekSkill.subtopicName} Part ${d}`) : `${weekSkill.subtopicName} Core Concept ${d}`;
          daySubskill = {
            subskillId: rawSub ? (rawSub.subskillId || rawSub.skillId || `${weekSkill.baseSkillId}_day_${d}`) : `${weekSkill.baseSkillId}_day_${d}`,
            subskillName: subTitle,
            skillName: subTitle
          };
          taskType = (d === 6) ? 'IMPLEMENT' : ((d % 2 === 0) ? 'PRACTICE' : 'LEARN');
        } else {
          const capstoneTitle = `Weekly Capstone & Assessment: ${weekSkill.subtopicName}`;
          daySubskill = {
            subskillId: `${weekSkill.baseSkillId}_capstone_eval`,
            subskillName: capstoneTitle,
            skillName: capstoneTitle
          };
          taskStage = 'ASSESSMENT';
          taskType = 'ASSESSMENT';
        }

        const dayTasks = [];
        const isAssessmentDay = (d === 7);

        if (dailyHours <= 1.5) {
          // 1 Hour Daily Capacity (~60 mins)
          const t1Mins = Math.round(dailyMinutesTarget * 0.6);
          const t2Mins = Math.max(15, dailyMinutesTarget - t1Mins);
          dayTasks.push(
            {
              taskId: `task_${globalDayNum}_1`, id: `task_${globalDayNum}_1`,
              monthNumber: m, month_number: m, weekNumber: globalWeekNum, week_number: globalWeekNum, dayNumber: globalDayNum, day_number: globalDayNum,
              taskTitle: isAssessmentDay ? `Assessment: ${daySubskill.subskillName}` : (weekSkill.isWeak ? `Remediation Study: ${daySubskill.subskillName}` : `Learn: ${daySubskill.subskillName}`),
              title: isAssessmentDay ? `Assessment: ${daySubskill.subskillName}` : (weekSkill.isWeak ? `Remediation Study: ${daySubskill.subskillName}` : `Learn: ${daySubskill.subskillName}`),
              durationMinutes: t1Mins, estimated_minutes: t1Mins, completed: false,
              taskType: taskType, type: taskType, taskStage: taskStage,
              taskTopic: weekSkill.topicName, topic: weekSkill.topicName, taskSubtopic: daySubskill.subskillName, subtopic: daySubskill.subskillName,
              domain: graph.domainId, domainId: graph.domainId, skillId: weekSkill.skillId, baseSkillId: weekSkill.baseSkillId, parentSkillId: weekSkill.baseSkillId, subskillId: daySubskill.subskillId, subskillName: daySubskill.subskillName,
              userLevel: currentSkillLevel, difficulty: monthDifficulty,
              description: `Core module for ${daySubskill.subskillName}.`, practice_details: `Core module for ${daySubskill.subskillName}.`
            },
            {
              taskId: `task_${globalDayNum}_2`, id: `task_${globalDayNum}_2`,
              monthNumber: m, month_number: m, weekNumber: globalWeekNum, week_number: globalWeekNum, dayNumber: globalDayNum, day_number: globalDayNum,
              taskTitle: isAssessmentDay ? `Review & Submission for ${daySubskill.subskillName}` : (weekSkill.isWeak ? `Guided Remedial Drills: ${daySubskill.subskillName}` : `Practice: ${daySubskill.subskillName} Drills`),
              title: isAssessmentDay ? `Review & Submission for ${daySubskill.subskillName}` : (weekSkill.isWeak ? `Guided Remedial Drills: ${daySubskill.subskillName}` : `Practice: ${daySubskill.subskillName} Drills`),
              durationMinutes: t2Mins, estimated_minutes: t2Mins, completed: false,
              taskType: isAssessmentDay ? 'ASSESSMENT' : 'PRACTICE', type: isAssessmentDay ? 'ASSESSMENT' : 'PRACTICE', taskStage: taskStage,
              taskTopic: weekSkill.topicName, topic: weekSkill.topicName, taskSubtopic: daySubskill.subskillName, subtopic: daySubskill.subskillName,
              domain: graph.domainId, domainId: graph.domainId, skillId: weekSkill.skillId, baseSkillId: weekSkill.baseSkillId, parentSkillId: weekSkill.baseSkillId, subskillId: daySubskill.subskillId, subskillName: daySubskill.subskillName,
              userLevel: currentSkillLevel, difficulty: monthDifficulty,
              description: `Practice and review for ${daySubskill.subskillName}.`, practice_details: `Practice and review for ${daySubskill.subskillName}.`
            }
          );
        } else if (dailyHours <= 3.0) {
          // 2-3 Hours Daily Capacity (~120 - 180 mins)
          const t1Mins = Math.round(dailyMinutesTarget * 0.4);
          const t2Mins = Math.round(dailyMinutesTarget * 0.4);
          const t3Mins = Math.max(15, dailyMinutesTarget - t1Mins - t2Mins);
          dayTasks.push(
            {
              taskId: `task_${globalDayNum}_1`, id: `task_${globalDayNum}_1`,
              monthNumber: m, month_number: m, weekNumber: globalWeekNum, week_number: globalWeekNum, dayNumber: globalDayNum, day_number: globalDayNum,
              taskTitle: isAssessmentDay ? `Assessment: ${daySubskill.subskillName} Theory Check` : (weekSkill.isWeak ? `Remedial Theory: ${daySubskill.subskillName}` : `Learn: ${daySubskill.subskillName} (${monthDifficulty})`),
              title: isAssessmentDay ? `Assessment: ${daySubskill.subskillName} Theory Check` : (weekSkill.isWeak ? `Remedial Theory: ${daySubskill.subskillName}` : `Learn: ${daySubskill.subskillName} (${monthDifficulty})`),
              durationMinutes: t1Mins, estimated_minutes: t1Mins, completed: false,
              taskType: taskType, type: taskType, taskStage: taskStage,
              taskTopic: weekSkill.topicName, topic: weekSkill.topicName, taskSubtopic: daySubskill.subskillName, subtopic: daySubskill.subskillName,
              domain: graph.domainId, domainId: graph.domainId, skillId: weekSkill.skillId, baseSkillId: weekSkill.baseSkillId, parentSkillId: weekSkill.baseSkillId, subskillId: daySubskill.subskillId, subskillName: daySubskill.subskillName,
              userLevel: currentSkillLevel, difficulty: monthDifficulty,
              description: `Study fundamental principles and syntax for ${daySubskill.subskillName}.`, practice_details: `Study fundamental principles and syntax for ${daySubskill.subskillName}.`
            },
            {
              taskId: `task_${globalDayNum}_2`, id: `task_${globalDayNum}_2`,
              monthNumber: m, month_number: m, weekNumber: globalWeekNum, week_number: globalWeekNum, dayNumber: globalDayNum, day_number: globalDayNum,
              taskTitle: isAssessmentDay ? `Practical Evaluation for ${daySubskill.subskillName}` : `Implement: ${daySubskill.subskillName} Practical Coding`,
              title: isAssessmentDay ? `Practical Evaluation for ${daySubskill.subskillName}` : `Implement: ${daySubskill.subskillName} Practical Coding`,
              durationMinutes: t2Mins, estimated_minutes: t2Mins, completed: false,
              taskType: isAssessmentDay ? 'ASSESSMENT' : 'IMPLEMENT', type: isAssessmentDay ? 'ASSESSMENT' : 'IMPLEMENT', taskStage: taskStage,
              taskTopic: weekSkill.topicName, topic: weekSkill.topicName, taskSubtopic: daySubskill.subskillName, subtopic: daySubskill.subskillName,
              domain: graph.domainId, domainId: graph.domainId, skillId: weekSkill.skillId, baseSkillId: weekSkill.baseSkillId, parentSkillId: weekSkill.baseSkillId, subskillId: daySubskill.subskillId, subskillName: daySubskill.subskillName,
              userLevel: currentSkillLevel, difficulty: monthDifficulty,
              description: `Hands-on module implementation for ${daySubskill.subskillName}.`, practice_details: `Hands-on module implementation for ${daySubskill.subskillName}.`
            },
            {
              taskId: `task_${globalDayNum}_3`, id: `task_${globalDayNum}_3`,
              monthNumber: m, month_number: m, weekNumber: globalWeekNum, week_number: globalWeekNum, dayNumber: globalDayNum, day_number: globalDayNum,
              taskTitle: isAssessmentDay ? `Review & Gap Correction: ${daySubskill.subskillName}` : (weekSkill.isWeak ? `Remedial Drills & Exercises: ${daySubskill.subskillName}` : `Practice: ${daySubskill.subskillName} Drills & Verification`),
              title: isAssessmentDay ? `Review & Gap Correction: ${daySubskill.subskillName}` : (weekSkill.isWeak ? `Remedial Drills & Exercises: ${daySubskill.subskillName}` : `Practice: ${daySubskill.subskillName} Drills & Verification`),
              durationMinutes: t3Mins, estimated_minutes: t3Mins, completed: false,
              taskType: isAssessmentDay ? 'ASSESSMENT' : 'PRACTICE', type: isAssessmentDay ? 'ASSESSMENT' : 'PRACTICE', taskStage: taskStage,
              taskTopic: weekSkill.topicName, topic: weekSkill.topicName, taskSubtopic: daySubskill.subskillName, subtopic: daySubskill.subskillName,
              domain: graph.domainId, domainId: graph.domainId, skillId: weekSkill.skillId, baseSkillId: weekSkill.baseSkillId, parentSkillId: weekSkill.baseSkillId, subskillId: daySubskill.subskillId, subskillName: daySubskill.subskillName,
              userLevel: currentSkillLevel, difficulty: monthDifficulty,
              description: `Execute tests and consolidate key concepts for ${daySubskill.subskillName}.`, practice_details: `Execute tests and consolidate key concepts for ${daySubskill.subskillName}.`
            }
          );
        } else {
          // 4 Hours Daily Capacity (> 180 mins)
          const t1Mins = Math.round(dailyMinutesTarget * 0.30);
          const t2Mins = Math.round(dailyMinutesTarget * 0.35);
          const t3Mins = Math.round(dailyMinutesTarget * 0.20);
          const t4Mins = Math.max(15, dailyMinutesTarget - t1Mins - t2Mins - t3Mins);
          dayTasks.push(
            {
              taskId: `task_${globalDayNum}_1`, id: `task_${globalDayNum}_1`,
              monthNumber: m, month_number: m, weekNumber: globalWeekNum, week_number: globalWeekNum, dayNumber: globalDayNum, day_number: globalDayNum,
              taskTitle: isAssessmentDay ? `Assessment: ${daySubskill.subskillName} Deep Theory` : `Learn: ${daySubskill.subskillName} Architecture & Principles`,
              title: isAssessmentDay ? `Assessment: ${daySubskill.subskillName} Deep Theory` : `Learn: ${daySubskill.subskillName} Architecture & Principles`,
              durationMinutes: t1Mins, estimated_minutes: t1Mins, completed: false,
              taskType: taskType, type: taskType, taskStage: taskStage,
              taskTopic: weekSkill.topicName, topic: weekSkill.topicName, taskSubtopic: daySubskill.subskillName, subtopic: daySubskill.subskillName,
              domain: graph.domainId, domainId: graph.domainId, skillId: weekSkill.skillId, baseSkillId: weekSkill.baseSkillId, parentSkillId: weekSkill.baseSkillId, subskillId: daySubskill.subskillId, subskillName: daySubskill.subskillName,
              userLevel: currentSkillLevel, difficulty: monthDifficulty,
              description: `Deep dive theoretical foundation for ${daySubskill.subskillName}.`, practice_details: `Deep dive theoretical foundation for ${daySubskill.subskillName}.`
            },
            {
              taskId: `task_${globalDayNum}_2`, id: `task_${globalDayNum}_2`,
              monthNumber: m, month_number: m, weekNumber: globalWeekNum, week_number: globalWeekNum, dayNumber: globalDayNum, day_number: globalDayNum,
              taskTitle: isAssessmentDay ? `Capstone Project Build: ${daySubskill.subskillName}` : `Implement: ${daySubskill.subskillName} Enterprise Feature`,
              title: isAssessmentDay ? `Capstone Project Build: ${daySubskill.subskillName}` : `Implement: ${daySubskill.subskillName} Enterprise Feature`,
              durationMinutes: t2Mins, estimated_minutes: t2Mins, completed: false,
              taskType: isAssessmentDay ? 'ASSESSMENT' : 'IMPLEMENT', type: isAssessmentDay ? 'ASSESSMENT' : 'IMPLEMENT', taskStage: taskStage,
              taskTopic: weekSkill.topicName, topic: weekSkill.topicName, taskSubtopic: daySubskill.subskillName, subtopic: daySubskill.subskillName,
              domain: graph.domainId, domainId: graph.domainId, skillId: weekSkill.skillId, baseSkillId: weekSkill.baseSkillId, parentSkillId: weekSkill.baseSkillId, subskillId: daySubskill.subskillId, subskillName: daySubskill.subskillName,
              userLevel: currentSkillLevel, difficulty: monthDifficulty,
              description: `Full module implementation and feature build for ${daySubskill.subskillName}.`, practice_details: `Full module implementation and feature build for ${daySubskill.subskillName}.`
            },
            {
              taskId: `task_${globalDayNum}_3`, id: `task_${globalDayNum}_3`,
              monthNumber: m, month_number: m, weekNumber: globalWeekNum, week_number: globalWeekNum, dayNumber: globalDayNum, day_number: globalDayNum,
              taskTitle: isAssessmentDay ? `Code Audit & Benchmark: ${daySubskill.subskillName}` : `Problem Solving: ${daySubskill.subskillName} Algorithmic Challenges`,
              title: isAssessmentDay ? `Code Audit & Benchmark: ${daySubskill.subskillName}` : `Problem Solving: ${daySubskill.subskillName} Algorithmic Challenges`,
              durationMinutes: t3Mins, estimated_minutes: t3Mins, completed: false,
              taskType: isAssessmentDay ? 'ASSESSMENT' : 'PROBLEM_SOLVING', type: isAssessmentDay ? 'ASSESSMENT' : 'PROBLEM_SOLVING', taskStage: taskStage,
              taskTopic: weekSkill.topicName, topic: weekSkill.topicName, taskSubtopic: daySubskill.subskillName, subtopic: daySubskill.subskillName,
              domain: graph.domainId, domainId: graph.domainId, skillId: weekSkill.skillId, baseSkillId: weekSkill.baseSkillId, parentSkillId: weekSkill.baseSkillId, subskillId: daySubskill.subskillId, subskillName: daySubskill.subskillName,
              userLevel: currentSkillLevel, difficulty: monthDifficulty,
              description: `Algorithmic drills and optimization challenges for ${daySubskill.subskillName}.`, practice_details: `Algorithmic drills and optimization challenges for ${daySubskill.subskillName}.`
            },
            {
              taskId: `task_${globalDayNum}_4`, id: `task_${globalDayNum}_4`,
              monthNumber: m, month_number: m, weekNumber: globalWeekNum, week_number: globalWeekNum, dayNumber: globalDayNum, day_number: globalDayNum,
              taskTitle: isAssessmentDay ? `Sign-off & Submission: ${daySubskill.subskillName}` : `Revision & Code Optimization: ${daySubskill.subskillName}`,
              title: isAssessmentDay ? `Sign-off & Submission: ${daySubskill.subskillName}` : `Revision & Code Optimization: ${daySubskill.subskillName}`,
              durationMinutes: t4Mins, estimated_minutes: t4Mins, completed: false,
              taskType: isAssessmentDay ? 'ASSESSMENT' : 'REVISION', type: isAssessmentDay ? 'ASSESSMENT' : 'REVISION', taskStage: taskStage,
              taskTopic: weekSkill.topicName, topic: weekSkill.topicName, taskSubtopic: daySubskill.subskillName, subtopic: daySubskill.subskillName,
              domain: graph.domainId, domainId: graph.domainId, skillId: weekSkill.skillId, baseSkillId: weekSkill.baseSkillId, parentSkillId: weekSkill.baseSkillId, subskillId: daySubskill.subskillId, subskillName: daySubskill.subskillName,
              userLevel: currentSkillLevel, difficulty: monthDifficulty,
              description: `Refactor code, perform peer review, and finalize module notes for ${daySubskill.subskillName}.`, practice_details: `Refactor code, perform peer review, and finalize module notes for ${daySubskill.subskillName}.`
            }
          );
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
          tasks: dayTasks
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
    curriculum_version: 'v5.0_dynamic_personalized_planner',
    current_skill_level: currentSkillLevel,
    target_skill_level: targetSkillLevel,
    assessment_status: hasQuiz ? 'completed' : 'not_attempted',
    quiz_score: hasQuiz ? (quizEvaluation.score_pct !== undefined ? quizEvaluation.score_pct : quizEvaluation.scorePct) : null,
    topic_proficiencies: hasQuiz ? (quizEvaluation.topic_evaluations || []) : [],
    weak_topics: Array.from(weakTopics),
    strong_topics: Array.from(strongTopics),
    userLevel: currentSkillLevel,
    dsa_programming_language: isDSADomain(domain) ? (dsaProgrammingLanguage || 'Python') : null,
    dsaProgrammingLanguage: isDSADomain(domain) ? (dsaProgrammingLanguage || 'Python') : null,
    monthly_roadmap: monthlyRoadmap
  };

  // 5. VALIDATE ROADMAP PERSONALIZATION & INTEGRITY
  const valCheck = validateRoadmap(finalRoadmap);
  console.log(`[ROADMAP PLANNER] Validation check passed: ${valCheck.valid}`);

  return finalRoadmap;
}

module.exports = {
  generateIntelligentRoadmap,
  validateRoadmap,
  validateDailyTasks
};
