# Galactic Spacefarer Adventure

A full-stack SAP CAP application built for an SAP BTP developer technical assessment. It models spacefarers and their departments, positions, and planets, and exposes an OData V4 API. A SAP Fiori Elements frontend and creation-event notifications are planned.

## Tech stack

- **Backend:** SAP CAP (Node.js), CDS, OData V4
- **Database:** SQLite (local development)
- **Frontend (planned):** SAP Fiori Elements — List Report and Object Page
- **Testing:** Node.js built-in test runner

## Project structure

| Path    | Purpose                                           |
| ------- | ------------------------------------------------- |
| `db/`   | Domain model and seed data                        |
| `srv/`  | OData service and authorization                   |
| `app/`  | Fiori application (planned)                       |
| `test/` | Database, authentication, and authorization tests |
| `docs/` | Architecture documentation                        |

## Run locally

**Prerequisites:** Node.js 22+ and npm. Install the project dependencies, then start CAP:

```bash
npm ci
npm run watch
```

The API is available at `http://localhost:4004/odata/v4/spacefarer`.

Local development uses **mocked Basic authentication**, with users configured in the development profile of `package.json`:

| User    | Password    | Assigned planet  |
| ------- | ----------- | ---------------- |
| `alice` | `alice-dev` | Earth (Planet X) |
| `bob`   | `bob-dev`   | Mars (Planet Y)  |

Example (PowerShell):

```powershell
curl.exe --user alice:alice-dev http://localhost:4004/odata/v4/spacefarer/Spacefarers
```

These are **development-only credentials**. Production deployment requires a properly configured identity provider and trusted user attributes.

## Authorization

`SpacefarerService` requires authenticated users with the `SpacefarerUser` role. Spacefarer records are restricted to the user's assigned origin planet using CAP's `@restrict` rules and additional service guards. These also prevent unauthorized creation, ownership changes, and access through navigation paths.

Planets, Departments, and Positions are shared **read-only reference data**; unlike Spacefarers, they are not isolated by planet. Security rules apply to API access, not to direct database access by trusted application code.

The navigation guard follows nested `SELECT.from.SELECT` wrappers and adds the
planet condition to the Spacefarer source segment before navigation or aggregation.
This works when CAP omits `req.params`, as it does for chained `$apply` aggregates
and `concat` branches. These aggregate counts through a foreign Spacefarer return
`0`; ordinary keyed navigation to a foreign Spacefarer returns `404`. The guard preserves
existing segment filters as `(existing) AND (planet)`, together with target
filters and source aliases.
This follows SAP's [requirement to preserve authorization filters when modifying queries](https://cap.cloud.sap/docs/guides/security/authorization#instance-based-access-control).

The guard covers source shapes emitted by the current CAP OData adapter and
exposed association graph. New associations, projections or custom queries with
joins/unions require another authorization review; this is not a general CQN
authorization engine.

## Tests

```bash
npm test
```

Tests cover SQLite constraints and defaults, authentication, and planet-based authorization (including direct reads, writes, navigation, and attempted cross-planet access). They use isolated local test databases and do not require a separately running server.

Navigation regressions exercise both users across the department, position,
origin planet and department headquarters paths, including two/three-stage
aggregates and both `concat` branches. Application-service CQN tests exercise
navigation without URL parameters and verify preservation of OR source filters,
target filters and source aliases.

For implementation details, see `db/schema.cds`, `srv/`, and the integration tests in `test/`.
