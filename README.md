<p align="center">
<img src="https://images.squarespace-cdn.com/content/5cc0e57236f8e70001651ea6/1599789508819-NGZXYWJDQRCULLU94QEJ/hikma-hb.png?format=300w&content-type=image/png" alt="Hikma Health" />
</p>

# Hikma Health Server

A full-stack health management system designed for offline-first operation in low-resource settings. Built with modern web technologies and optimized for reliability and performance.

## Quick Deploy

Deploy the project quickly by clicking on one of these services:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/hikmahealth/hikma-health-backend/tree/master)

---

## Quick Start Guide

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js 22.14 or higher** - [Download here](https://nodejs.org/)
- **pnpm** - Fast, disk space efficient package manager
  ```bash
  npm install -g pnpm
  ```
- **PostgreSQL** (one of the following):
  - Local installation - [Download here](https://www.postgresql.org/download/)
  - Remote database (Render, DigitalOcean, Supabase, etc.)
  - Docker container
- **Git** - For cloning the repository

### Tech Stack

- **Framework**: TanStack Start (React-based full-stack framework)
- **Language**: TypeScript
- **Database**: PostgreSQL with Kysely query builder
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: TanStack Store, XState
- **Forms**: TanStack Form with React Hook Form
- **Testing**: Vitest (unit tests) + Playwright (E2E tests)
- **Monitoring**: Sentry
- **Build Tool**: Vite

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/hikmahealth/hikma-health-backend.git
   cd hikma-health-backend
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:

   ```bash
   DATABASE_URL=postgresql://username:password@host:port/database
   ```

   Replace the connection string with your PostgreSQL credentials.

4. **Run database migrations**

   ```bash
   pnpm run migrate:latest
   ```

### Running the Project

**Development mode** (with hot reload):

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

**Production build**:

```bash
pnpm build
pnpm start
```

### Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server on port 3000 |
| `pnpm build` | Build for production |
| `pnpm start` | Run production server (with migrations) |
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm test:e2e:ui` | Run E2E tests with UI |
| `pnpm db:migrate` | Run database migrations |
| `pnpm migrate:latest` | Migrate to latest schema |
| `pnpm format` | Format code with Biome |
| `pnpm lint` | Lint code with Biome |
| `pnpm check` | Run Biome checks (format + lint) |

---

## Project Structure

```
hikma-health-server/
├── .github/              # GitHub Actions workflows and configurations
├── db/                   # Database migrations and schemas
├── docs/                 # Project documentation
├── e2e/                  # End-to-end test files
├── public/               # Static assets
├── scripts/              # Utility scripts (user permissions recovery, etc.)
├── src/
│   ├── app/             # Application-level components and layouts
│   ├── components/      # Reusable UI components (shadcn/ui)
│   ├── data/            # Data fetching and caching logic
│   ├── db/              # Database connection and utilities
│   ├── hooks/           # Custom React hooks
│   ├── integrations/    # Third-party service integrations
│   ├── lib/             # Utility functions and helpers
│   ├── middleware/      # Server middleware
│   ├── models/          # Data models and types
│   ├── routes/          # Application routes (TanStack Router)
│   ├── stores/          # State management stores
│   ├── env.ts           # Environment variable validation
│   ├── router.tsx       # Router configuration
│   └── styles.css       # Global styles
├── tests/               # Unit test files
├── .env                 # Environment variables (DO NOT COMMIT)
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite bundler configuration
└── vitest.config.ts     # Vitest test configuration
```

### Key Directories Explained

- **`src/routes/`** - File-based routing powered by TanStack Router. Each file represents a route in the application.
- **`src/components/`** - Reusable UI components built with Radix UI and styled with Tailwind CSS.
- **`src/db/`** - Database connection setup, query builders, and Kysely configuration.
- **`db/`** - SQL migration files that define the database schema evolution.
- **`src/models/`** - TypeScript types and interfaces for data structures.
- **`src/stores/`** - Client and server state management using TanStack Store and XState.

---

## Security Best Practices

### Environment Variables

- **NEVER commit the `.env` file** to version control
- The `.env` file is already included in `.gitignore`
- Store sensitive credentials (database passwords, API keys) only in `.env`
- Use different `.env` files for development, staging, and production
- In production, use environment variables provided by your hosting platform

### Database Credentials

- Use strong passwords for database accounts
- Restrict database access to specific IP addresses when possible
- Use SSL/TLS connections for remote databases
- Regularly rotate credentials

### General Security

- Keep dependencies up to date: `pnpm update`
- Review security advisories: `pnpm audit`
- Never log sensitive information (passwords, tokens, personal health data)
- Follow HIPAA and local healthcare data regulations
- Use HTTPS in production environments


## Contributing

We welcome contributions! Please ensure:

Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

- Code follows the project style (run `pnpm check`)
- All tests pass (`pnpm test`)
- E2E tests pass for critical flows (`pnpm test:e2e`)
- Commit messages are clear and descriptive


## License

[MIT](https://choosealicense.com/licenses/mit/)


## Support

For questions or issues, please open an issue on GitHub or contact the Hikma Health team.
