import { createServerFn } from "@tanstack/react-start";
import EventForm from "@/models/event-form";

/**
 * Get all event forms
 * @returns {Promise<EventForm.EncodedT[]>} - The list of event forms
 */
export const getEventForms = createServerFn({ method: "GET" })
  .validator(() => {})
  .handler(async (): Promise<EventForm.EncodedT[]> => {
    const result = await EventForm.API.getAll();
    return result || [];
  });
