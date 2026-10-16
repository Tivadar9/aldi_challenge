const cds = require("@sap/cds");
const log = cds.log("notifications");

function congratulatoryEmail(spacefarer) {
  const skills = ["BEGINNER", "INTERMEDIATE", "EXPERT", "MASTER"];
  return {
    to: spacefarer.email,
    subject:
      "Congratulations on completing your wormhole navigation trial and joining the Spacefarers!",
    text: [
      `Congratulations, ${spacefarer.name}!`,
      `Navigation skill: ${skills[spacefarer.navigationSkill]} (${spacefarer.navigationSkill})`,
      `Trial completion time: ${spacefarer.trialTimeMinutes} minutes`,
      `Final stardust balance: ${spacefarer.stardust}`,
    ].join("\n"),
  };
}

// Development only, in production replace send({ to, subject, text }) with an async provider implementation for real delivery
async function send(message) {
  log.info("Local email notification (no email sent)", message);
}

module.exports = { congratulatoryEmail, send };
