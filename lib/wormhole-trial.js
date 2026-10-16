const { randomInt } = require("node:crypto");

function classifyTrialDuration(duration) {
  if (!Number.isInteger(duration) || duration < 10 || duration > 60) {
    throw new RangeError(
      "Trial duration must be an integer from 10 to 60 minutes",
    );
  }

  if (duration <= 14) return { navigationSkill: 3, stardustBonus: 40 };
  if (duration <= 19) return { navigationSkill: 2, stardustBonus: 30 };
  if (duration <= 30) return { navigationSkill: 1, stardustBonus: 20 };
  return { navigationSkill: 0, stardustBonus: 10 };
}

function runTrial(randomInteger = randomInt) {
  const trialTimeMinutes = randomInteger(10, 61);
  return { trialTimeMinutes, ...classifyTrialDuration(trialTimeMinutes) };
}

module.exports = { classifyTrialDuration, generateTrialDuration, runTrial };
