const cds = require("@sap/cds");
const { runTrial } = require("../lib/wormhole-trial");
const notifications = require("../lib/notifications");

module.exports = class SpacefarerService extends cds.ApplicationService {
  async init() {
    const { Spacefarers } = this.entities;
    this.before("CREATE", Spacefarers, (req) => {
      const trial = runTrial();
      const stardust = (req.data.stardust ?? 0) + trial.stardustBonus;
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

    this.before(["CREATE", "UPDATE"], Spacefarers, (req) => {
      for (const association of ["originPlanet", "department", "position"]) {
        if (Object.hasOwn(req.data, association)) {
          req.reject(
            403,
            "Deep association writes are not permitted; use foreign keys",
          );
        }
      }
      if (
        (req.event === "CREATE" ||
          Object.hasOwn(req.data, "originPlanet_ID")) &&
        req.data.originPlanet_ID !== req.user.attr.planet
      ) {
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
      if (!Array.isArray(ref) || ref.length < 2) return;

      const firstSegment = ref[0];
      const sourceName =
        typeof firstSegment === "string" ? firstSegment : firstSegment?.id;

      // Only handle navigation originating from Spacefarers.
      if (sourceName !== Spacefarers.name) return;

      // CAP exposes entity keys from the request URL.
      const spacefarerId = req.params?.[0]?.ID;

      // Do not allow unrecognized navigation shapes.
      if (typeof spacefarerId !== "string") {
        return req.reject(403, "Unsupported Spacefarer navigation");
      }

      // Verify ownership of the source Spacefarer.
      const ownedSpacefarer = await cds.tx(req).run(
        SELECT.one.from(Spacefarers).columns("ID").where({
          ID: spacefarerId,
          originPlanet_ID: req.user.attr.planet,
        }),
      );

      if (!ownedSpacefarer) {
        return req.reject(404, "Spacefarer not found");
      } // Ownership verified. Let CAP process the original query.
    });

    await super.init();

    // CAP 10 validates before custom `before` handlers. Discard client trial
    // results and check the initial amount before that validation can run.
    const validate = this.handle_validations;
    this.handle_validations = function (req) {
      if (req.event === "CREATE" && req.target?.name === Spacefarers.name) {
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
        delete req.data.navigationSkill;
        delete req.data.trialTimeMinutes;
      }
      return validate.call(this, req);
    };
    return this;
  }
};
