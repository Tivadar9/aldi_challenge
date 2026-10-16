const assert = require("node:assert/strict");
const { describe, it, before, after, mock } = require("node:test");
const cds = require("@sap/cds");
const notifications = require("../lib/notifications");
const { SELECT, INSERT } = cds.ql;

describe("Suit color display texts", { concurrency: false }, () => {
  const labels = {
    RED: "Red", BLUE: "Blue", GREEN: "Green", BLACK: "Black", WHITE: "White",
    SILVER: "Silver", GOLD: "Gold", PURPLE: "Purple", ORANGE: "Orange",
  };
  const entity = "galactic.spacefarer.Spacefarer";
  let server;
  let base;
  let fixtures;

  async function request(path, method = "GET", body) {
    const response = await fetch(base + path, {
      method,
      headers: {
        authorization: `Basic ${Buffer.from("alice:alice-dev").toString("base64")}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = response.headers.get("content-type")?.includes("json")
      ? await response.json() : await response.text();
    assert.ok(response.ok, JSON.stringify({ status: response.status, data }));
    return data;
  }

  before(async () => {
    mock.method(notifications, "send", async () => {});
    server = await cds.server({ port: 0, in_memory: true });
    base = `http://127.0.0.1:${server.address().port}/odata/v4/spacefarer`;
    const planet = cds.env.requires.auth.users.alice.attr.planet;
    const department = await cds.db.run(
      SELECT.one.from("galactic.spacefarer.Department").where({ hqPlanet_ID: planet }),
    );
    const position = await cds.db.run(SELECT.one.from("galactic.spacefarer.Position"));
    fixtures = Object.keys(labels).map((suitColor, index) => ({
      ID: `cccccccc-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
      name: `Suit Color ${suitColor}`,
      email: `suit-color-${suitColor.toLowerCase()}@example.test`,
      suitColor,
      stardust: 100,
      navigationSkill: 1,
      trialTimeMinutes: 25,
      originPlanet_ID: planet,
      department_ID: department.ID,
      position_ID: position.ID,
    }));
    await cds.db.run(INSERT.into(entity).entries(fixtures));
  });

  after(async () => {
    try {
      if (server) await new Promise((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
    } finally {
      await cds.db?.disconnect();
      mock.restoreAll();
    }
  });

  it("exposes computed text and TextOnly metadata while keeping the code column and filter", async () => {
    const metadata = await request("/$metadata");
    assert.match(metadata, /<Property Name="suitColorText" Type="Edm.String" MaxLength="10"\/>/);
    const textAnnotations = metadata.match(/<Annotations Target="SpacefarerService.Spacefarers\/suitColorText">([\s\S]*?)<\/Annotations>/)?.[1];
    assert.match(textAnnotations, /Term="Core.Computed" Bool="true"/);
    const codeAnnotations = metadata.match(/<Annotations Target="SpacefarerService.Spacefarers\/suitColor">([\s\S]*?)<\/Annotations>/)?.[1];
    assert.match(codeAnnotations, /Term="Common.Text" Path="suitColorText"/);
    assert.match(codeAnnotations, /Term="UI.TextArrangement" EnumMember="UI.TextArrangementType\/TextOnly"/);
    assert.match(codeAnnotations, /Term="Common.ValueListWithFixedValues" Bool="true"/);
    assert.match(codeAnnotations, /Property="CollectionPath" String="SuitColors"/);
    assert.match(codeAnnotations, /Property="LocalDataProperty" PropertyPath="suitColor"/);
    assert.match(codeAnnotations, /Property="ValueListProperty" String="code"/);
    assert.match(metadata, /<Annotation Term="UI.LineItem">[\s\S]*?<PropertyValue Property="Value" Path="suitColor"/);
    assert.match(metadata, /<Annotation Term="UI.SelectionFields">\s*<Collection>\s*<PropertyPath>suitColor<\/PropertyPath>/);
  });

  it("serves all nine read-only dropdown choices", async () => {
    const choices = await request("/SuitColors?$select=code,name&$orderby=code");
    assert.deepEqual(choices.value, Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, name]) => ({ code, name })));
    assert.deepEqual(Object.keys(labels).sort(),
      Object.keys(cds.model.definitions["galactic.spacefarer.SuitColor"].enum).sort());

    for (const method of ["POST", "PATCH", "DELETE"]) {
      const path = method === "POST" ? "/SuitColors" : "/SuitColors('RED')";
      const response = await fetch(base + path, {
        method,
        headers: {
          authorization: `Basic ${Buffer.from("alice:alice-dev").toString("base64")}`,
          "content-type": "application/json",
        },
        body: method === "DELETE" ? undefined : JSON.stringify({ code: "RED", name: "Changed" }),
      });
      assert.equal(response.status, 405, await response.text());
    }
  });

  it("calculates all nine labels in GET responses and filters by the original codes", async () => {
    for (const fixture of fixtures) {
      const saved = await request(`/Spacefarers(${fixture.ID})`);
      assert.equal(saved.suitColor, fixture.suitColor);
      assert.equal(saved.suitColorText, labels[fixture.suitColor]);

      const filter = `ID eq ${fixture.ID} and suitColor eq '${fixture.suitColor}'`;
      const list = await request(`/Spacefarers?$filter=${encodeURIComponent(filter)}&$select=ID,suitColor,suitColorText`);
      assert.deepEqual(list.value, [{
        ID: fixture.ID,
        IsActiveEntity: true,
        suitColor: fixture.suitColor,
        suitColorText: labels[fixture.suitColor],
      }]);
    }
  });

  it("accepts code-based CREATE and UPDATE and ignores client-written display text", async () => {
    const payload = {
      ...fixtures[0],
      IsActiveEntity: true,
      ID: "cccccccc-1111-4111-8111-000000000010",
      email: "suit-color-created@example.test",
      suitColor: "BLUE",
      suitColorText: "Client text",
    };
    const created = await request("/Spacefarers", "POST", payload);
    assert.equal(created.suitColor, "BLUE");
    assert.equal(created.suitColorText, "Blue");

    const updated = await request(`/Spacefarers(ID=${payload.ID},IsActiveEntity=true)`, "PATCH", {
      suitColor: "RED", suitColorText: "Client text",
    });
    assert.equal(updated.suitColor, "RED");
    assert.equal(updated.suitColorText, "Red");

    const row = await cds.db.run(SELECT.one.from(entity).where({ ID: payload.ID }));
    assert.equal(row.suitColor, "RED");
    assert.equal(Object.hasOwn(row, "suitColorText"), false);
  });
});
