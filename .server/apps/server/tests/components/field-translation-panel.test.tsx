import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldTranslationPanel } from "@/components/form-builder/FieldTranslationPanel";
import EventForm from "@/models/event-form";

const noop = vi.fn();

describe("FieldTranslationPanel", () => {
  it("renders nothing for separator fields", () => {
    const { container } = render(
      <FieldTranslationPanel
        field={{
          _tag: "separator",
          fieldType: "separator",
          id: "sep-1",
          name: "Separator",
          description: "",
          required: false,
        }}
        primaryLanguage="en"
        translation={undefined}
        onTranslationChange={noop}
        onOptionTranslationChange={noop}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders Manage Translations button for regular fields", () => {
    render(
      <FieldTranslationPanel
        field={{
          _tag: "free-text",
          fieldType: "free-text",
          id: "f1",
          name: "Blood Pressure",
          description: "Enter BP",
          required: false,
          inputType: "text",
          length: "short",
          units: [],
        }}
        primaryLanguage="en"
        translation={undefined}
        onTranslationChange={noop}
        onOptionTranslationChange={noop}
      />,
    );
    expect(screen.getByText("Manage Translations")).toBeDefined();
  });

  it("renders Manage Translations button for options fields", () => {
    render(
      <FieldTranslationPanel
        field={{
          _tag: "options",
          fieldType: "options",
          id: "f2",
          name: "Status",
          description: "",
          required: false,
          inputType: "select",
          multi: false,
          options: [
            { id: "o1", label: "Active", value: "active" },
            { id: "o2", label: "Inactive", value: "inactive" },
          ],
        }}
        primaryLanguage="en"
        translation={undefined}
        onTranslationChange={noop}
        onOptionTranslationChange={noop}
      />,
    );
    expect(screen.getByText("Manage Translations")).toBeDefined();
  });
});
