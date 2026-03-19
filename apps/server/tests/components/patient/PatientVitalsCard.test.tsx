import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import { formatVital, PatientVitalsCard } from "@/components/patient/PatientVitalsCard";

describe("formatVital", () => {
  it('returns "—" for null and undefined', () => {
    expect(formatVital(null)).toBe("—");
    expect(formatVital(undefined)).toBe("—");
  });

  it('returns "—" for empty string', () => {
    expect(formatVital("")).toBe("—");
  });

  it("converts any non-nil value to its string representation", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 0, max: 300 }),
          fc.float({ min: 0, max: 300, noNaN: true }),
          fc.string({ minLength: 1, maxLength: 20 }),
        ),
        (value) => {
          const result = formatVital(value);
          expect(result).not.toBe("—");
          expect(result).toBe(String(value));
        },
      ),
    );
  });
});

describe("PatientVitalsCard", () => {
  it("shows empty message when vital is null", () => {
    render(<PatientVitalsCard vital={null} />);
    expect(screen.getByText("No vitals recorded yet")).toBeDefined();
  });

  it("renders all 8 vital tiles when vital is provided", () => {
    const vital = {
      id: "abc",
      patient_id: "p1",
      timestamp: new Date("2025-01-15T10:00:00Z"),
      systolic_bp: 120,
      diastolic_bp: 80,
      heart_rate: 72,
      temperature_celsius: 37.0,
      oxygen_saturation: 98,
      respiratory_rate: 16,
      weight_kg: 70,
      height_cm: 175,
      bmi: "22.9",
      pulse_rate: null,
      pain_level: null,
      blood_glucose_mg_dl: null,
      is_deleted: false,
      created_at: new Date("2025-01-15"),
      updated_at: new Date("2025-01-15"),
      last_modified: new Date("2025-01-15"),
      server_created_at: new Date("2025-01-15"),
      deleted_at: null,
      metadata: {},
    };

    const { container } = render(<PatientVitalsCard vital={vital as any} />);
    const tiles = container.querySelectorAll(".border.rounded-lg");
    expect(tiles.length).toBe(8);
    expect(screen.getByText("120/80")).toBeDefined();
    expect(screen.getByText("72")).toBeDefined();
    expect(screen.getByText("22.9")).toBeDefined();
  });
});
