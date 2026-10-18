const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { classifyTrialDuration, runTrial } = require("../lib/wormhole-trial");

describe("Wormhole trial classification", () => {
  for (const [duration, navigationSkill, stardustBonus] of [
    [10, 3, 40],
    [14, 3, 40],
    [15, 2, 30],
    [19, 2, 30],
    [20, 1, 20],
    [30, 1, 20],
    [31, 0, 10],
    [60, 0, 10],
  ]) {
    it(`classifies ${duration} minutes as skill ${navigationSkill} with bonus ${stardustBonus}`, () => {
      assert.deepEqual(classifyTrialDuration(duration), {
        navigationSkill,
        stardustBonus,
      });
    });
  }

  it("rejects out-of-range, fractional, and nonnumeric durations", () => {
    for (const duration of [
      9,
      61,
      10.5,
      NaN,
      Infinity,
      -Infinity,
      "10",
      null,
      undefined,
      true,
      {},
      [],
    ]) {
      assert.throws(() => classifyTrialDuration(duration), {
        name: "RangeError",
        message: "Trial duration must be an integer from 10 to 60 minutes",
      });
    }
  });
});

describe("Wormhole trial generation", () => {
  it("returns the duration, numeric skill, and bonus for each outcome", () => {
    for (const [trialTimeMinutes, navigationSkill, stardustBonus] of [
      [10, 3, 40],
      [15, 2, 30],
      [20, 1, 20],
      [60, 0, 10],
    ]) {
      assert.deepEqual(
        runTrial(() => trialTimeMinutes),
        {
          trialTimeMinutes,
          navigationSkill,
          stardustBonus,
        },
      );
    }
  });
});
