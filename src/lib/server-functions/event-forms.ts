import { createServerFn } from "@tanstack/react-start";
import EventForm from "@/models/event-form";
import { safeJSONParse } from "../utils";

/**
 * Get all event forms
 * @returns {Promise<EventForm.EncodedT[]>} - The list of event forms
 */
export const getEventForms = createServerFn({ method: "GET" })
  .validator(() => {})
  .handler(async (): Promise<EventForm.EncodedT[]> => {
    const result = await EventForm.API.getAll();

    // For some users migrating from old old version, where the "form_fields" is a JSON string;
    return result.map((form) => {
      const formFields = (() => {
        let data;
        if (typeof form.form_fields === "string") {
          data = safeJSONParse(form.form_fields, []);
          // on error, just return the original string. usually we would return an empty []. But I want to allow the client side code one more chance to fix without throwing an error.
          if (data.length === 0) {
            data = form.form_fields;
          }
        } else {
          data = form.form_fields;
        }

        // process the array to make sure all fields are formatted from older versions of data to new ones.
        // also act as an ongoing robustness measure
        if (Array.isArray(data)) {
          data.forEach((field) => {
            // migrate text area to text input with long length
            if (field.inputType === "textarea") {
              field.inputType = "text";
              field.length = "long";
            }
            // Add a _tag to each field
            field._tag = EventForm.getFieldTag(field.fieldType);
          });
        }

        return data;
      })();

      return {
        ...form,
        form_fields: formFields,
      };
    });
  });
