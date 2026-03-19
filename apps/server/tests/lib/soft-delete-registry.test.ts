import { describe, it, expect } from "vitest";
import {
  SOFT_DELETE_DEPENDENCIES,
  getDependencies,
} from "../../src/lib/soft-delete-registry";

describe("SOFT_DELETE_DEPENDENCIES", () => {
  it("has entries for patients and visits", () => {
    expect(getDependencies("patients")).toBeDefined();
    expect(getDependencies("visits")).toBeDefined();
  });

  it("returns undefined for unregistered tables", () => {
    expect(getDependencies("nonexistent")).toBeUndefined();
  });

  it("patient dependencies include all expected tables", () => {
    const deps = getDependencies("patients")!;
    const tables = deps.map((d) => d.table);

    const expected = [
      "patient_additional_attributes",
      "appointments",
      "prescriptions",
      "events",
      "visits",
      "prescription_items",
      "patient_vitals",
      "patient_problems",
      "patient_observations",
    ];

    for (const table of expected) {
      expect(tables).toContain(table);
    }
  });

  it("visit dependencies include all expected tables", () => {
    const deps = getDependencies("visits")!;
    const tables = deps.map((d) => d.table);

    expect(tables).toContain("prescriptions");
    expect(tables).toContain("events");
    expect(tables).toContain("appointments");
  });

  it("has no duplicate entries in any dependency list", () => {
    for (const [parent, deps] of Object.entries(SOFT_DELETE_DEPENDENCIES)) {
      const keys = deps.map((d) => `${d.table}:${d.foreignKey}`);
      const unique = new Set(keys);
      expect(unique.size, `duplicates in ${parent}`).toBe(keys.length);
    }
  });

  it("all dependencies reference patient_id for patient deps", () => {
    const deps = getDependencies("patients")!;
    for (const dep of deps) {
      expect(dep.foreignKey).toBe("patient_id");
    }
  });
});
