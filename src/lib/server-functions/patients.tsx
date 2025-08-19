import { createServerFn } from "@tanstack/react-start";
import Patient from "@/models/patient";
import { userRoleTokenHasCapability } from "../auth/request";
import User from "@/models/user";

type Pagination = {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export const getAllPatients = createServerFn({
  method: "GET",
}).handler(
  async (): Promise<{
    patients: (typeof Patient.PatientWithAttributesSchema.Encoded)[];
    pagination: Pagination;
    error: { message: string } | null;
  }> => {
    const authorized = await userRoleTokenHasCapability([
      User.CAPABILITIES.READ_ALL_PATIENT,
    ]);

    if (!authorized) {
      return {
        patients: [],
        pagination: {
          offset: 0,
          limit: 50,
          total: 0,
          hasMore: false,
        },
        error: { message: "Unauthorized: Insufficient permissions" },
      };
    }
    const { patients, pagination } = await Patient.API.getAllWithAttributes({
      limit: 50,
      offset: 0,
      includeCount: true,
    });
    return { patients: patients, pagination, error: null };
  },
);

// Update the searchPatients function to accept pagination parameters
export const searchPatients = createServerFn({ method: "GET" })
  .validator(
    (data: { searchQuery: string; offset?: number; limit?: number }) => data,
  )
  .handler(
    async ({
      data,
    }): Promise<{
      patients: (typeof Patient.PatientWithAttributesSchema.Encoded)[];
      pagination: Pagination;
      error: { message: string } | null;
    }> => {
      // Note: The Patient.API.search function needs to be updated to support pagination
      // This is a comment for the user as requested
      const result = await Patient.API.search(data);

      // Apply pagination manually for now
      const offset = data.offset || 0;
      const limit = data.limit || 10;
      const total = result.patients.length;

      return {
        patients: result.patients.slice(offset, offset + limit),
        pagination: {
          offset,
          limit,
          total,
          hasMore: offset + limit < total,
        },
        error: null,
      };
    },
  );
