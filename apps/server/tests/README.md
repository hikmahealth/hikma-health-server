# Hikma Health Server Testing Guide

This README provides guidance on running and writing tests for the Hikma Health Server project. Tests are organized in the root `tests/` directory.

## Running Tests

The project uses [Vitest](https://vitest.dev/) as its testing framework, which is configured in the root `vitest.config.ts` file.

To run all tests:

```bash
pnpm test
```

To run tests in watch mode (tests will re-run when files change):

```bash
pnpm test -- --watch
```

To run a specific test file:

```bash
pnpm test -- src/lib/__tests__/utils.test.ts
```

To run tests with coverage report:

```bash
pnpm test -- --coverage
```

## Test Structure

Tests are organized in a root-level `tests` directory that mirrors the structure of the `src` directory:

```
tests/
  lib/
    utils.test.ts
  components/
    Button.test.tsx
src/
  lib/
    utils.ts
  components/
    Button.tsx
```

## Writing Tests

### Unit Tests

Unit tests should focus on testing a single function or component in isolation. Here's an example of a unit test for the `isValidUUID` function:

```typescript
import { describe, it, expect } from "vitest";
import { isValidUUID } from "../utils";

describe("isValidUUID", () => {
  it("should return true for valid UUIDs", () => {
    expect(isValidUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("should return false for invalid UUIDs", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
  });
});
```

### Testing React Components

For React components, we use `@testing-library/react`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../Button";

describe("Button", () => {
  it("should render with the correct text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });
});
```

### Test Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it.
2. **Use Descriptive Test Names**: Make it clear what is being tested and what the expected outcome is.
3. **Keep Tests Independent**: Each test should be able to run independently of others.
4. **Use Arrange-Act-Assert Pattern**:
   - Arrange: Set up the test data and conditions
   - Act: Perform the action being tested
   - Assert: Check that the result is as expected
5. **Test Edge Cases**: Don't just test the happy path; also test error conditions and edge cases.
6. **Keep Tests Fast**: Tests should run quickly to provide rapid feedback.
7. **Mock External Dependencies**: Use mocks for external services, databases, etc.

## Mocking

Vitest provides built-in mocking capabilities:

```typescript
import { vi, describe, it, expect } from "vitest";

// Mock a function
const mockFn = vi.fn().mockReturnValue(42);

// Mock a module
vi.mock("uuid", () => ({
  v4: () => "mocked-uuid-v4",
  v1: () => "mocked-uuid-v1",
}));

// Spy on a method
const spy = vi.spyOn(object, "method");
```

## Test Setup

Global test setup code is in `src/test/setup.ts`. This file is automatically imported before running tests.

## Adding New Tests

When adding new functionality, create corresponding test files following these guidelines:

1. Place test files in the `tests` directory, mirroring the structure of the `src` directory
2. Name test files with the `.test.ts` or `.test.tsx` extension
3. Use descriptive `describe` and `it` blocks
4. Test both expected behavior and edge cases

## Test Coverage

To see which parts of the code are covered by tests:

```bash
pnpm test -- --coverage
```

This will generate a coverage report in the `coverage` directory.

## Continuous Integration

Tests are automatically run in CI when pushing to the repository. Make sure all tests pass locally before pushing your changes.
