/**
 * Skill Profiler Engine for AgPlacify
 * Calculates granular per-skill mastery, confidence, evidence, and 5-tier proficiency level:
 * - 80–100% = MASTERED
 * - 60–79%  = STRONG
 * - 40–59%  = PARTIAL
 * - 20–39%  = WEAK
 * - 0–19%   = NOT_LEARNED
 */

const { getKnowledgeGraph, getAllSkillsInGraph } = require('./knowledgeGraph');

/**
 * Categorizes mastery score percentage into 5-tier status
 */
function getMasteryTier(scorePct) {
  if (scorePct >= 80) return 'MASTERED';
  if (scorePct >= 60) return 'STRONG';
  if (scorePct >= 40) return 'PARTIAL';
  if (scorePct >= 20) return 'WEAK';
  return 'NOT_LEARNED';
}

/**
 * Generates user skill profile from quiz evaluation / quiz answers or historical quiz data
 */
function buildUserSkillProfile({ userId, domain, quizEvaluation, existingProfile }) {
  const graph = getKnowledgeGraph(domain);
  const allSkills = getAllSkillsInGraph(graph);

  const skillStatsMap = new Map();

  // Initialize all skills in graph with base metadata
  allSkills.forEach(sk => {
    skillStatsMap.set(sk.skillId, {
      skillId: sk.skillId,
      topic: sk.topicName,
      subtopic: sk.subtopicName,
      skillName: sk.skillName,
      masteryScore: 0,
      masteryTier: 'NOT_LEARNED',
      confidence: 0.1,
      evidence: { correct: 0, total: 0 },
      level: sk.difficulty || 'BEGINNER',
      lastAssessedAt: new Date()
    });
  });

  // Preserve existing profile skills if available
  if (existingProfile && Array.isArray(existingProfile.skills)) {
    existingProfile.skills.forEach(s => {
      if (skillStatsMap.has(s.skillId)) {
        const score = s.masteryScore || 0;
        skillStatsMap.set(s.skillId, {
          ...skillStatsMap.get(s.skillId),
          masteryScore: score,
          masteryTier: getMasteryTier(score),
          confidence: s.confidence || 0.1,
          evidence: s.evidence || { correct: 0, total: 0 },
          level: s.level || 'BEGINNER',
          lastAssessedAt: s.lastAssessedAt || new Date()
        });
      }
    });
  }

  if (quizEvaluation) {
    const answers = Array.isArray(quizEvaluation.answers) ? quizEvaluation.answers : [];

    if (answers.length > 0) {
      // Direct granular evaluation from actual quiz answers
      answers.forEach(ans => {
        const topicName = (ans.topic || '').trim().toLowerCase();
        const subtopicName = (ans.subtopic || '').trim().toLowerCase();

        // Match answer to closest skill in graph
        let matchedSkill = allSkills.find(s => s.skillId === ans.skillId);
        if (!matchedSkill) {
          matchedSkill = allSkills.find(s => 
            s.subtopicName.toLowerCase().includes(subtopicName) || 
            subtopicName.includes(s.subtopicName.toLowerCase()) ||
            s.topicName.toLowerCase().includes(topicName) ||
            topicName.includes(s.topicName.toLowerCase())
          );
        }

        const targetSkillId = matchedSkill ? matchedSkill.skillId : (allSkills[0] ? allSkills[0].skillId : 'default_skill');

        if (skillStatsMap.has(targetSkillId)) {
          const stats = skillStatsMap.get(targetSkillId);
          stats.evidence.total += 1;
          if (ans.is_correct) {
            stats.evidence.correct += 1;
          }
        }
      });

      // Calculate score & confidence based on evidence
      skillStatsMap.forEach((stats) => {
        if (stats.evidence.total > 0) {
          const accuracyPct = Math.round((stats.evidence.correct / stats.evidence.total) * 100);
          stats.masteryScore = accuracyPct;
          stats.masteryTier = getMasteryTier(accuracyPct);
          stats.confidence = Math.min(1.0, 0.5 + stats.evidence.total * 0.1);
          if (accuracyPct >= 80) stats.level = 'ADVANCED';
          else if (accuracyPct >= 50) stats.level = 'INTERMEDIATE';
          else stats.level = 'BEGINNER';
        }
      });

    } else if (Array.isArray(quizEvaluation.topic_evaluations) && quizEvaluation.topic_evaluations.length > 0) {
      // Derived baseline from historical topic evaluations
      quizEvaluation.topic_evaluations.forEach(tEval => {
        const tName = (tEval.topic || '').toLowerCase();
        allSkills.filter(s => s.topicName.toLowerCase().includes(tName) || tName.includes(s.topicName.toLowerCase())).forEach(s => {
          const stats = skillStatsMap.get(s.skillId);
          if (stats) {
            const score = tEval.score_pct !== undefined ? tEval.score_pct : 50;
            stats.masteryScore = score;
            stats.masteryTier = getMasteryTier(score);
            stats.confidence = 0.7;
            stats.evidence = { correct: tEval.correct_count || 1, total: tEval.total_questions || 1 };
            if (score >= 80) stats.level = 'ADVANCED';
            else if (score >= 50) stats.level = 'INTERMEDIATE';
            else stats.level = 'BEGINNER';
          }
        });
      });

    } else {
      // Fallback baseline from quiz overall score / declared skill level
      const overallScore = quizEvaluation.score_pct !== undefined ? quizEvaluation.score_pct : (quizEvaluation.scorePct || 40);
      const overallLevel = quizEvaluation.skill_level || 'BEGINNER';

      allSkills.forEach(s => {
        const stats = skillStatsMap.get(s.skillId);
        if (stats) {
          if (s.difficulty === 'BEGINNER') {
            stats.masteryScore = Math.min(100, Math.max(10, overallScore));
          } else if (s.difficulty === 'INTERMEDIATE') {
            stats.masteryScore = Math.max(0, overallScore - 20);
          } else {
            stats.masteryScore = Math.max(0, overallScore - 40);
          }
          stats.masteryTier = getMasteryTier(stats.masteryScore);
          stats.confidence = 0.5;
          stats.level = overallLevel;
        }
      });
    }
  }

  const skillsArray = Array.from(skillStatsMap.values());

  return {
    userId,
    domain: graph.domainName,
    domainId: graph.domainId,
    skills: skillsArray,
    updatedAt: new Date()
  };
}

