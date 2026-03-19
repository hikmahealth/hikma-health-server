import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  isValidTokenFormat,
  extractTokenFromHeader,
  authenticateRequest,
  createMockTokenVerifier,
} from "../../src/lib/auth-service";

describe("isValidTokenFormat", () => {
  it("should accept non-empty strings", () => {
    expect(isValidTokenFormat("abc")).toBe(true);
    expect(isValidTokenFormat("some-token-value")).toBe(true);
  });

  it("should reject empty and whitespace-only strings", () => {
    expect(isValidTokenFormat("")).toBe(false);
    expect(isValidTokenFormat("   ")).toBe(false);
    expect(isValidTokenFormat("\t")).toBe(false);
  });

  it("property: accepts any non-blank string", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (token) => {
          expect(isValidTokenFormat(token)).toBe(true);
        },
      ),
    );
  });
});

describe("extractTokenFromHeader", () => {
  it("should extract token from Bearer header", () => {
    expect(extractTokenFromHeader("Bearer my-token")).toBe("my-token");
  });

  it("should return null for missing header", () => {
    expect(extractTokenFromHeader(undefined)).toBeNull();
    expect(extractTokenFromHeader("")).toBeNull();
  });

  it("should return null for non-Bearer headers", () => {
    expect(extractTokenFromHeader("Basic abc123")).toBeNull();
    expect(extractTokenFromHeader("Token abc123")).toBeNull();
  });

  it("should trim whitespace from extracted token", () => {
    expect(extractTokenFromHeader("Bearer   spaced-token  ")).toBe("spaced-token");
  });

  it("property: roundtrip — extracting a Bearer-prefixed token returns it", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (token) => {
          const header = `Bearer ${token}`;
          expect(extractTokenFromHeader(header)).toBe(token.trim());
        },
      ),
    );
  });
});

describe("authenticateRequest", () => {
  const verifier = createMockTokenVerifier();

  it("should succeed with valid Bearer token", async () => {
    const result = await authenticateRequest(verifier, {
      authorization: "Bearer valid-token",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user.email).toBe("user@example.com");
    }
  });

  it("should fail with missing headers", async () => {
    const result = await authenticateRequest(verifier, undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unauthorized");
    }
  });

  it("should fail with missing authorization header", async () => {
    const result = await authenticateRequest(verifier, {});
    expect(result.success).toBe(false);
  });

  it("should fail with non-Bearer authorization", async () => {
    const result = await authenticateRequest(verifier, {
      authorization: "Basic abc",
    });
    expect(result.success).toBe(false);
  });

  it("should fail when token verifier rejects token", async () => {
    const rejectingVerifier = {
      verifyToken: async () => null,
    };
    const result = await authenticateRequest(rejectingVerifier, {
      authorization: "Bearer rejected-token",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid token");
    }
  });
});
