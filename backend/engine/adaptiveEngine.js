/**
 * Adaptive Replanning Engine for AgPlacify
 * Dynamically adjusts future roadmap items based on actual user performance,
 * task completions, mini-quiz scores, and skill mastery changes.
 */

const { getKnowledgeGraph } = require('./knowledgeGraph');
const { updateSkillMastery } = require('./skillProfiler');
const { generateIntelligentRoadmap } = require('./roadmapPlanner');

/**
 * Main adaptive replanning service: recalculateAdaptiveRoadmap
 */
async function recalculateAdaptiveRoadmap({ user, skillProfile, currentRoadmap, taskCompletionData, dbModels }) {
  if (!currentRoadmap || !Array.isArray(currentRoadmap.monthly_roadmap)) {
    throw new Error('Current roadmap data is invalid or empty.');
  }

  const { UserSkillProfile, Roadmap } = dbModels;
  let updatedSkillProfile = skillProfile;

  // 1. Process recent task / mini-quiz completion performance
  if (taskCompletionData) {
    const { skillId, isCorrect, taskScorePct } = taskCompletionData;
    if (skillId && updatedSkillProfile) {
      updatedSkillProfile = updateSkillMastery(updatedSkillProfile, skillId, isCorrect, taskScorePct);
      if (UserSkillProfile && updatedSkillProfile.userId) {
        await UserSkillProfile.findOneAndUpdate(
          { user_id: updatedSkillProfile.userId },
          {
            skills: updatedSkillProfile.skills,
            updatedAt: new Date()
          },
          { upsert: true }
        );
      }
    }
  }

  // 2. Identify completed tasks from existing roadmap (MUST PRESERVE THEM)
  const completedTaskIds = new Set();
  const completedSkillIds = new Set();

  currentRoadmap.monthly_roadmap.forEach(month => {
    if (Array.isArray(month.weeks)) {
      month.weeks.forEach(week => {
        if (Array.isArray(week.days)) {
          week.days.forEach(day => {
            if (Array.isArray(day.tasks)) {
              day.tasks.forEach(t => {
                if (t.status === 'COMPLETED' || t.completed === true) {
                  completedTaskIds.add(t.taskId || t.id);
                  if (t.skillId) completedSkillIds.add(t.skillId);
                }
              });
            }
          });
        }
      });
    }
  });

  // 3. Generate newly planned roadmap based on updated skill mastery & gaps
  const freshPlan = generateIntelligentRoadmap({
    userId: user.user_id,
    domain: user.chosen_domain,
    timeline_months: user.timeline_months,
    daily_hours: user.daily_hours,
    skillProfile: updatedSkillProfile,
    userLevel: user.current_skill_level
  });

  // 4. Merge historical completed tasks into the fresh plan
  freshPlan.monthly_roadmap.forEach(month => {
    if (Array.isArray(month.weeks)) {
      month.weeks.forEach(week => {
        if (Array.isArray(week.days)) {
          week.days.forEach(day => {
            if (Array.isArray(day.tasks)) {
              day.tasks.forEach(t => {
                const tId = t.taskId || t.id;
                if (completedTaskIds.has(tId)) {
                  t.status = 'COMPLETED';
                  t.completed = true;
                }
              });
            }
          });
        }
      });
    }
  });

  // Maintain journey state and versioning
  freshPlan.journey_started = currentRoadmap.journey_started;
  freshPlan.journey_start_date = currentRoadmap.journey_start_date;
  freshPlan.quiz_score = currentRoadmap.quiz_score;
  freshPlan.curriculum_version = 'v3_adaptive_replanned';
  freshPlan.updated_at = new Date();

  // Save to DB if model is provided
  if (Roadmap && user.user_id) {
    await Roadmap.findOneAndUpdate(
      { user_id: user.user_id },
      { ...freshPlan },
      { upsert: true, new: true }
    );
  }

  console.log(`⚡ [ADAPTIVE REPLANNER] Successfully recalculated roadmap for user ${user.user_id}. Retained ${completedTaskIds.size} completed historical tasks.`);

  return freshPlan;
}

module.exports = {
  recalculateAdaptiveRoadmap
};
