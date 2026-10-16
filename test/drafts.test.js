const assert = require("node:assert/strict");
const { describe, it, before, beforeEach, after, mock } = require("node:test");
const cds = require("@sap/cds");
const trial = require("../lib/wormhole-trial");
const notifications = require("../lib/notifications");
const { SELECT, INSERT, DELETE } = cds.ql;
const { runTrial } = trial;

describe("Spacefarer draft integration", { concurrency: false }, () => {
  const entity = "galactic.spacefarer.Spacefarer";
  const newId = "eeeeeeee-4444-4444-8444-000000000003";
  const active = (id) => `/Spacefarers(ID=${id},IsActiveEntity=true)`;
  const draft = (id) => `/Spacefarers(ID=${id},IsActiveEntity=false)`;
  const action = (id, name) => `${draft(id)}/SpacefarerService.${name}`;
  let server, base, drafts, fixtures, sent, committedRows;

  async function request(user, path, method = "GET", body) {
    const response = await fetch(base + path, {
      method,
      headers: {
        authorization: `Basic ${Buffer.from(`${user}:${user}-dev`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return {
      status: response.status,
      data: text && response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text,
    };
  }
  function expect(response, status) {
    assert.equal(response.status, status, JSON.stringify(response.data));
    return response.data;
  }
  function denied(response) {
    assert.ok([403, 404].includes(response.status), JSON.stringify(response));
    assert.ok(response.data.error);
  }
  const readActive = (id) => cds.db.run(SELECT.one.from(entity).where({ ID: id }));
  const readDraft = (id) => cds.db.run(SELECT.one.from(drafts).where({ ID: id }));
  const payload = (user = "alice", overrides = {}) => ({
    ...fixtures[user], ID: newId, name: "New Draft Pilot", email: "new-draft@example.test", ...overrides,
  });
  const activate = (user, id = newId) => request(user, action(id, "draftActivate"), "POST", {});

  before(async () => {
    const users = cds.env.requires.auth.users;
    users.earthmate = { password: "earthmate-dev", roles: ["SpacefarerUser"], attr: { planet: users.alice.attr.planet } };
    users.norole = { password: "norole-dev", roles: [], attr: { planet: users.alice.attr.planet } };
    users.noplanet = { password: "noplanet-dev", roles: ["SpacefarerUser"], attr: {} };
    mock.method(trial, "runTrial", () => runTrial(() => 15));
    mock.method(notifications, "send", async (message) => {
      sent.push(message);
      committedRows.push(await cds.db.tx({}, (tx) =>
        tx.run(SELECT.one.from(entity).where({ email: message.to }))));
    });
    server = await cds.server({ port: 0, in_memory: true });
    base = `http://127.0.0.1:${server.address().port}/odata/v4/spacefarer`;
    drafts = cds.services.SpacefarerService.entities.Spacefarers.drafts;
    fixtures = {};
    for (const [index, user] of ["alice", "bob"].entries()) {
      const planet = users[user].attr.planet;
      const department = await cds.db.run(SELECT.one.from("galactic.spacefarer.Department").where({ hqPlanet_ID: planet }));
      const position = await cds.db.run(SELECT.one.from("galactic.spacefarer.Position"));
      fixtures[user] = {
        ID: `eeeeeeee-4444-4444-8444-${String(index + 1).padStart(12, "0")}`,
        name: `${user} pilot`, email: `${user}-draft@example.test`, stardust: 100,
        navigationSkill: 2, trialTimeMinutes: 15, suitColor: "BLUE",
        originPlanet_ID: planet, department_ID: department.ID, position_ID: position.ID,
      };
    }
  });
  beforeEach(async () => {
    sent = [];
    committedRows = [];
    trial.runTrial.mock.resetCalls();
    await cds.db.tx(async (tx) => {
      await tx.run(DELETE.from(drafts));
      await tx.run(DELETE.from("DRAFT.DraftAdministrativeData"));
      await tx.run(DELETE.from(entity));
      await tx.run(INSERT.into(entity).entries(Object.values(fixtures)));
    });
  });
  after(async () => {
    try {
      if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    } finally {
      await cds.db?.disconnect();
      mock.restoreAll();
    }
  });

  it("creates and patches a draft, then runs the trial and notifies only after activation commits", async () => {
    const created = expect(await request("alice", "/Spacefarers", "POST", payload()), 201);
    assert.equal(created.IsActiveEntity, false);
    assert.equal(created.HasActiveEntity, false);
    assert.equal(created.name, "New Draft Pilot");
    assert.equal(created.originPlanet_ID, fixtures.alice.originPlanet_ID);
    assert.equal(await readActive(newId), undefined);
    assert.ok(await readDraft(newId));
    const patched = expect(await request("alice", draft(newId), "PATCH", {
      stardust: 140, suitColor: "RED", navigationSkill: 3, trialTimeMinutes: 60,
    }), 200);
    assert.equal(patched.navigationSkill, created.navigationSkill);
    assert.equal(patched.trialTimeMinutes, created.trialTimeMinutes);
    assert.equal(trial.runTrial.mock.callCount(), 0);
    assert.deepEqual(sent, []);
    const saved = expect(await activate("alice"), 201);
    assert.equal(saved.IsActiveEntity, true);
    assert.equal(saved.stardust, 170);
    assert.equal(saved.navigationSkill, 2);
    assert.equal(saved.trialTimeMinutes, 15);
    assert.equal(saved.suitColor, "RED");
    assert.equal(trial.runTrial.mock.callCount(), 1);
    assert.equal(sent.length, 1);
    assert.deepEqual(committedRows, [await readActive(newId)]);
    assert.equal(await readDraft(newId), undefined);
    assert.deepEqual(await cds.db.run(SELECT.from("DRAFT.DraftAdministrativeData")), []);
    expect(await activate("alice"), 404);
    assert.equal(sent.length, 1);
    assert.equal(trial.runTrial.mock.callCount(), 1);
  });

  it("defaults a new empty draft to the user's planet and cancels without trial or email", async () => {
    const created = expect(await request("alice", "/Spacefarers", "POST", { ID: newId }), 201);
    assert.equal(created.originPlanet_ID, fixtures.alice.originPlanet_ID);
    assert.equal(created.IsActiveEntity, false);
    expect(await request("alice", draft(newId), "DELETE"), 204);
    assert.equal(await readDraft(newId), undefined);
    assert.equal(await readActive(newId), undefined);
    assert.deepEqual(await cds.db.run(SELECT.from("DRAFT.DraftAdministrativeData")), []);
    assert.equal(trial.runTrial.mock.callCount(), 0);
    assert.deepEqual(sent, []);
  });

  it("edits and activates an existing record without repeating the trial or notification", async () => {
    const id = fixtures.alice.ID;
    const edited = expect(await request("alice", `${active(id)}/SpacefarerService.draftEdit`, "POST", { PreserveChanges: true }), 201);
    assert.equal(edited.HasActiveEntity, true);
    assert.equal(edited.IsActiveEntity, false);
    expect(await request("alice", draft(id), "PATCH", { stardust: 200, suitColor: "GREEN" }), 200);
    assert.deepEqual(await readActive(id), fixtures.alice);
    expect(await request("alice", active(id), "PATCH", { stardust: 999 }), 409);
    const saved = expect(await activate("alice", id), 200);
    assert.equal(saved.IsActiveEntity, true);
    assert.deepEqual(await readActive(id), { ...fixtures.alice, stardust: 200, suitColor: "GREEN" });
    assert.equal(await readDraft(id), undefined);
    assert.equal(trial.runTrial.mock.callCount(), 0);
    assert.deepEqual(sent, []);
  });

  it("discards edits and leaves the active record unchanged", async () => {
    const id = fixtures.alice.ID;
    expect(await request("alice", `${active(id)}/SpacefarerService.draftEdit`, "POST", {}), 201);
    expect(await request("alice", draft(id), "PATCH", { stardust: 999 }), 200);
    expect(await request("alice", draft(id), "DELETE"), 204);
    assert.deepEqual(await readActive(id), fixtures.alice);
    assert.equal(await readDraft(id), undefined);
    assert.deepEqual(await cds.db.run(SELECT.from("DRAFT.DraftAdministrativeData")), []);
    assert.equal(trial.runTrial.mock.callCount(), 0);
    assert.deepEqual(sent, []);
  });

  it("rejects invalid activation, retains the draft for correction, and awards one bonus on success", async () => {
    expect(await request("alice", "/Spacefarers", "POST", payload()), 201);
    expect(await request("alice", draft(newId), "PATCH", { stardust: -1 }), 200);
    expect(await activate("alice"), 400);
    assert.equal(await readActive(newId), undefined);
    assert.ok(await readDraft(newId));
    assert.equal(trial.runTrial.mock.callCount(), 0);
    assert.deepEqual(sent, []);
    expect(await request("alice", draft(newId), "PATCH", { stardust: 100 }), 200);
    expect(await activate("alice"), 201);
    assert.equal((await readActive(newId)).stardust, 130);
    assert.equal(trial.runTrial.mock.callCount(), 1);
    assert.equal(sent.length, 1);
  });

  it("rolls back activation and suppresses email when a later changeset operation fails", async () => {
    expect(await request("alice", "/Spacefarers", "POST", payload()), 201);
    const response = await request("alice", "/$batch", "POST", {
      requests: [
        { id: "activate", method: "POST", url: action(newId, "draftActivate").slice(1), atomicityGroup: "changes", headers: { "content-type": "application/json" }, body: {} },
        { id: "forbidden", method: "PATCH", url: active(fixtures.bob.ID).slice(1), atomicityGroup: "changes", headers: { "content-type": "application/json" }, body: { stardust: 999 } },
      ],
    });
    expect(response, 200);
    assert.ok(response.data.responses.some((result) => result.status === 403));
    assert.equal(await readActive(newId), undefined);
    assert.equal((await readDraft(newId)).stardust, 100);
    assert.deepEqual(sent, []);
    expect(await activate("alice"), 201);
    assert.equal((await readActive(newId)).stardust, 130);
    assert.equal(sent.length, 1);
  });

  it("enforces planet and draft-owner authorization on new, edit, read, patch, prepare, save and discard", async () => {
    for (const [user, other] of [["alice", "bob"], ["bob", "alice"]]) {
      expect(await request(user, "/Spacefarers", "POST", payload(other)), 403);
      expect(await request(user, `${active(fixtures[other].ID)}/SpacefarerService.draftEdit`, "POST", {}), 403);
      const id = fixtures[user].ID;
      expect(await request(user, `${active(id)}/SpacefarerService.draftEdit`, "POST", {}), 201);
      for (const actor of user === "alice" ? [other, "earthmate"] : [other]) {
        denied(await request(actor, draft(id)));
        denied(await request(actor, draft(id), "PATCH", { stardust: 999 }));
        denied(await request(actor, action(id, "draftPrepare"), "POST", {}));
        denied(await activate(actor, id));
        denied(await request(actor, draft(id), "DELETE"));
      }
      expect(await request(user, draft(id), "PATCH", { originPlanet_ID: fixtures[other].originPlanet_ID }), 403);
      expect(await request(user, draft(id), "PATCH", { originPlanet: { ID: fixtures[other].originPlanet_ID } }), 403);
      assert.deepEqual(await readActive(id), fixtures[user]);
      assert.equal((await readDraft(id)).originPlanet_ID, fixtures[user].originPlanet_ID);
    }
    for (const user of ["norole", "noplanet"]) {
      expect(await request(user, "/Spacefarers", "POST", payload()), 403);
      denied(await request(user, draft(fixtures.alice.ID)));
      denied(await activate(user, fixtures.alice.ID));
    }
    assert.equal(trial.runTrial.mock.callCount(), 0);
    assert.deepEqual(sent, []);
  });

  it("rechecks planet access when the same user's assignment changes after opening a draft", async () => {
    const id = fixtures.alice.ID;
    expect(await request("alice", `${active(id)}/SpacefarerService.draftEdit`, "POST", {}), 201);
    const attr = cds.env.requires.auth.users.alice.attr;
    const original = attr.planet;
    try {
      attr.planet = fixtures.bob.originPlanet_ID;
      denied(await request("alice", draft(id)));
      expect(await request("alice", draft(id), "PATCH", { stardust: 999 }), 403);
      denied(await request("alice", action(id, "draftPrepare"), "POST", {}));
      denied(await activate("alice", id));
      expect(await request("alice", draft(id), "DELETE"), 403);
      assert.deepEqual(await readActive(id), fixtures.alice);
    } finally {
      attr.planet = original;
    }
    assert.deepEqual(sent, []);
  });
});