/**
 * Update a specific skill's mastery after task / mini-quiz completion
 */
function updateSkillMastery(skillProfile, skillId, isCorrect, taskScorePct) {
  if (!skillProfile || !Array.isArray(skillProfile.skills)) return skillProfile;

  const skill = skillProfile.skills.find(s => s.skillId === skillId);
  if (skill) {
    if (!skill.evidence) skill.evidence = { correct: 0, total: 0 };
    skill.evidence.total += 1;
    if (isCorrect || taskScorePct >= 70) {
      skill.evidence.correct += 1;
    }

    // Exponential moving average for dynamic mastery adjustment
    const delta = (taskScorePct !== undefined ? taskScorePct : (isCorrect ? 100 : 0)) - skill.masteryScore;
    skill.masteryScore = Math.min(100, Math.max(0, Math.round(skill.masteryScore + delta * 0.35)));
    skill.masteryTier = getMasteryTier(skill.masteryScore);

    skill.confidence = Math.min(1.0, (skill.confidence || 0.5) + 0.05);
    if (skill.masteryScore >= 80) skill.level = 'ADVANCED';
    else if (skill.masteryScore >= 50) skill.level = 'INTERMEDIATE';
    else skill.level = 'BEGINNER';

    skill.lastAssessedAt = new Date();
  }

  skillProfile.updatedAt = new Date();
  return skillProfile;
}

module.exports = {
  getMasteryTier,
  buildUserSkillProfile,
  updateSkillMastery
};
