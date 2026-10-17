const cds = require("@sap/cds");
const nodemailer = require("nodemailer");
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

function booleanSetting(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

async function send(message) {
  const mode = process.env.EMAIL_DELIVERY_MODE || "log";
  if (mode === "log") {
    log.info("Local email notification (no email sent)", message);
    return;
  }
  if (mode !== "smtp") {
    throw new Error("EMAIL_DELIVERY_MODE must be log or smtp");
  }

  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) {
    throw new Error("SMTP_HOST and SMTP_FROM are required for SMTP delivery");
  }
  const secure = booleanSetting("SMTP_SECURE", false);
  const port = Number(process.env.SMTP_PORT || (secure ? 465 : 587));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be an integer between 1 and 65535");
  }
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  if (Boolean(user) !== Boolean(pass)) {
    throw new Error("Set both SMTP_USERNAME and SMTP_PASSWORD, or neither");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: booleanSetting("SMTP_REQUIRE_TLS", true),
    ...(user ? { auth: { user, pass } } : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
  return transport.sendMail({ ...message, from });
}

module.exports = { congratulatoryEmail, send };
