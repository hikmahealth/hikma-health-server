import { describe, it, expect } from "vitest";
import fc from "fast-check";
import EventForm from "@/models/event-form";

describe("getOptionId", () => {
  it("returns id when present", () => {
    expect(EventForm.getOptionId({ id: "abc", label: "X", value: "x" })).toBe(
      "abc",
    );
  });

  it("falls back to value when id is missing (fast-check)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (value) => {
        const option: EventForm.FieldOption = { label: "any", value };
        expect(EventForm.getOptionId(option)).toBe(value);
      }),
    );
  });
});

describe("ensureOptionIds", () => {
  it("adds ids to options that are missing them", () => {
    const fields = [
      { id: "f1", options: [{ label: "A", value: "a" }] },
      { id: "f2", name: "no-options" },
    ];
    const result = EventForm.ensureOptionIds(fields);
    expect(result[0].options[0].id).toBeDefined();
    expect(result[0].options[0].label).toBe("A");
    expect(result[1]).toEqual(fields[1]);
  });

  it("is idempotent (fast-check)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            options: fc.array(
              fc.record({
                label: fc.string(),
                value: fc.string(),
              }),
            ),
          }),
        ),
        (fields) => {
          const once = EventForm.ensureOptionIds(fields);
          const twice = EventForm.ensureOptionIds(once);
          // IDs assigned on first pass should be preserved on second
          for (let i = 0; i < once.length; i++) {
            if (!once[i].options) continue;
            for (let j = 0; j < once[i].options.length; j++) {
              expect(twice[i].options[j].id).toBe(once[i].options[j].id);
            }
          }
        },
      ),
    );
  });

  it("leaves string options (medicine) untouched", () => {
    const fields = [{ id: "f1", options: ["aspirin", "ibuprofen"] }];
    const result = EventForm.ensureOptionIds(fields);
    expect(result[0].options).toEqual(["aspirin", "ibuprofen"]);
  });
});

describe("upsertFieldTranslation", () => {
  it("creates a new entry when none exists", () => {
    const result = EventForm.upsertFieldTranslation(
      [],
      "field-1",
      "ar",
      "name",
      "اسم",
    );
    expect(result).toHaveLength(1);
    expect(result[0].fieldId).toBe("field-1");
    expect(result[0].name.ar).toBe("اسم");
    expect(result[0].description).toEqual({});
  });

  it("updates an existing entry without duplicating", () => {
    const initial = EventForm.upsertFieldTranslation(
      [],
      "field-1",
      "ar",
      "name",
      "اسم",
    );
    const updated = EventForm.upsertFieldTranslation(
      initial,
      "field-1",
      "es",
      "name",
      "nombre",
    );
    expect(updated).toHaveLength(1);
    expect(updated[0].name.ar).toBe("اسم");
    expect(updated[0].name.es).toBe("nombre");
  });

  it("does not affect other field entries", () => {
    const initial = EventForm.upsertFieldTranslation(
      [],
      "field-1",
      "ar",
      "name",
      "اسم",
    );
    const result = EventForm.upsertFieldTranslation(
      initial,
      "field-2",
      "es",
      "description",
      "desc",
    );
    expect(result).toHaveLength(2);
    expect(result[0].fieldId).toBe("field-1");
    expect(result[1].fieldId).toBe("field-2");
  });
});

describe("upsertOptionTranslation", () => {
  it("creates entry with option translation when none exists", () => {
    const result = EventForm.upsertOptionTranslation(
      [],
      "field-1",
      "opt-1",
      "ar",
      "خيار",
    );
    expect(result).toHaveLength(1);
    expect(result[0].options["opt-1"].ar).toBe("خيار");
  });

  it("adds to existing field entry", () => {
    const initial = EventForm.upsertFieldTranslation(
      [],
      "field-1",
      "en",
      "name",
      "Name",
    );
    const result = EventForm.upsertOptionTranslation(
      initial,
      "field-1",
      "opt-1",
      "es",
      "opcion",
    );
    expect(result).toHaveLength(1);
    expect(result[0].name.en).toBe("Name");
    expect(result[0].options["opt-1"].es).toBe("opcion");
  });
});

describe("removeFieldTranslation", () => {
  it("removes the entry for the given fieldId", () => {
    const translations = [
      EventForm.upsertFieldTranslation([], "f1", "en", "name", "A")[0],
      EventForm.upsertFieldTranslation([], "f2", "en", "name", "B")[0],
    ];
    const result = EventForm.removeFieldTranslation(translations, "f1");
    expect(result).toHaveLength(1);
    expect(result[0].fieldId).toBe("f2");
  });

  it("returns empty array when removing the only entry", () => {
    const translations = EventForm.upsertFieldTranslation(
      [],
      "f1",
      "en",
      "name",
      "A",
    );
    expect(EventForm.removeFieldTranslation(translations, "f1")).toEqual([]);
  });
});

describe("getFieldTranslation", () => {
  it("finds existing translation entry", () => {
    const translations = EventForm.upsertFieldTranslation(
      [],
      "f1",
      "en",
      "name",
      "Test",
    );
    expect(EventForm.getFieldTranslation(translations, "f1")).toBeDefined();
    expect(
      EventForm.getFieldTranslation(translations, "f1")?.name.en,
    ).toBe("Test");
  });

  it("returns undefined for missing fieldId", () => {
    expect(EventForm.getFieldTranslation([], "missing")).toBeUndefined();
  });
});
