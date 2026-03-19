import { describe, it, expect, beforeEach } from "vitest";
import eventFormStore from "@/stores/event-form-builder";
import EventForm from "@/models/event-form";

function getState() {
  return eventFormStore.getSnapshot().context;
}

describe("store translation sync", () => {
  beforeEach(() => {
    eventFormStore.send({ type: "reset" });
  });

  it("reset clears translations", () => {
    eventFormStore.send({
      type: "set-form-name",
      payload: "Test",
    });
    eventFormStore.send({ type: "reset" });
    expect(getState().translations).toEqual([]);
  });

  it("set-form-name syncs to translations at primary language", () => {
    // Default language is "en"
    eventFormStore.send({ type: "set-form-name", payload: "My Form" });
    const state = getState();
    const t = EventForm.getFieldTranslation(
      state.translations,
      EventForm.FORM_NAME_FIELD_ID,
    );
    expect(t).toBeDefined();
    expect(t!.name.en).toBe("My Form");
  });

  it("set-form-description syncs to translations at primary language", () => {
    eventFormStore.send({
      type: "set-form-description",
      payload: "A description",
    });
    const state = getState();
    const t = EventForm.getFieldTranslation(
      state.translations,
      EventForm.FORM_DESCRIPTION_FIELD_ID,
    );
    expect(t).toBeDefined();
    expect(t!.name.en).toBe("A description");
  });

  it("set-field-key-value syncs name to translations", () => {
    // Add a field first
    eventFormStore.send({
      type: "add-field",
      payload: new EventForm.TextField2({
        id: "test-field-1",
        name: "",
        description: "",
        required: false,
        inputType: "text",
        length: "short",
        units: [],
      }),
    });

    // Set field name
    eventFormStore.send({
      type: "set-field-key-value",
      payload: { fieldId: "test-field-1", key: "name", value: "Blood Pressure" },
    });

    const state = getState();
    const t = EventForm.getFieldTranslation(
      state.translations,
      "test-field-1",
    );
    expect(t).toBeDefined();
    expect(t!.name.en).toBe("Blood Pressure");
  });

  it("remove-field cleans up translations", () => {
    eventFormStore.send({
      type: "add-field",
      payload: new EventForm.TextField2({
        id: "field-to-remove",
        name: "Temp",
        description: "",
        required: false,
        inputType: "text",
        length: "short",
        units: [],
      }),
    });
    eventFormStore.send({
      type: "set-field-key-value",
      payload: { fieldId: "field-to-remove", key: "name", value: "Temp" },
    });
    expect(
      EventForm.getFieldTranslation(getState().translations, "field-to-remove"),
    ).toBeDefined();

    eventFormStore.send({ type: "remove-field", payload: "field-to-remove" });
    expect(
      EventForm.getFieldTranslation(getState().translations, "field-to-remove"),
    ).toBeUndefined();
  });

  it("set-translation action stores non-primary language translation", () => {
    eventFormStore.send({
      type: "set-translation",
      payload: {
        fieldId: EventForm.FORM_NAME_FIELD_ID,
        lang: "ar",
        key: "name",
        value: "نموذج",
      },
    });
    const t = EventForm.getFieldTranslation(
      getState().translations,
      EventForm.FORM_NAME_FIELD_ID,
    );
    expect(t!.name.ar).toBe("نموذج");
  });

  it("set-option-translation action stores option translation", () => {
    eventFormStore.send({
      type: "set-option-translation",
      payload: {
        fieldId: "field-1",
        optionId: "opt-1",
        lang: "es",
        value: "opcion",
      },
    });
    const t = EventForm.getFieldTranslation(
      getState().translations,
      "field-1",
    );
    expect(t!.options["opt-1"].es).toBe("opcion");
  });
});
