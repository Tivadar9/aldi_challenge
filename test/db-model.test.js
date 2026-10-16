const assert = require("node:assert/strict");
const { describe, it, before, beforeEach, afterEach } = require("node:test");
const path = require("node:path");
const cds = require("@sap/cds");
const { SELECT, INSERT, DELETE } = cds.ql;

const ns = "galactic.spacefarer.";
const Planet = ns + "Planet";
const Department = ns + "Department";
const Position = ns + "Position";
const Spacefarer = ns + "Spacefarer";

const constraintCodes = { FOREIGNKEY: 787, UNIQUE: 2067, NOTNULL: 1299 };
const constraintError = (kind) => (error) =>
  error.errcode === constraintCodes[kind] ||
  error.code === `SQLITE_CONSTRAINT_${kind}`;

describe("CDS domain model: SQLite persistence", { concurrency: false }, () => {
  let model;
  let db;

  before(async () => {
    assert.equal(cds.env.features.assert_integrity, "db");
    model = await cds.load(path.join(__dirname, "../db/schema.cds"));
  });

  beforeEach(async () => {
    // Ad-hoc options create a new connection and override any local DB binding.
    db = await cds.connect.to({
      kind: "sqlite",
      credentials: { url: ":memory:" },
      model,
    });
    assert.equal(db.url4(), ":memory:");

    // CAP 10's third deployment argument supplies explicit data sources. An
    // empty map skips discovery of model-adjacent CSV files and init scripts.
    await cds.deploy(model, { silent: true }, {}).to(db);

    const [pragma] = await db.run("SELECT * FROM pragma_foreign_keys");
    assert.equal(
      pragma.foreign_keys,
      1,
      "SQLite foreign-key enforcement must be enabled",
    );
    for (const entity of [Planet, Department, Position, Spacefarer]) {
      assert.deepEqual(
        await db.run(SELECT.from(entity)),
        [],
        "Every test must start without seed data",
      );
    }
  });

  afterEach(async () => {
    await db?.disconnect();
  });

  async function fixtures(includeDepartment = true) {
    const planet = {
      ID: "11111111-1111-4111-8111-111111111111",
      name: "Test Planet",
    };
    const department = {
      ID: "22222222-2222-4222-8222-222222222222",
      name: "Exploration",
      hqPlanet_ID: planet.ID,
    };
    const position = {
      ID: "33333333-3333-4333-8333-333333333333",
      name: "Pilot",
      salary: "1250.75",
    };
    const spacefarer = {
      ID: "44444444-4444-4444-8444-444444444444",
      name: "Test Pilot",
      email: "pilot@example.test",
      stardust: 10,
      navigationSkill: 2,
      suitColor: "BLUE",
      originPlanet_ID: planet.ID,
      department_ID: department.ID,
      position_ID: position.ID,
    };
    await db.run(INSERT.into(Planet).entries(planet));
    if (includeDepartment)
      await db.run(INSERT.into(Department).entries(department));
    await db.run(INSERT.into(Position).entries(position));
    return { planet, department, position, spacefarer };
  }

  it("persists all four entities with the expected managed foreign-key values", async () => {
    const { planet, department, position, spacefarer } = await fixtures();
    await db.run(INSERT.into(Spacefarer).entries(spacefarer));

    assert.deepEqual(await db.run(SELECT.from(Planet)), [
      { ...planet, description: null },
    ]);
    assert.deepEqual(await db.run(SELECT.from(Department)), [
      { ...department, description: null },
    ]);
    const savedPosition = await db.run(
      SELECT.one.from(Position).where({ ID: position.ID }),
    );
    assert.equal(savedPosition.ID, position.ID);
    assert.equal(savedPosition.name, position.name);
    assert.equal(String(savedPosition.salary), position.salary);
    assert.deepEqual(await db.run(SELECT.from(Spacefarer)), [
      { ...spacefarer, trialTimeMinutes: null },
    ]);
  });

  it("rejects a valid UUID referencing a nonexistent Department at the database layer", async () => {
    const { spacefarer } = await fixtures(false);
    assert.deepEqual(await db.run(SELECT.from(Department)), []);

    // The UUID is well-formed; only the referenced row is missing. Await the
    // whole transaction because CAP generates deferred foreign-key constraints.
    await assert.rejects(
      db.run(INSERT.into(Spacefarer).entries(spacefarer)),
      constraintError("FOREIGNKEY"),
    );
    assert.deepEqual(await db.run(SELECT.from(Spacefarer)), []);
  });

  it("rejects duplicate email with a different UUID and preserves the original Spacefarer", async () => {
    const { spacefarer } = await fixtures();
    await db.run(INSERT.into(Spacefarer).entries(spacefarer));
    const duplicate = {
      ...spacefarer,
      ID: "55555555-5555-4555-8555-555555555555",
      name: "Other Pilot",
    };

    await assert.rejects(
      db.run(INSERT.into(Spacefarer).entries(duplicate)),
      constraintError("UNIQUE"),
    );
    assert.deepEqual(await db.run(SELECT.from(Spacefarer)), [
      { ...spacefarer, trialTimeMinutes: null },
    ]);
  });

  it("rejects deletion of a Planet referenced by a Department and preserves both records", async () => {
    const planet = {
      ID: "11111111-1111-4111-8111-111111111111",
      name: "Headquarters Planet",
    };
    const department = {
      ID: "22222222-2222-4222-8222-222222222222",
      name: "Exploration",
      hqPlanet_ID: planet.ID,
    };
    await db.run(INSERT.into(Planet).entries(planet));
    await db.run(INSERT.into(Department).entries(department));

    // Await commit as well: the generated foreign-key constraint is deferred.
    await assert.rejects(
      db.run(DELETE.from(Planet).where({ ID: planet.ID })),
      constraintError("FOREIGNKEY"),
    );
    assert.deepEqual(await db.run(SELECT.from(Planet)), [
      { ...planet, description: null },
    ]);
    assert.deepEqual(await db.run(SELECT.from(Department)), [
      { ...department, description: null },
    ]);
  });

  it("stores omitted stardust and navigationSkill as numeric zero defaults", async () => {
    const { spacefarer } = await fixtures();
    const input = { ...spacefarer };
    delete input.stardust;
    delete input.navigationSkill;
    await db.run(INSERT.into(Spacefarer).entries(input));

    const saved = await db.run(
      SELECT.one.from(Spacefarer).where({ ID: spacefarer.ID }),
    );
    assert.deepEqual(saved, {
      ...spacefarer,
      stardust: 0,
      navigationSkill: 0,
      trialTimeMinutes: null,
    });
    assert.equal(typeof saved.stardust, "number");
    assert.equal(typeof saved.navigationSkill, "number");
  });

  it("rejects an omitted Department foreign key through NOT NULL and persists no incomplete record", async () => {
    const { spacefarer } = await fixtures(false);
    const input = { ...spacefarer };
    delete input.department_ID;

    await assert.rejects(
      db.run(INSERT.into(Spacefarer).entries(input)),
      constraintError("NOTNULL"),
    );
    assert.deepEqual(await db.run(SELECT.from(Spacefarer)), []);
  });

  it("preserves a Position salary of 1250.75 through a database round trip", async () => {
    const input = {
      ID: "33333333-3333-4333-8333-333333333333",
      name: "Pilot",
      salary: "1250.75",
    };
    await db.run(INSERT.into(Position).entries(input));

    const saved = await db.run(
      SELECT.one.from(Position).where({ ID: input.ID }),
    );
    assert.equal(saved.ID, input.ID);
    // Compare decimal text without doing binary floating-point calculations.
    assert.equal(String(saved.salary), input.salary);
  });
});
