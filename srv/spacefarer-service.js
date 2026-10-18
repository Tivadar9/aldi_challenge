const cds = require("@sap/cds");
const { runTrial } = require("../lib/wormhole-trial");
const notifications = require("../lib/notifications");

module.exports = class SpacefarerService extends cds.ApplicationService {
  async init() {
    const { Spacefarers } = this.entities;
    this.before("CREATE", Spacefarers, (req) => {
      const initial = req.data.stardust;
      if (
        initial !== undefined &&
        (!Number.isInteger(initial) || initial < 0 || initial > 2147483647)
      ) {
        return req.reject(
          400,
          "Initial stardust must be a nonnegative Integer",
        );
      }

      const trial = runTrial();
      const stardust = (initial ?? 0) + trial.stardustBonus;
      if (stardust > 2147483647) {
        return req.reject(
          400,
          "Stardust including the trial bonus exceeds the Integer limit",
        );
      }
      req.data.trialTimeMinutes = trial.trialTimeMinutes;
      req.data.navigationSkill = trial.navigationSkill;
      req.data.stardust = stardust;
    });

    this.after("CREATE", Spacefarers, (_result, req) => {
      const message = notifications.congratulatoryEmail(req.data);
      const spacefarerId = req.data.ID;
      // `after CREATE` is still inside the transaction. `succeeded` runs only after the whole transaction commits.
      req.on("succeeded", async () => {
        try {
          await notifications.send(message);
        } catch (error) {
          cds
            .log("notifications")
            .error(
              `Congratulatory email delivery failed for Spacefarer ${spacefarerId}`,
              error,
            );
        }
      });
    });

    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    this.before("*", async (req) => {
      const planet = req.user.attr.planet;

      if (
        typeof planet !== "string" ||
        !uuid.test(planet) ||
        !(await cds
          .tx(req)
          .run(
            cds.ql.SELECT.one
              .from("galactic.spacefarer.Planet")
              .columns("ID")
              .where({ ID: planet }),
          ))
      ) {
        req.reject(403, "A valid assigned planet is required");
      }
    });

    const validateOwnership = (req) => {
      for (const association of ["originPlanet", "department", "position"]) {
        if (Object.hasOwn(req.data, association)) {
          req.reject(
            403,
            "Deep association writes are not permitted; use foreign keys",
          );
        }
      }
      if (
        (req.event === "CREATE" || req.event === "NEW" ||
          Object.hasOwn(req.data, "originPlanet_ID")) &&
        req.data.originPlanet_ID !== req.user.attr.planet
      ) {
        req.reject(403, "Spacefarers must belong to your assigned planet");
      }
    };
    this.before(["CREATE", "UPDATE"], Spacefarers, validateOwnership);
    this.before(["NEW", "PATCH"], Spacefarers.drafts, (req) => {
      if (req.event === "NEW" && !Object.hasOwn(req.data, "originPlanet_ID")) {
        req.data.originPlanet_ID = req.user.attr.planet;
      }
      validateOwnership(req);
    });
    this.before(["PATCH", "CANCEL", "draftPrepare"], Spacefarers.drafts, async (req) => {
      const draft = await cds.tx(req).run(
        cds.ql.SELECT.one.from(req.subject).columns("originPlanet_ID"),
      );
      if (draft && draft.originPlanet_ID !== req.user.attr.planet) {
        req.reject(403, "Spacefarers must belong to your assigned planet");
      }
    });

    this.before("READ", async (req) => {
      let select = req.query?.SELECT;

      // Handle simple nested SELECT wrappers.
      while (select?.from?.SELECT) {
        select = select.from.SELECT;
      }

      const ref = select?.from?.ref;
      if (!Array.isArray(ref) || ref.length === 0) return;

      const firstSegment = ref[0];
      const sourceName =
        typeof firstSegment === "string" ? firstSegment : firstSegment?.id;

      // Draft ownership is enforced by CAP; planet ownership also applies to
      // drafts, including after a user's assigned planet changes.
      const isDraftSource = sourceName === Spacefarers.drafts.name;
      if (sourceName !== Spacefarers.name && !isDraftSource) return;
      if (ref.length < 2 && !isDraftSource) return;

      // Restrict the source before navigation and aggregation. CAP may omit
      // req.params for nested SELECTs and concat branches.
      const source =
        typeof firstSegment === "string"
          ? { id: firstSegment }
          : { ...firstSegment };
      const planetFilter = [
        { ref: ["originPlanet_ID"] },
        "=",
        { val: req.user.attr.planet },
      ];
      source.where = source.where?.length
        ? [{ xpr: source.where }, "and", { xpr: planetFilter }]
        : planetFilter;
      ref[0] = source;

      // Preserve 404 responses for ordinary keyed navigation. Ownership is
      // enforced by the source filter even when URL params are unavailable.
      if (typeof req.params?.[0]?.ID === "string") {
        const ownedSpacefarer = await cds.tx(req).run(
          cds.ql.SELECT.one.from({ ref: [source] }).columns("ID"),
        );

        if (!ownedSpacefarer) {
          return req.reject(404, "Spacefarer not found");
        }
      }
    });

    return super.init();
  }
};
