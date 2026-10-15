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

Once the CAP project has been initialized, install dependencies and start the development server:

```bash
npm install
cds watch
```

The default CAP development URL is <http://localhost:4004>.

Local database configuration, authentication setup, and test instructions will be documented as they are implemented.
