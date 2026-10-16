const assert = require("node:assert/strict");
const { describe, it, before, after } = require("node:test");
const { execFileSync } = require("node:child_process");
const cds = require("@sap/cds");

describe("SpacefarerService development authentication", { concurrency: false }, () => {
  let server;
  let url;
  const observed = [];
  const planets = {
    alice: { ID: "0c3a9718-2f35-4cc2-8b49-5c289d88dd01", name: "Earth" },
    bob: { ID: "0c3a9718-2f35-4cc2-8b49-5c289d88dd02", name: "Mars" },
  };

  before(async () => {
    server = await cds.server({ port: 0, in_memory: true });
    url = `http://127.0.0.1:${server.address().port}/odata/v4/spacefarer`;
    // Observe the real CAP request context only in tests; expose no identity API.
    cds.services.SpacefarerService.before("READ", (req) => {
      observed.push({
        id: req.user.id,
        roles: Object.keys(req.user.roles).sort(),
        authenticated: req.user.is("authenticated-user"),
        planet: req.user.attr.planet,
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
    await cds.db?.disconnect();
  });

  function authorization(user, password = `${user}-dev`) {
    return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  }

  for (const [user, planet] of Object.entries(planets)) {
    it(`authenticates ${user} with only SpacefarerUser and the seeded planet`, async () => {
      const response = await fetch(`${url}/Planets`, {
        headers: { authorization: authorization(user) },
      });
      assert.equal(response.status, 200);
      const { value } = await response.json();
      assert.ok(value.some((row) => row.ID === planet.ID && row.name === planet.name));
      assert.deepEqual(observed.at(-1), {
        id: user,
        roles: ["SpacefarerUser"],
        authenticated: true,
        planet: planet.ID,
      });
      // Record filtering is deliberately deferred: both planets remain visible.
      assert.ok(Object.values(planets).every((p) => value.some((row) => row.ID === p.ID)));
      assert.equal((await fetch(`${url}/Spacefarers`, {
        headers: { authorization: authorization(user) },
      })).status, 200);
    });
  }

  it("rejects anonymous access to the service, metadata, and every entity", async () => {
    for (const endpoint of ["", "/$metadata", "/Spacefarers", "/Planets", "/Departments", "/Positions"]) {
      const response = await fetch(url + endpoint);
      assert.equal(response.status, 401, endpoint);
      assert.match(response.headers.get("www-authenticate"), /^Basic /);
    }
  });

  it("rejects wrong passwords, unknown users, and CAP's extra default users", async () => {
    for (const [user, password] of [
      ["alice", "wrong"], ["bob", "wrong"], ["alice", ""], ["bob", ""],
      ["unknown", "anything"],
      ...["carol", "dave", "erin", "fred", "me", "yves"].map((id) => [id, ""]),
    ]) {
      assert.equal((await fetch(`${url}/Planets`, {
        headers: { authorization: authorization(user, password) },
      })).status, 401, user);
    }
  });

  it("takes planet identity from CAP authentication despite client supplied values", async () => {
    const response = await fetch(`${url}/Planets?planet=${planets.bob.ID}`, {
      headers: {
        authorization: authorization("alice"),
        planet: planets.bob.ID,
        "x-planet": planets.bob.ID,
        "x-user-id": "bob",
      },
    });
    assert.equal(response.status, 200);
    await response.json();
    assert.equal(observed.at(-1).id, "alice");
    assert.equal(observed.at(-1).planet, planets.alice.ID);
    assert.equal((await fetch(`${url}/Planets?planet=${planets.alice.ID}`, {
      headers: { "x-user-id": "alice", "x-planet": planets.alice.ID },
    })).status, 401);
  });

  it("excludes mocked users and passwords from the production profile", () => {
    const auth = JSON.parse(execFileSync(process.execPath, ["-e",
      "console.log(JSON.stringify(require('@sap/cds').env.requires.auth))",
    ], {
      cwd: cds.root,
      env: { ...process.env, NODE_ENV: "production", CDS_ENV: "production" },
      encoding: "utf8",
    }));
    assert.equal(auth.kind, "jwt");
    assert.equal(auth.users, undefined);
    assert.ok(!JSON.stringify(auth).includes("-dev"));
  });
});
