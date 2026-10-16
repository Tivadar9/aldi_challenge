const cds = require("@sap/cds");

module.exports = class SpacefarerService extends cds.ApplicationService {
  async init() {
    const { Spacefarers } = this.entities;
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

    return super.init();
  }
};
