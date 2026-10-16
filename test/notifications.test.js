const assert = require("node:assert/strict");
const {
  describe,
  it,
  before,
  beforeEach,
  afterEach,
  after,
  mock,
} = require("node:test");
const cds = require("@sap/cds");
const notifications = require("../lib/notifications");
const { SELECT, DELETE } = cds.ql;

describe(
  "Spacefarer congratulatory notifications",
  { concurrency: false },
  () => {
    let server;
    let base;
    let payload;
    let sent;
    let committedRows;
    let afterCreateEmails;
    let beforeCommitSendCounts;
    const entity = "galactic.spacefarer.Spacefarer";

    async function request(path, body) {
      const response = await fetch(base + path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${Buffer.from("alice:alice-dev").toString("base64")}`,
        },
        body: JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    }

    before(async () => {
      server = await cds.server({ port: 0, in_memory: true });
      base = `http://127.0.0.1:${server.address().port}/odata/v4/spacefarer`;
      const planet = cds.env.requires.auth.users.alice.attr.planet;
      const department = await cds.db.run(
        SELECT.one
          .from("galactic.spacefarer.Department")
          .where({ hqPlanet_ID: planet }),
      );
      const position = await cds.db.run(
        SELECT.one.from("galactic.spacefarer.Position"),
      );
      payload = {
        IsActiveEntity: true,
        ID: "cccccccc-0000-4000-8000-000000000001",
        name: "Test Pilot",
        email: "pilot@example.test",
        stardust: 100,
        suitColor: "BLUE",
        originPlanet_ID: planet,
        department_ID: department.ID,
        position_ID: position.ID,
      };

      const service = cds.services.SpacefarerService;
      service.after("CREATE", service.entities.Spacefarers, (_result, req) => {
        afterCreateEmails.push(req.data.email);
        req.before("commit", () => beforeCommitSendCounts.push(sent.length));
      });
    });

    beforeEach(async () => {
      sent = [];
      committedRows = [];
      afterCreateEmails = [];
      beforeCommitSendCounts = [];
      await cds.db.run(DELETE.from(cds.services.SpacefarerService.entities.Spacefarers.drafts));
      await cds.db.run(DELETE.from("DRAFT.DraftAdministrativeData"));
      await cds.db.run(DELETE.from(entity));
      mock.method(notifications, "send", async (message) => {
        sent.push(message);
        // Read through a fresh transaction, not the completed request transaction.
        committedRows.push(
          await cds.db.tx({}, (tx) =>
            tx.run(SELECT.one.from(entity).where({ email: message.to })),
          ),
        );
      });
    });

    afterEach(() => mock.restoreAll());
    after(async () => {
      try {
        if (server)
          await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          });
      } finally {
        await cds.db?.disconnect();
      }
    });

    it("sends one complete email only after the created row has committed", async () => {
      const response = await request("/Spacefarers", payload);
      assert.equal(response.status, 201, JSON.stringify(response.data));
      assert.deepEqual(beforeCommitSendCounts, [0]);
      assert.equal(sent.length, 1);
      const saved = await cds.db.run(
        SELECT.one.from(entity).where({ ID: payload.ID }),
      );
      assert.deepEqual(committedRows, [saved]);
      assert.deepEqual(sent[0], {
        to: saved.email,
        subject:
          "Congratulations on completing your wormhole navigation trial and joining the Spacefarers!",
        text: [
          `Congratulations, ${saved.name}!`,
          `Navigation skill: ${["BEGINNER", "INTERMEDIATE", "EXPERT", "MASTER"][saved.navigationSkill]} (${saved.navigationSkill})`,
          `Trial completion time: ${saved.trialTimeMinutes} minutes`,
          `Final stardust balance: ${saved.stardust}`,
        ].join("\n"),
      });
    });

    it("does not send if a later operation rolls back the atomic changeset", async () => {
      const response = await request("/$batch", {
        requests: [
          {
            id: "1",
            method: "POST",
            url: "Spacefarers",
            atomicityGroup: "changes",
            headers: { "content-type": "application/json" },
            body: payload,
          },
          {
            id: "2",
            method: "POST",
            url: "Spacefarers",
            atomicityGroup: "changes",
            headers: { "content-type": "application/json" },
            body: {
              ...payload,
              ID: "dddddddd-0000-4000-8000-000000000001",
              email: "foreign@example.test",
              originPlanet_ID: cds.env.requires.auth.users.bob.attr.planet,
            },
          },
        ],
      });
      assert.equal(response.status, 200);
      assert.ok(
        response.data.responses.some((result) => result.status === 403),
      );
      assert.ok(
        afterCreateEmails.includes(payload.email),
        "CREATE reached its after handler",
      );
      assert.deepEqual(sent, []);
      assert.deepEqual(await cds.db.run(SELECT.from(entity)), []);
    });

    it("does not notify when creation is rejected", async () => {
      const response = await request("/Spacefarers", {
        ...payload,
        stardust: -1,
      });
      assert.equal(response.status, 400);
      assert.deepEqual(afterCreateEmails, []);
      assert.deepEqual(sent, []);
    });

    it("logs delivery failures while keeping the committed row and successful response", async () => {
      const failure = new Error("Fake provider unavailable");
      notifications.send.mock.mockImplementation(async () => {
        throw failure;
      });
      const errors = mock.method(cds.log("notifications"), "error", () => {});
      const response = await request("/Spacefarers", payload);
      assert.equal(response.status, 201, JSON.stringify(response.data));
      assert.ok(
        await cds.db.run(SELECT.one.from(entity).where({ ID: payload.ID })),
      );
      assert.equal(notifications.send.mock.callCount(), 1);
      assert.equal(errors.mock.callCount(), 1);
      assert.ok(errors.mock.calls[0].arguments[0].includes(payload.ID));
      assert.equal(errors.mock.calls[0].arguments[1], failure);
    });
  },
);
