# Contributing to Hikma Health Server

Thank you for your interest in contributing to the Hikma Health Server project! We're excited to have you as part of our community. This guide will help you get started with contributing to the project.

## Table of Contents

- [Development Workflow](#development-workflow)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [Code Style and Quality](#code-style-and-quality)
- [Pull Request Process](#pull-request-process)
- [Environment Variables](#environment-variables)
- [Commit Guidelines](#commit-guidelines)

## Development Workflow

We follow a trunk-based development workflow where the `dev` branch serves as our main development branch:

1. **Fork the repository** and clone it to your local machine
2. **Create feature branches** from the `dev` branch (not `main`)
3. **Make your changes** and commit them with clear, descriptive messages
4. **Run tests** to ensure nothing is broken
5. **Submit pull requests** against the `dev` branch
6. **Code review** - wait for maintainer review and address feedback
7. **Merge** - once approved, your code will be merged into `dev`
8. **Release** - periodically, after thorough testing, `dev` is merged into `main` for production release

### Branch Strategy

- `main` - Production-ready code, stable releases only
- `dev` - Active development branch, all PRs should target this branch
- `feature/*` - Feature branches created from `dev`
- `fix/*` - Bug fix branches created from `dev`

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js 22.14 or higher
- pnpm (Fast, disk space efficient package manager)
- PostgreSQL (local or remote)
- Git

### Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/hikma-health-backend.git
   cd hikma-health-backend
   ```

2. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/hikmahealth/hikma-health-backend.git
   ```

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Set up environment variables**

   Create a `.env` file in the root directory (see [Environment Variables](#environment-variables) section)

5. **Run database migrations**

   ```bash
   pnpm run migrate:latest
   ```

6. **Start the development server**

   ```bash
   pnpm dev
   ```

   The application will be available at `http://localhost:3000`

### Keeping Your Fork Updated

Regularly sync your fork with the upstream repository:

```bash
git fetch upstream
git checkout dev
git merge upstream/dev
```

## Running Tests

We use two testing frameworks:

### Unit Tests (Vitest)

Run all unit tests:

```bash
pnpm test
```

Run tests in watch mode (recommended during development):

```bash
pnpm test:watch
```

Run tests with coverage:

```bash
pnpm test:coverage
```

### End-to-End Tests (Playwright)

E2E tests require admin credentials to be set in your environment variables (see [Environment Variables](#environment-variables)).

Run all E2E tests:

```bash
pnpm test:e2e
```

Run E2E tests with UI (helpful for debugging):

```bash
pnpm test:e2e:ui
```

Run E2E tests in debug mode:

```bash
pnpm test:e2e:debug
```

### Before Submitting a PR

Ensure all tests pass:

```bash
pnpm test
pnpm test:e2e
```

## Code Style and Quality

We use [Biome](https://biomejs.dev/) for code formatting and linting to maintain consistent code style across the project.

### Running Code Quality Checks

Check formatting and linting:

```bash
pnpm check
```

Format code:

```bash
pnpm format
```

Lint code:

```bash
pnpm lint
```

### Code Style Guidelines

- Use TypeScript for all new code
- Follow the existing code structure and patterns
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Write tests for new features
- Update documentation when changing functionality

## Pull Request Process

1. **Create a feature branch from `dev`**

   ```bash
   git checkout dev
   git pull upstream dev
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Write clean, readable code
   - Follow the code style guidelines
   - Add tests for new functionality
   - Update documentation if needed

3. **Run quality checks**

   ```bash
   pnpm check
   pnpm test
   pnpm test:e2e
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

5. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select `dev` as the base branch
   - Select your feature branch as the compare branch
   - Fill out the PR template with:
     - Clear description of the changes
     - Motivation and context
     - Link to related issues
     - Screenshots (if applicable)
     - Checklist items completed

7. **Respond to feedback**

   - Address review comments promptly
   - Push additional commits to your branch as needed
   - Request re-review when ready

## Environment Variables

### Development Environment

Create a `.env` file in the root directory with the following variables:

```bash
# Database connection (required)
DATABASE_URL=postgresql://username:password@localhost:5432/hikma_health

# Application environment (optional)
APP_ENV=dev

# Server URL (optional)
SERVER_URL=http://localhost:3000

# Client-side variables (optional)
VITE_APP_TITLE=Hikma Health
```

### Testing Environment

For E2E tests, you'll need admin credentials:

```bash
# E2E Test Credentials (required for E2E tests)
VITE_ADMIN_EMAIL=admin@example.com
VITE_ADMIN_PASS=your-test-password
```

### Sentry Configuration (Optional)

For error tracking and monitoring:

```bash
VITE_SENTRY_ORG=your-org
VITE_SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-token
```

**Important Security Notes:**

- Never commit `.env` files to version control
- Never share sensitive credentials in public forums or PRs
- Use different credentials for development and production
- Follow HIPAA and healthcare data protection regulations

## Commit Guidelines

We follow conventional commit messages for clarity and automated changelog generation:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - A new feature
- `fix` - A bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, missing semicolons, etc.)
- `refactor` - Code refactoring without changing functionality
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Maintenance tasks, dependency updates
- `ci` - CI/CD changes

### Examples

```bash
feat(pharmacy): add medication inventory tracking

fix(auth): resolve login redirect issue

docs(readme): update installation instructions

test(api): add tests for user creation endpoint
```

## Tech Stack

Understanding our tech stack will help you contribute effectively:

- **Framework**: TanStack Start (React-based full-stack framework)
- **Language**: TypeScript
- **Database**: PostgreSQL with Kysely query builder
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: TanStack Store, XState
- **Forms**: TanStack Form with React Hook Form
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Code Quality**: Biome (formatting and linting)
- **Monitoring**: Sentry
- **Build Tool**: Vite

## Getting Help

- **Issues**: Check existing issues or create a new one for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Documentation**: Refer to the README and docs folder

## Code of Conduct

Please be respectful and professional in all interactions. We're building software for healthcare in low-resource settings, and every contribution makes a difference.

---

Thank you for contributing to Hikma Health Server! Your efforts help improve healthcare access around the world. 🌍❤️