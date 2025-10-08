import { createServerFn } from "@tanstack/react-start";
import Event from "@/models/event";

/**
 * Get all events by form id with pagination
 * @returns {Promise<{ events: Event.EncodedT[], pagination: { total: number, offset: number, limit: number, hasMore: boolean } }>} - The list of events and pagination info
 */
export const getEventsByFormId = createServerFn({ method: "GET" })
  .validator(
    (data: { form_id: string; limit?: number; offset?: number }) => data,
  )
  .handler(
    async ({
      data,
    }): Promise<{
      events: Event.EncodedT[];
      pagination: {
        total: number;
        offset: number;
        limit: number;
        hasMore: boolean;
      };
    }> => {
      const limit = data.limit || 50;
      const offset = data.offset || 0;
      const result = await Event.API.getAllByFormId(data.form_id, {
        limit,
        offset,
        includeCount: true,
      });

      // console.log({ result, form_id: data.form_id });
      return {
        events: result,
        pagination: {
          total: result.length,
          offset,
          limit,
          hasMore: result.length >= limit,
        },
      };
    },
  );
