import { createServerFn } from "@tanstack/react-start";
import Patient from "@/models/patient";
import { userRoleTokenHasCapability } from "../auth/request";
import User from "@/models/user";
import * as Sentry from "@sentry/tanstackstart-react";
import z from "zod";

type Pagination = {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export const getAllPatients = createServerFn({
  method: "GET",
})
  .validator((data?: { offset?: number; limit?: number }) => data || {})
  .handler(
    async ({
      data,
    }): Promise<{
      patients: (typeof Patient.PatientWithAttributesSchema.Encoded)[];
      pagination: Pagination;
      error: { message: string } | null;
    }> => {
      return Sentry.startSpan({ name: "getAllPatients" }, async () => {
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
            error: {
              message: "Unauthorized: Insufficient permissions",
              source: "getAllPatients",
            },
          };
        }
        const { patients, pagination } = await Patient.API.getAllWithAttributes(
          {
            limit: data?.limit || 50,
            offset: data?.offset || 0,
            includeCount: true,
          },
        );
        return { patients: patients, pagination, error: null };
      });
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
      console.log("Calling searchPatients");
      return Sentry.startSpan({ name: "searchPatients" }, async () => {
        const authorized = await userRoleTokenHasCapability([
          User.CAPABILITIES.READ_ALL_PATIENT,
        ]);

        if (!authorized) {
          return {
            patients: [],
            pagination: {
              offset: 0,
              limit: data.limit || 10,
              total: 0,
              hasMore: false,
            },
            error: {
              message: "Unauthorized: Insufficient permissions",
              source: "searchPatients",
            },
          };
        }

        const offset = data.offset || 0;
        const limit = data.limit || 10;

        // If search query is empty, use getAllWithAttributes for better performance
        if (!data.searchQuery || data.searchQuery.trim() === "") {
          const result = await Patient.API.getAllWithAttributes({
            offset,
            limit,
            includeCount: true,
          });
          return {
            patients: result.patients,
            pagination: result.pagination,
            error: null,
          };
        }

        // Use the search API with proper pagination parameters
        const result = await Patient.API.search({
          searchQuery: data.searchQuery,
          offset,
          limit,
          includeCount: true,
        });

        return {
          patients: result.patients,
          pagination: result.pagination,
          error: null,
        };
      });
    },
  );

export const getPatientById = createServerFn({
  method: "GET",
})
  .validator((data: { id: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{
      patient: Patient.EncodedT;
      error: { message: string } | null;
    }> => {
      const patient = await Patient.API.getById(data.id);

      return {
        patient,
        error: null,
      };
    },
  );
