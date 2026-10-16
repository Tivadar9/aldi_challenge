const assert = require("node:assert/strict");
const { describe, it, before, beforeEach, after, mock } = require("node:test");
const cds = require("@sap/cds");
const trial = require("../lib/wormhole-trial");
const { runTrial } = trial;

const { SELECT, INSERT, DELETE } = cds.ql;

describe("Spacefarer planet authorization", { concurrency: false }, () => {
  let server;
  let base;

  const ns = "galactic.spacefarer.";

  const planets = {
    earth: "0c3a9718-2f35-4cc2-8b49-5c289d88dd01",
    mars: "0c3a9718-2f35-4cc2-8b49-5c289d88dd02",
  };

  const departments = {
    earth: "11111111-1111-4111-8111-111111111111",
    mars: "22222222-2222-4222-8222-222222222222",
  };

  const positions = {
    pilot: "33333333-3333-4333-8333-333333333333",
    engineer: "44444444-4444-4444-8444-444444444444",
  };

  const spacefarers = {
    alice: {
      ID: "aaaaaaaa-0000-4000-8000-000000000001",
      name: "Earth Pilot",
      email: "earth@example.test",
      stardust: 100,
      navigationSkill: 2,
      suitColor: "BLUE",
      originPlanet_ID: planets.earth,
      department_ID: departments.earth,
      position_ID: positions.pilot,
      trialTimeMinutes: null,
    },
    bob: {
      ID: "bbbbbbbb-0000-4000-8000-000000000001",
      name: "Mars Engineer",
      email: "mars@example.test",
      stardust: 200,
      navigationSkill: 3,
      suitColor: "RED",
      originPlanet_ID: planets.mars,
      department_ID: departments.mars,
      position_ID: positions.engineer,
      trialTimeMinutes: null,
    },
  };

  const newSpacefarerId = "cccccccc-0000-4000-8000-000000000001";

  function url(entity, id) {
    return id ? `/${entity}(${id})` : `/${entity}`;
  }

  async function request(user, path, method = "GET", body) {
    const headers = {
      "content-type": "application/json",
    };

    if (user) {
      headers.authorization = `Basic ${Buffer.from(
        `${user}:${user}-dev`,
      ).toString("base64")}`;
    }

    const response = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();

    let data;

    if (text) {
      data = response.headers.get("content-type")?.includes("json")
        ? JSON.parse(text)
        : text;
    }

    return {
      status: response.status,
      data,
    };
  }

  function assertDenied(response, expectedStatus) {
    assert.equal(
      response.status,
      expectedStatus,
      JSON.stringify(response.data),
    );

    assert.ok(response.data?.error, "Expected an OData error response");
  }

  async function getSpacefarer(id) {
    return cds.db.run(SELECT.one.from(ns + "Spacefarer").where({ ID: id }));
  }

  async function assertUnchanged(id, expected) {
    assert.deepEqual(await getSpacefarer(id), expected);
  }

  function createPayload(user, overrides = {}) {
    return {
      ...spacefarers[user],
      ID: newSpacefarerId,
      name: "New Spacefarer",
      email: "new@example.test",
      ...overrides,
    };
  }

  before(async () => {
    // Keep HTTP integration tests deterministic while using the real trial logic.
    mock.method(trial, "runTrial", () => runTrial(() => 15));
    // Additional identities exist only during this test process.
    const users = cds.env.requires.auth.users;

    users.norole = {
      password: "norole-dev",
      roles: [],
      attr: { planet: planets.earth },
    };

    users.noplanet = {
      password: "noplanet-dev",
      roles: ["SpacefarerUser"],
      attr: {},
    };

    server = await cds.server({
      port: 0,
      in_memory: true,
    });

    base = `http://127.0.0.1:${server.address().port}/odata/v4/spacefarer`;
  });

  beforeEach(async () => {
    trial.runTrial.mock.resetCalls();
    await cds.db.tx(async (tx) => {
      // Delete in foreign-key dependency order.
      for (const entity of ["Spacefarer", "Department", "Position", "Planet"]) {
        await tx.run(DELETE.from(ns + entity));
      }

      await tx.run(
        INSERT.into(ns + "Planet").entries([
          { ID: planets.earth, name: "Earth" },
          { ID: planets.mars, name: "Mars" },
        ]),
      );

      await tx.run(
        INSERT.into(ns + "Department").entries([
          {
            ID: departments.earth,
            name: "Earth Exploration",
            hqPlanet_ID: planets.earth,
          },
          {
            ID: departments.mars,
            name: "Mars Engineering",
            hqPlanet_ID: planets.mars,
          },
        ]),
      );

      await tx.run(
        INSERT.into(ns + "Position").entries([
          {
            ID: positions.pilot,
            name: "Pilot",
            salary: 5000,
          },
          {
            ID: positions.engineer,
            name: "Engineer",
            salary: 6000,
          },
        ]),
      );

      await tx.run(
        INSERT.into(ns + "Spacefarer").entries([
          spacefarers.alice,
          spacefarers.bob,
        ]),
      );
    });
  });

  after(async () => {
    try {
      if (server) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    } finally {
      await cds.db?.disconnect();
      mock.restoreAll();
    }
  });

  // -------------------------------------------------------
  // 1. ROLE AUTHORIZATION
  // -------------------------------------------------------

  it("rejects users without the SpacefarerUser role", async () => {
    const response = await request("norole", "/Spacefarers");

    assertDenied(response, 403);
  });

  // -------------------------------------------------------
  // 2. PLANET CLAIM VALIDATION
  // -------------------------------------------------------

  it("rejects authenticated users without a planet", async () => {
    const response = await request("noplanet", "/Spacefarers");

    assertDenied(response, 403);
  });

  // -------------------------------------------------------
  // 3. PLANET-ISOLATED READS
  // -------------------------------------------------------

  it("isolates collection and direct reads by planet", async () => {
    for (const [user, other] of [
      ["alice", "bob"],
      ["bob", "alice"],
    ]) {
      const own = spacefarers[user];
      const foreign = spacefarers[other];

      const collection = await request(user, "/Spacefarers");

      assert.equal(collection.status, 200);
      assert.deepEqual(
        collection.data.value.map((row) => row.ID),
        [own.ID],
      );

      const ownRead = await request(user, url("Spacefarers", own.ID));

      assert.equal(ownRead.status, 200);
      assert.equal(ownRead.data.ID, own.ID);

      const foreignRead = await request(user, url("Spacefarers", foreign.ID));

      assertDenied(foreignRead, 404);
      assert.ok(!JSON.stringify(foreignRead.data).includes(foreign.email));
    }
  });

  // -------------------------------------------------------
  // 4. FILTERING, PAGINATION AND COUNT
  // -------------------------------------------------------

  it("applies filtering, pagination and counts within the authorized planet", async () => {
    const response = await request(
      "alice",
      "/Spacefarers?$filter=stardust ge 0&$orderby=stardust desc&$top=1&$skip=0&$count=true",
    );

    assert.equal(response.status, 200);
    assert.equal(response.data["@odata.count"], 1);

    assert.deepEqual(
      response.data.value.map((row) => row.ID),
      [spacefarers.alice.ID],
    );

    const count = await request("alice", "/Spacefarers/$count");

    assert.equal(count.status, 200);
    assert.equal(count.data, "1");

    const foreignFilter = await request(
      "alice",
      `/Spacefarers?$filter=ID eq ${spacefarers.bob.ID}&$count=true`,
    );

    assert.equal(foreignFilter.status, 200);
    assert.deepEqual(foreignFilter.data.value, []);
    assert.equal(foreignFilter.data["@odata.count"], 0);
  });

  // -------------------------------------------------------
  // 5. NAVIGATION AND EXPANSION SECURITY
  // -------------------------------------------------------

  it("prevents cross-planet navigation and expansion", async () => {
    const own = spacefarers.alice;
    const foreign = spacefarers.bob;

    const paths = [
      "/department",
      "/position",
      "/originPlanet",
      "/department/hqPlanet",
    ];

    for (const path of paths) {
      const allowed = await request("alice", url("Spacefarers", own.ID) + path);

      assert.equal(
        allowed.status,
        200,
        `Authorized navigation failed: ${path}`,
      );

      const forbidden = await request(
        "alice",
        url("Spacefarers", foreign.ID) + path,
      );

      assertDenied(forbidden, 404);
      assert.ok(!JSON.stringify(forbidden.data).includes(foreign.email));
    }

    const expanded = await request(
      "alice",
      "/Spacefarers?$expand=department,position,originPlanet",
    );

    assert.equal(expanded.status, 200);
    assert.deepEqual(
      expanded.data.value.map((row) => row.ID),
      [own.ID],
    );

    const foreignExpanded = await request(
      "alice",
      url("Spacefarers", foreign.ID) +
        "?$expand=department,position,originPlanet",
    );

    assertDenied(foreignExpanded, 404);
  });

  // -------------------------------------------------------
  // 6. CREATE AUTHORIZATION
  // -------------------------------------------------------

  it("allows creation on the assigned planet and rejects foreign ownership", async () => {
    const allowed = await request(
      "alice",
      "/Spacefarers",
      "POST",
      createPayload("alice"),
    );

    assert.equal(allowed.status, 201);

    const persisted = await getSpacefarer(newSpacefarerId);

    assert.ok(persisted);
    assert.equal(persisted.originPlanet_ID, planets.earth);
    assert.equal(persisted.trialTimeMinutes, 15);
    assert.equal(persisted.navigationSkill, 2);
    assert.equal(persisted.stardust, spacefarers.alice.stardust + 30);
    assert.equal(trial.runTrial.mock.callCount(), 1);

    const foreignId = "dddddddd-0000-4000-8000-000000000001";

    const forbidden = await request(
      "alice",
      "/Spacefarers",
      "POST",
      createPayload("alice", {
        ID: foreignId,
        email: "foreign-create@example.test",
        originPlanet_ID: planets.mars,
      }),
    );

    assertDenied(forbidden, 403);

    assert.equal(await getSpacefarer(foreignId), undefined);
  });

  it("replaces client trial results and awards the bonus once when initial stardust is omitted", async () => {
    const payload = createPayload("alice", {
      navigationSkill: 999,
      trialTimeMinutes: -1,
    });
    delete payload.stardust;
    const created = await request("alice", "/Spacefarers", "POST", payload);
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const saved = await getSpacefarer(newSpacefarerId);
    assert.equal(saved.trialTimeMinutes, 15);
    assert.equal(saved.navigationSkill, 2);
    assert.equal(saved.stardust, 30);
    assert.equal(created.data.trialTimeMinutes, 15);
    assert.equal(created.data.navigationSkill, 2);
    assert.equal(created.data.stardust, 30);

    const updated = await request("alice", url("Spacefarers", saved.ID), "PATCH", {
      name: "Renamed Pilot",
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(await getSpacefarer(saved.ID), { ...saved, name: "Renamed Pilot" });
    assert.equal(trial.runTrial.mock.callCount(), 1);
  });

  it("rejects invalid initial stardust and bonus overflow without persisting a Spacefarer", async () => {
    for (const stardust of [-1, 1.5, "10", "invalid", null, true, {}, 2147483648, 2147483647]) {
      const response = await request("alice", "/Spacefarers", "POST",
        createPayload("alice", { stardust }));
      assertDenied(response, 400);
      assert.equal(await getSpacefarer(newSpacefarerId), undefined);
    }
  });

  // -------------------------------------------------------
  // 7. UPDATE AUTHORIZATION
  // -------------------------------------------------------

  it("allows own updates but rejects foreign updates and planet transfers", async () => {
    const own = spacefarers.alice;
    const foreign = spacefarers.bob;

    const allowed = await request(
      "alice",
      url("Spacefarers", own.ID),
      "PATCH",
      { name: "Updated Earth Pilot" },
    );

    assert.equal(allowed.status, 200);
    assert.equal((await getSpacefarer(own.ID)).name, "Updated Earth Pilot");

    const foreignUpdate = await request(
      "alice",
      url("Spacefarers", foreign.ID),
      "PATCH",
      { name: "Unauthorized Change" },
    );

    assertDenied(foreignUpdate, 403);
    await assertUnchanged(foreign.ID, foreign);

    const transfer = await request(
      "alice",
      url("Spacefarers", own.ID),
      "PATCH",
      { originPlanet_ID: planets.mars },
    );

    assertDenied(transfer, 403);

    const saved = await getSpacefarer(own.ID);
    assert.equal(saved.originPlanet_ID, planets.earth);
    assert.equal(saved.name, "Updated Earth Pilot");
  });

  // -------------------------------------------------------
  // 8. DELETE AUTHORIZATION
  // -------------------------------------------------------

  it("allows deleting own Spacefarers but not foreign Spacefarers", async () => {
    const foreign = spacefarers.bob;
    const own = spacefarers.alice;

    const forbidden = await request(
      "alice",
      url("Spacefarers", foreign.ID),
      "DELETE",
    );

    assertDenied(forbidden, 403);
    await assertUnchanged(foreign.ID, foreign);

    const allowed = await request(
      "alice",
      url("Spacefarers", own.ID),
      "DELETE",
    );

    assert.equal(allowed.status, 204);
    assert.equal(await getSpacefarer(own.ID), undefined);
  });

  // -------------------------------------------------------
  // 9. SHARED READ-ONLY REFERENCE ENTITIES
  // -------------------------------------------------------

  it("allows reading reference entities but rejects modifications", async () => {
    for (const entity of ["Planets", "Departments", "Positions"]) {
      const response = await request("alice", `/${entity}`);

      assert.equal(response.status, 200);
      assert.equal(response.data.value.length, 2);

      const forbiddenCreate = await request("alice", `/${entity}`, "POST", {
        name: "Unauthorized",
      });

      assertDenied(forbiddenCreate, 405);
    }

    const forbiddenUpdate = await request(
      "alice",
      url("Departments", departments.earth),
      "PATCH",
      { name: "Changed" },
    );

    assertDenied(forbiddenUpdate, 405);

    const forbiddenDelete = await request(
      "alice",
      url("Positions", positions.pilot),
      "DELETE",
    );

    assertDenied(forbiddenDelete, 405);
  });

  // -------------------------------------------------------
  // 10. ATOMIC BATCH ROLLBACK
  // -------------------------------------------------------

  it("rolls back an atomic batch when one operation violates authorization", async () => {
    const original = await getSpacefarer(spacefarers.alice.ID);

    const response = await request("alice", "/$batch", "POST", {
      requests: [
        {
          id: "1",
          method: "PATCH",
          url: `Spacefarers(${spacefarers.alice.ID})`,
          atomicityGroup: "changes",
          headers: {
            "content-type": "application/json",
          },
          body: {
            name: "Should Roll Back",
          },
        },
        {
          id: "2",
          method: "PATCH",
          url: `Spacefarers(${spacefarers.bob.ID})`,
          atomicityGroup: "changes",
          headers: {
            "content-type": "application/json",
          },
          body: {
            name: "Unauthorized Change",
          },
        },
      ],
    });

    assert.equal(response.status, 200);

    assert.ok(
      response.data.responses.some((result) => result.status === 403),
      "Expected authorization failure in batch",
    );

    await assertUnchanged(spacefarers.alice.ID, original);
    await assertUnchanged(spacefarers.bob.ID, spacefarers.bob);
  });
});
