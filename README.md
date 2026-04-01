# UniComm

**UniComm** is a low-code **Customer Communications Management (CCM)** platform developed as an Honours Individual Project dissertation.

The project explores how a more accessible and modern CCM system can reduce the IT bottleneck commonly found in legacy platforms. Instead of depending heavily on specialist technical teams for routine communication changes, UniComm aims to give business users more control over template authoring, customer data handling, campaign configuration, and document generation.

Although the wider product vision of UniComm is multi-channel, the implemented dissertation scope focuses on a strong foundation for **personalised PDF communication workflows**. The current system provides browser-based template authoring, customer data management, campaign setup, manual and scheduled execution, governance-related controls, and asynchronous batch PDF generation within a multi-tenant SaaS architecture.

---

## Live System and Repository

- **Live Application:** https://unicomm.kasitphoom.com
- **Source Code:** https://github.com/Kasitphoom/UniComm/

---

## Features

- **Template Builder**  
  Drag-and-drop PDF template authoring with reusable content blocks, variable insertion, and preview support.

- **Customer Data Management**  
  Support for multiple customer lists, CSV import, attribute handling, and bulk record management.

- **Campaign Orchestration**  
  Create, configure, and manage campaigns by linking templates to customer datasets.

- **Scheduled and Manual Runs**  
  Run campaigns immediately or schedule them for later execution.

- **Asynchronous Batch Processing**  
  Large campaign runs are processed through a worker-based execution model with chunked handling.

- **Governance and Traceability**  
  Approval-related controls, template versioning foundations, and campaign history support.

- **Multi-tenant Architecture**  
  Database-per-tenant isolation with tenant-aware routing and access control.

- **Document Storage and Export**  
  Generated outputs are packaged and stored for later download.

---

## Table of Contents

