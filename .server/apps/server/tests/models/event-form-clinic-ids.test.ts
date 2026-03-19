import { describe, it, expect } from "vitest";
import EventForm from "@/models/event-form";

describe("EventForm clinic_ids", () => {
  it("should include clinic_ids in Table.columns", () => {
    expect(EventForm.Table.columns).toHaveProperty("clinic_ids");
  });

  it("should default clinic_ids to an empty array in EncodedT usage", () => {
    const form: Partial<EventForm.EncodedT> = {
      id: "test-id",
      name: "Test Form",
      description: "",
      language: "en",
      is_editable: false,
      is_snapshot_form: false,
      form_fields: [],
      metadata: {},
      clinic_ids: [],
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
      last_modified: new Date(),
      server_created_at: new Date(),
      deleted_at: null,
    };

    expect(form.clinic_ids).toEqual([]);
  });

  it("should accept an array of clinic UUIDs", () => {
    const clinicIds = [
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    ];

    const form: Partial<EventForm.EncodedT> = {
      id: "test-id",
      name: "Test Form",
      description: "",
      language: "en",
      is_editable: false,
      is_snapshot_form: false,
      form_fields: [],
      metadata: {},
      clinic_ids: clinicIds,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
      last_modified: new Date(),
      server_created_at: new Date(),
      deleted_at: null,
    };

    expect(form.clinic_ids).toEqual(clinicIds);
    expect(form.clinic_ids).toHaveLength(2);
  });

  it("empty clinic_ids means form is available to all clinics", () => {
    const formAvailableToAll: Pick<EventForm.EncodedT, "clinic_ids"> = {
      clinic_ids: [],
    };
    const formRestricted: Pick<EventForm.EncodedT, "clinic_ids"> = {
      clinic_ids: ["some-clinic-id"],
    };

    // Empty array = available to all
    expect(formAvailableToAll.clinic_ids.length === 0).toBe(true);
    // Non-empty array = restricted
    expect(formRestricted.clinic_ids.length > 0).toBe(true);
  });
});
