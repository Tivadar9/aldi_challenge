const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const cds = require("@sap/cds");
const nodemailer = require("nodemailer");
const notifications = require("../lib/notifications");

const settings = {
  EMAIL_DELIVERY_MODE: "smtp",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_REQUIRE_TLS: "true",
  SMTP_USERNAME: "test-user",
  SMTP_PASSWORD: "test-password",
  SMTP_FROM: "Spacefarer <welcome@example.test>",
};

describe("Notification delivery modes", { concurrency: false }, () => {
  let previous;
  let createTransport;
  const message = notifications.congratulatoryEmail({
    name: "Test Pilot", email: "pilot@example.test", navigationSkill: 2,
    trialTimeMinutes: 15, stardust: 130,
  });

  beforeEach(() => {
    previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
    for (const key of Object.keys(settings)) delete process.env[key];
    createTransport = mock.method(nodemailer, "createTransport", () => {
      throw new Error("Unexpected SMTP transport creation");
    });
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    mock.restoreAll();
  });

  it("logs by default and in explicit log mode without creating an SMTP transport", async () => {
    const info = mock.method(cds.log("notifications"), "info", () => {});
    await notifications.send(message);
    process.env.EMAIL_DELIVERY_MODE = "log";
    await notifications.send(message);
    assert.equal(info.mock.callCount(), 2);
    assert.deepEqual(info.mock.calls[0].arguments,
      ["Local email notification (no email sent)", message]);
    assert.equal(createTransport.mock.callCount(), 0);
  });

  it("passes SMTP credentials and STARTTLS settings to Nodemailer and preserves email content", async () => {
    Object.assign(process.env, settings, { SMTP_PORT: "2525" });
    const delivered = { messageId: "mock-message" };
    const sendMail = mock.fn(async () => delivered);
    createTransport.mock.mockImplementation(() => ({ sendMail }));
    assert.equal(await notifications.send(message), delivered);
    const [options] = createTransport.mock.calls[0].arguments;
    assert.equal(options.host, settings.SMTP_HOST);
    assert.equal(options.port, 2525);
    assert.equal(options.secure, false);
    assert.equal(options.requireTLS, true);
    assert.deepEqual(options.auth, { user: settings.SMTP_USERNAME, pass: settings.SMTP_PASSWORD });
    assert.deepEqual(sendMail.mock.calls[0].arguments,
      [{ ...message, from: settings.SMTP_FROM }]);
  });

  it("supports implicit TLS with the default port and relays without authentication", async () => {
    Object.assign(process.env, settings, { SMTP_SECURE: "true", SMTP_REQUIRE_TLS: "false" });
    for (const key of ["SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD"]) delete process.env[key];
    createTransport.mock.mockImplementation(() => ({ sendMail: async () => ({}) }));
    await notifications.send(message);
    const [options] = createTransport.mock.calls[0].arguments;
    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.equal(options.requireTLS, false);
    assert.equal(options.auth, undefined);
  });

  it("rejects invalid configuration before attempting SMTP delivery", async () => {
    for (const [overrides, expected] of [
      [{ EMAIL_DELIVERY_MODE: "unknown" }, /EMAIL_DELIVERY_MODE/],
      [{ SMTP_HOST: "" }, /SMTP_HOST/],
      [{ SMTP_FROM: "" }, /SMTP_FROM/],
      [{ SMTP_PORT: "invalid" }, /SMTP_PORT/],
      [{ SMTP_PORT: "65536" }, /SMTP_PORT/],
      [{ SMTP_SECURE: "invalid" }, /SMTP_SECURE/],
      [{ SMTP_REQUIRE_TLS: "invalid" }, /SMTP_REQUIRE_TLS/],
      [{ SMTP_PASSWORD: "" }, /SMTP_USERNAME and SMTP_PASSWORD/],
    ]) {
      Object.assign(process.env, settings, overrides);
      await assert.rejects(notifications.send(message), expected);
    }
    assert.equal(createTransport.mock.callCount(), 0);
  });
});
