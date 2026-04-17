import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validateNewPassphrase,
  validateKeyRotation,
  validateRegistration,
} from "./validation";

// ============================================================================
// validateNewPassphrase
// ============================================================================

describe("validateNewPassphrase", () => {
  it("rejects empty passphrase", () => {
    const r = validateNewPassphrase("", "");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/enter a passphrase/i);
  });

  it("rejects mismatched confirmation", () => {
    const r = validateNewPassphrase("longenough", "different");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/do not match/i);
  });

  it("rejects passphrase shorter than 8 characters", () => {
    const r = validateNewPassphrase("short", "short");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/at least 8/);
  });

  it("accepts valid matching passphrase >= 8 chars", () => {
    const r = validateNewPassphrase("securepass", "securepass");
    expect(r.valid).toBe(true);
  });

  it("accepts exactly 8 characters", () => {
    const r = validateNewPassphrase("12345678", "12345678");
    expect(r.valid).toBe(true);
  });

  // Property: any string >= 8 chars matching itself always validates
  it("valid for any matching passphrase >= 8 chars", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 200 }),
        (pass) => {
          const r = validateNewPassphrase(pass, pass);
          expect(r.valid).toBe(true);
        },
      ),
    );
  });

  // Property: mismatched strings always fail (when both non-empty and differ)
  it("invalid for any mismatched pair", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (pass, suffix) => {
          const confirm = pass + suffix; // guaranteed different
          const r = validateNewPassphrase(pass, confirm);
          expect(r.valid).toBe(false);
        },
      ),
    );
  });

  // Property: short strings always fail
  it("invalid for any string shorter than 8 chars", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 7 }),
        (pass) => {
          const r = validateNewPassphrase(pass, pass);
          expect(r.valid).toBe(false);
        },
      ),
    );
  });
});

// ============================================================================
// validateKeyRotation
// ============================================================================

describe("validateKeyRotation", () => {
  it("rejects empty current passphrase", () => {
    const r = validateKeyRotation("", "newpass12", "newpass12");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/fill in all/i);
  });

  it("rejects empty new passphrase", () => {
    const r = validateKeyRotation("current1", "", "");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/fill in all/i);
  });

  it("rejects mismatched new passphrases", () => {
    const r = validateKeyRotation("current1", "newpass12", "different");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/do not match/i);
  });

  it("rejects short new passphrase", () => {
    const r = validateKeyRotation("current1", "short", "short");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/at least 8/);
  });

  it("accepts valid rotation", () => {
    const r = validateKeyRotation("oldpass12", "newpass12", "newpass12");
    expect(r.valid).toBe(true);
  });

  // Property: valid when all conditions met
  it("valid for any (current, new >= 8, confirm == new)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 8, maxLength: 100 }),
        (current, newPass) => {
          const r = validateKeyRotation(current, newPass, newPass);
          expect(r.valid).toBe(true);
        },
      ),
    );
  });
});

// ============================================================================
// validateRegistration
// ============================================================================

describe("validateRegistration", () => {
  it("rejects empty server URL", () => {
    const r = validateRegistration("", "some-key");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/server URL/i);
  });

  it("rejects whitespace-only server URL", () => {
    const r = validateRegistration("   ", "some-key");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/server URL/i);
  });

  it("rejects empty API key", () => {
    const r = validateRegistration("https://example.com", "");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/API key/i);
  });

  it("rejects whitespace-only API key", () => {
    const r = validateRegistration("https://example.com", "  \t ");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toMatch(/API key/i);
  });

  it("accepts valid URL and API key", () => {
    const r = validateRegistration("https://example.com", "key-123");
    expect(r.valid).toBe(true);
  });

  // Property: non-blank trimmed strings always pass
  it("valid for any non-blank inputs", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        (url, key) => {
          const r = validateRegistration(url, key);
          expect(r.valid).toBe(true);
        },
      ),
    );
  });
});