- [Live System and Repository](#live-system-and-repository)
- [Dissertation Scope](#dissertation-scope)
- [Features](#features)
- [Evaluation Summary](#evaluation-summary)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development](#development)
- [Database](#database)
- [Testing](#testing)
- [Build](#build)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Project Structure

```txt
UniComm
├── app/                    # Next.js App Router pages and API routes
├── components/             # Reusable React UI components
├── features/               # Feature-specific modules and logic
├── lib/                    # Shared utilities and service clients
├── prisma/                 # Prisma schema files for main and business databases
├── public/                 # Static assets
├── query/                  # Data query and fetching functions
├── scripts/
│   └── migrations/         # Database migration scripts
├── store/                  # Redux Toolkit store and slices
├── tests/                  # Unit and end-to-end test files
├── types/                  # Shared TypeScript type definitions
├── utils/                  # General helper functions
├── docker-compose.yml      # Local MongoDB setup
├── next.config.ts          # Next.js configuration
├── vercel.json             # Vercel deployment configuration
└── package.json            # Project dependencies and scripts
```

---

## Prerequisites

Before you begin, make sure you have the following installed on your machine:

- [Node.js](https://nodejs.org/en/) - version specified in `.nvmrc`
- [npm](https://www.npmjs.com/) - comes bundled with Node.js
- [Docker](https://www.docker.com/) - required for running the local MongoDB database

If you use `nvm`, you can switch to the correct Node.js version automatically:

```bash
nvm use
```

---

## Getting Started

Follow these steps to get the project running on your local machine.

**1. Clone the repository**

```bash
git clone https://github.com/Kasitphoom/UniComm.git
cd UniComm
```

**2. Install dependencies**

```bash
npm install
```

**3. Set up environment variables**

Create a `.env` file at the root of the project. See the [Environment Variables](#environment-variables) section below for all required values.

**4. Start the local database**

```bash
docker-compose up -d
```

This starts a local MongoDB Atlas instance on port `27018`.

**5. Generate Prisma clients**

```bash
npm run prisma-generate
```

**6. Run database migrations**

```bash
npm run migrate:db
```

**7. Start the development server**

```bash
npm run dev
```

The application will be available at: **http://localhost:4100**

---

## Development

To start the development server:

```bash
npm run dev
```

The app runs on **port 4100** by default.

---

## Database

UniComm uses **MongoDB** (via Docker for local development) with **Prisma ORM**, split across two schemas:

| Schema | Purpose |
|---|---|
| `prisma/main.schema.prisma` | Core platform data (users, templates, campaigns) |
| `prisma/` (default) | Business-specific tenant data |

To run migrations for both databases:

```bash
npm run migrate:db
```

To run migrations for a specific database:

```bash
npm run migrate:db:main      # Main database only
npm run migrate:db:business  # Business database only
```

To regenerate the Prisma client after schema changes:

```bash
npm run prisma-generate
```

---

## Testing

UniComm uses **Vitest** for unit testing and **Playwright** for end-to-end (E2E) testing.

**Run unit tests**

```bash
npm run test            # Run in watch mode
npm run test:run        # Run once
npm run test:coverage   # Run with coverage report
```

**Run end-to-end tests**

```bash
npm run test:e2e          # Run headlessly
npm run test:e2e:headed   # Run with browser UI visible
```

---

## Build

To build the application for production:

```bash
npm run build
```

The output will be placed in the `.next` directory.

---

## Deployment

UniComm is configured for automatic deployment to **Vercel**.

| Component | Platform |
|---|---|
| Application | [Vercel](https://vercel.com) |
| File Storage | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) |
| Job Queue | [Upstash QStash](https://upstash.com/docs/qstash/overall/getstarted) |
| Realtime | [Ably](https://ably.com/) |

The `vercel.json` file at the root handles deployment configuration.

---

## Environment Variables

Duplicate the `example.env` file to `.env` and fill in the required values for each service.

> **Note:** This is a personal academic project. API keys and secrets are not publicly shared. You will need to set up your own credentials for each service above.

---

## Scripts

All available scripts in the project:

```bash
# Development
npm run dev                   # Start development server on port 4100
npm run build                 # Build for production
npm run start                 # Start production server on port 4100

# Database
npm run prisma-generate       # Generate Prisma clients for all schemas
npm run migrate:db            # Run migrations on both databases
npm run migrate:db:main       # Run migrations on the main database only
npm run migrate:db:business   # Run migrations on the business database only

# Testing
npm run test                  # Run unit tests in watch mode
npm run test:run              # Run unit tests once
npm run test:coverage         # Run unit tests with coverage report
npm run test:e2e              # Run E2E tests (headless)
npm run test:e2e:headed       # Run E2E tests (with browser)
```

---

## Tech Stack

**Frontend**
- [Next.js 16](https://nextjs.org) - React framework with App Router
- [React 19](https://react.dev) - UI library
- [TypeScript](https://www.typescriptlang.org) - Type-safe JavaScript
- [Tailwind CSS v4](https://tailwindcss.com) - Utility-first CSS
- [HeroUI](https://www.heroui.com/) - Component library
- [Redux Toolkit](https://redux-toolkit.js.org/) - Global state management
- [React Hook Form](https://react-hook-form.com/) + [Yup](https://github.com/jquense/yup) - Form handling and validation
- [pdfme](https://pdfme.com/) - PDF template designer and generator
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Lucide React](https://lucide.dev/) - Icon library

**Backend & Data**
- [Prisma ORM](https://www.prisma.io/) - Type-safe database client
- [MongoDB Atlas](https://www.mongodb.com/atlas) - Cloud database
- [NextAuth.js](https://next-auth.js.org/) - Authentication
- [Mailgun](https://www.mailgun.com/) - Email delivery service
- [Upstash QStash](https://upstash.com/docs/qstash/overall/getstarted) - Serverless job queue for campaign workers

**Real-time & Storage**
- [Ably](https://ably.com/) - Real-time campaign progress updates
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) - File and attachment storage

**Testing**
- [Vitest](https://vitest.dev/) - Unit testing framework
- [Playwright](https://playwright.dev/) - End-to-end testing
- [Testing Library](https://testing-library.com/) - React component testing utilities
- [MSW](https://mswjs.io/) - API mocking for tests

**DevOps & Deployment**
- [Docker Compose](https://docs.docker.com/compose/) - Local MongoDB container
- [Vercel](https://vercel.com) - Production deployment
- [GitHub Actions](https://github.com/features/actions) - CI/CD pipeline
- [Vercel Analytics](https://vercel.com/docs/analytics) + [Speed Insights](https://vercel.com/docs/speed-insights) - Performance monitoring

---

## Contributing

To contribute to this project, follow these steps and guidelines:

1. Create a new branch for your feature:

   ```bash
   git checkout -b feature/your-feature-name
    ```

2. Commit your changes following **[Conventional Commits](https://conventionalcommits.org/)**:

    ```bash
    git commit -m "<type>(<optional-scope>): <description>"
    ```

    - `<type>`: Use one of the following values. You can also refer to this [type reference](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13#types).

      - `feat`: Add a new feature
      - `fix`: Fix a bug
      - `docs`: Update documentation
      - `style`: Apply formatting or style-only changes
      - `refactor`: Refactor code without changing behavior
      - `perf`: Improve performance
      - `test`: Add or update tests
      - `chore`: Run maintenance tasks
      - `ci`: Update CI/CD configuration
      - `revert`: Revert a previous commit

    <br />

3. Push your changes and submit a Pull Request with a description of your changes:

    ```bash
    git push origin feat/your-feature-name
    ```

---

## User Manual
A user manual with step-by-step instructions and screenshots is available in the [User Manual](/docs/MANUAL.md). It covers all major features and workflows of the UniComm platform.

---

<div align="center">
  <strong>Author:</strong> Kasitphoom Thowongs &nbsp;|&nbsp;
  <a href="mailto:3044035t@student.gla.ac.uk">3044035t@student.gla.ac.uk</a> &nbsp;|&nbsp;
  <a href="https://kasitphoom.com">kasitphoom.com</a>
</div>

<br />

<div align="center">
  If you find UniComm useful, please consider giving the repository a star!
</div>