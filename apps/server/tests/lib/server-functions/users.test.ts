import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the DB module — the User namespace imports it eagerly and would
// otherwise blow up at module load reading DB_HOST/etc. The gate logic
// never actually touches the DB because we mock User.API.getAll below.
vi.mock("@/db", () => ({ default: {} }));

// Mock the capability helper so each test can drive the gate decision.
// Preserve the rest of the auth/request module so transitive imports keep working.
vi.mock("@/lib/auth/request", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/request")>(
      "@/lib/auth/request",
    );
  return {
    ...actual,
    userRoleTokenHasCapability: vi.fn(),
  };
});

// Mock User.API.getAll without losing User.CAPABILITIES, which the
// authorization gate references at call time.
vi.mock("@/models/user", async () => {
  const actual =
    await vi.importActual<typeof import("@/models/user")>("@/models/user");
  return {
    ...actual,
    default: {
      ...actual.default,
      API: {
        ...actual.default.API,
        getAll: vi.fn(),
      },
    },
  };
});

import { getAllUsersImpl } from "@/lib/server-functions/users";
import { userRoleTokenHasCapability } from "@/lib/auth/request";
import User from "@/models/user";

const mockedHasCapability = vi.mocked(userRoleTokenHasCapability);
const mockedGetAll = vi.mocked(User.API.getAll);

describe("getAllUsers authorization gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty list and skips the user store read when the caller lacks READ_USER", async () => {
    // Covers unauthenticated callers and registrars (registrars are absent
    // from ROLE_CAPABILITIES, so the helper returns false).
    mockedHasCapability.mockResolvedValue(false);

    const result = await getAllUsersImpl();

    expect(result).toEqual([]);
    expect(mockedGetAll).not.toHaveBeenCalled();
  });

  it("returns the full user list when the caller has READ_USER", async () => {
    const fakeUsers = [
      { id: "u1", name: "Admin User" },
      { id: "u2", name: "Provider User" },
    ] as unknown as User.EncodedT[];
    mockedHasCapability.mockResolvedValue(true);
    mockedGetAll.mockResolvedValue(fakeUsers);

    const result = await getAllUsersImpl();

    expect(result).toBe(fakeUsers);
    expect(mockedGetAll).toHaveBeenCalledTimes(1);
  });

  it("checks specifically for the READ_USER capability", async () => {
    // Locks the gate to the documented capability — a future refactor that
    // weakens it (e.g. to no check, or to a capability registrars hold) breaks here.
    mockedHasCapability.mockResolvedValue(false);

    await getAllUsersImpl();

    expect(mockedHasCapability).toHaveBeenCalledWith([
      User.CAPABILITIES.READ_USER,
    ]);
  });
});
