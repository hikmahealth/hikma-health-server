import { describe, it, expect } from "vitest";
import { Either } from "effect";
import EventForm from "@/models/event-form";

describe("getFieldTag", () => {
  it("should return 'text' for text fieldType", () => {
    expect(EventForm.getFieldTag("text")).toBe("text");
  });

  it("should return 'separator' for separator fieldType", () => {
    expect(EventForm.getFieldTag("separator")).toBe("separator");
  });

  it("should return correct tags for all existing field types", () => {
    expect(EventForm.getFieldTag("binary")).toBe("binary");
    expect(EventForm.getFieldTag("free-text")).toBe("free-text");
    expect(EventForm.getFieldTag("medicine")).toBe("medicine");
    expect(EventForm.getFieldTag("diagnosis")).toBe("diagnosis");
    expect(EventForm.getFieldTag("date")).toBe("date");
    expect(EventForm.getFieldTag("file")).toBe("file");
    expect(EventForm.getFieldTag("options")).toBe("options");
  });
});

describe("TextDisplayField2", () => {
  it("should create a valid text display field instance", () => {
    const field = new EventForm.TextDisplayField2({
      id: "test-id",
      name: "Text Block",
      description: "",
      required: false,
      content: "Hello world",
      size: "md",
    });

    expect(field._tag).toBe("text");
    expect(field.content).toBe("Hello world");
    expect(field.size).toBe("md");
    expect(field.name).toBe("Text Block");
    expect(field.required).toBe(false);
  });

  it("should produce valid schema output via toSchema", () => {
    const field = new EventForm.TextDisplayField2({
      id: "test-id",
      name: "Text Block",
      description: "A description",
      required: false,
      content: "Some text content",
      size: "xl",
    });

    const result = EventForm.toSchema(field);
    expect(Either.isRight(result)).toBe(true);

    if (Either.isRight(result)) {
      expect(result.right._tag).toBe("text");
      expect(result.right.fieldType).toBe("text");
      expect(result.right.content).toBe("Some text content");
      expect(result.right.size).toBe("xl");
    }
  });

  it("should support all size values", () => {
    for (const size of EventForm.textDisplaySizes) {
      const field = new EventForm.TextDisplayField2({
        id: `test-${size}`,
        name: "Text Block",
        description: "",
        required: false,
        content: "Test",
        size,
      });
      const result = EventForm.toSchema(field);
      expect(Either.isRight(result)).toBe(true);
    }
  });
});

describe("SeparatorField2", () => {
  it("should create a valid separator field instance", () => {
    const field = new EventForm.SeparatorField2({
      id: "sep-id",
      name: "Separator",
      description: "",
      required: false,
    });

    expect(field._tag).toBe("separator");
    expect(field.name).toBe("Separator");
    expect(field.required).toBe(false);
  });

  it("should produce valid schema output via toSchema", () => {
    const field = new EventForm.SeparatorField2({
      id: "sep-id",
      name: "Separator",
      description: "",
      required: false,
    });

    const result = EventForm.toSchema(field);
    expect(Either.isRight(result)).toBe(true);

    if (Either.isRight(result)) {
      expect(result.right._tag).toBe("separator");
      expect(result.right.fieldType).toBe("separator");
    }
  });
});

describe("textDisplaySizes", () => {
  it("should contain exactly 5 sizes", () => {
    expect(EventForm.textDisplaySizes).toHaveLength(5);
  });

  it("should contain xxl, xl, lg, md, sm", () => {
    expect(EventForm.textDisplaySizes).toEqual(["xxl", "xl", "lg", "md", "sm"]);
  });
});
