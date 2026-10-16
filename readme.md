# Galactic Spacefarer Adventure

A full-stack application developed for an SAP BTP Full Stack Developer technical assessment.

The goal is to build a spacefarer management system using **SAP Cloud Application Programming Model (CAP)** and **SAP Fiori Elements**, demonstrating domain modeling, OData services, lifecycle events, and authorization.

This repository is a recruitment technical assessment project.

## Technology stack

| Technology               | Purpose                       |
| ------------------------ | ----------------------------- |
| SAP CAP (Node.js)        | Backend application framework |
| Core Data Services (CDS) | Domain and service modeling   |
| SQLite                   | Local development database    |
| OData V4                 | API protocol                  |
| SAP Fiori Elements       | List Report and Object Page   |
| SAP Fiori Tools          | UI development tooling        |

## Requirements

1. Model Spacefarers, Planets, Departments, and Positions with appropriate relationships.
2. Expose CRUD operations through a protected CAP OData service.
3. Validate and enhance candidate data before creation; initiate an email notification after creation.
4. Build a Fiori Elements List Report with sorting, filtering, and pagination.
5. Build an editable Fiori Elements Object Page.

### Authorization

Users must be authenticated, and Spacefarer data must be isolated by origin planet. A user assigned to Planet X must not be able to access Spacefarer records belonging to Planet Y, including through direct API requests. Authorization will be enforced in the backend, not only in the UI.

## Project structure

The application follows standard CAP conventions:

| Directory | Responsibility                                         |
| --------- | ------------------------------------------------------ |
| `db/`     | CDS domain model and sample data                       |
| `srv/`    | Service definitions, authorization, and business logic |
| `app/`    | Fiori Elements frontend                                |
| `test/`   | Automated tests                                        |
| `docs/`   | Architecture documentation and ER diagram              |

Directories will be populated as the project progresses.

## Local development

### Prerequisites

- Node.js and npm
- SAP CAP development tools (`@sap/cds-dk`)
- Visual Studio Code (recommended)
- SAP CDS and SAP Fiori Tools extensions (recommended)

Install the locked dependencies and start the development server:

```bash
npm ci
npm run watch
```

The default CAP development URL is <http://localhost:4004>.

### Local authentication

`SpacefarerService` requires CAP's `authenticated-user` role for the entire
service, including its metadata and entities. Local development uses CAP's
[supported mocked authentication](https://cap.cloud.sap/docs/node.js/authentication)
with HTTP Basic authentication, configured only in the `[development]` profile
in `package.json`. Both users have the regular `SpacefarerUser` role; neither
has an administrator role. CAP's other built-in mock users and wildcard login
are disabled.

With the development server running, use these requests (on Windows, use
`curl.exe` to avoid PowerShell's `curl` alias):

```bash
curl --user alice:alice-dev http://localhost:4004/odata/v4/spacefarer/Planets
curl --user bob:bob-dev http://localhost:4004/odata/v4/spacefarer/Spacefarers
# No credentials: HTTP 401 with a Basic authentication challenge.
curl -i http://localhost:4004/odata/v4/spacefarer/Planets
# Wrong password: HTTP 401.
curl -i --user alice:wrong http://localhost:4004/odata/v4/spacefarer/Planets
```

In Postman or another API client, select **Basic Auth** and enter the user ID
and development password above. Browsers may cache Basic credentials; use a
separate private session when switching users.

These public mock passwords are development fixtures, **not production
credentials**. Mock authentication simulates users locally without validating
tokens from an identity provider. The production profile retains CAP's default
`jwt` strategy and contains no development users or passwords. A production
deployment still needs a configured identity provider (for example SAP Cloud
Identity Services or XSUAA), the appropriate CAP authentication integration,
and trusted role/planet claims. No identity provider or deployment
infrastructure is provisioned by this task.

Planet-based record filtering is not implemented yet: both users can currently
see records from all planets. `SpacefarerUser` is assigned to prepare for later
authorization work; this task's service access requirement is authentication.

Configuration was verified with Node.js 24.21.0, `@sap/cds` 10.1.1,
`@sap/cds-dk` 10.1.0, and `@cap-js/sqlite` 3.1.2. No dependencies were added.

## Automated tests

Run the complete suite from the project root:

```bash
npm test
```

The suite uses Node's built-in test runner and the installed CAP APIs; no
additional test libraries or running `cds watch` process are needed. Database
tests use isolated in-memory SQLite connections. Authentication tests start a
temporary CAP HTTP server on an available port with seeded in-memory SQLite,
check access for both users, inspect their actual CAP request contexts, reject
anonymous/invalid logins, verify that client parameters and headers cannot
override identity, and check that production configuration excludes mock users.
No diagnostic identity endpoint is exposed by the application.
The current dependencies require Node.js 22 or later.
