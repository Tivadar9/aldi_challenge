# Galactic Spacefarer Adventure

## Project overview

A Spacefarer management application developed for an SAP BTP Full Stack Developer technical assessment. It combines a CAP service with a Fiori interface for browsing Spacefarers and editing their stardust balances and spacesuit colors, with access restricted to the user's assigned planet.

## Tech stack

- SAP CAP 10, CDS, Node.js, and OData V4
- SQLite for local development
- SAPUI5 1.153.0 and SAP Fiori Elements List Report / Object Page
- Node.js built-in test runner

## Features

- Spacefarer CRUD API with relationships to planets, departments, and positions; required fields, unique email addresses, and input validation.
- Mock authentication and backend-enforced planet isolation, including collection reads, individual records, writes, and drafts.
- A simulated wormhole trial that assigns navigation skill and adds starter stardust when a Spacefarer is created.
- Congratulatory notifications after successful creation commits, with console logging by default and optional SMTP delivery through Nodemailer.
- An annotation-driven List Report showing names, stardust, and suit colors, with a suit-color filter and standard Fiori table sorting and incremental data loading.
- An Object Page with draft-based editing of stardust and suit color, plus read-only trial results.

## Getting started

**Prerequisites:** Node.js 24 LTS, npm, and a modern browser. Internet access is required to install dependencies and load SAPUI5 from `sapui5.hana.ondemand.com`.

From the repository root:

```bash
npm ci
npm start
```

The root installation includes the Fiori workspace and local development tools; no separate frontend installation is needed.

- **Fiori UI:** http://localhost:4004/galactic.spacefarer.spacefarermanagement/index.html
- **OData service:** http://localhost:4004/odata/v4/spacefarer/

Use these intentionally public mock credentials when prompted for Basic authentication:

| User    | Password    | Assigned planet |
| ------- | ----------- | --------------- |
| `alice` | `alice-dev` | Earth           |
| `bob`   | `bob-dev`   | Mars            |

SQLite runs in memory and automatically loads the CSV files in `db/data/` at startup. No database deployment or manual seeding is required. Changes are lost when the server restarts.

For automatic server restarts during development, use `npm run watch` instead of `npm start`.

The Fiori Object Page supports editing existing Spacefarers' stardust balances and suit colors through the draft workflow. New Spacefarers can be created through the OData API by providing all required fields.

### Optional SMTP Configuration

By default, congratulatory notifications are logged to the console without sending emails.

To enable SMTP delivery, copy .env.example to .env, set EMAIL_DELIVERY_MODE=smtp, and configure the provided SMTP environment variables.

Both STARTTLS (typically port 587) and implicit TLS (typically port 465) are supported. Credentials are excluded from Git.

SMTP delivery is optional; the application works without an external email provider.

## Testing

```bash
npm test
```

Automated tests cover database constraints, authentication, planet-based authorization, OData CRUD operations, wormhole trial calculations, notifications, SMTP configuration, draft editing, and suit-color metadata.

Integration tests use CAP HTTP servers with in-memory SQLite and reset fixtures between scenarios. SMTP delivery is mocked; no real emails are sent during testing.

Browser-based Fiori interactions are verified manually.

## Implementation notes

- **Access control:** CAP restrictions and service guards enforce the authenticated user's planet on the backend and prevent ownership transfers. Planets, departments, positions, and suit-color choices are shared read-only reference data.
- **Trial and stardust:** Each new Spacefarer completes a simulated 10–60-minute navigation trial. Their completion time determines their initial navigation skill and starter stardust bonus. Trial results are generated server-side and remain unchanged during subsequent edits.
- **Notifications:** The after-create handler delivers through the configured mode only after the transaction commits. Draft saves trigger it only when creating a new active record; editing an existing record does not send another welcome email. SMTP errors are logged without undoing the committed creation. Delivery is best effort, with no automatic retry.
- **Scope:** This is a local assessment application. Mock credentials apply only in development; production identity integration and BTP deployment configuration are not supplied. The UI depends on the external SAPUI5 CDN.

## AI Usage Disclosure

AI-assisted tools were used to generate the README and automated tests, as well as to assist with parts of the implementation.

All AI-generated code was manually reviewed and validated before being included in the project. Responsibility for the final implementation and technical decisions remains with the author.
