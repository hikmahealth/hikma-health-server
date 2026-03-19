import { createServerFn } from "@tanstack/react-start";
import Prescription from "@/models/prescription";
import Patient from "@/models/patient";
import Clinic from "@/models/clinic";
import User from "@/models/user";
import { userRoleTokenHasCapability } from "../auth/request";
import type { Pagination } from "./builders";
import * as Sentry from "@sentry/tanstackstart-react";
import { Result } from "@/lib/result";

/**
 * Get all prescriptions
 * @returns {Promise<Prescription.EncodedT[]>} - The list of prescriptions
 */
const getAllPrescriptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<Prescription.EncodedT[]> => {
    const res = await Prescription.API.getAll();
    return res;
  },
);

/**
 * Get all prescriptions with their patients, clinics, and providers information
 * @returns {Promise<{prescription: Prescription.EncodedT, patient: Patient.EncodedT, clinic: Clinic.EncodedT, provider: User.EncodedT}[]>} - The list of prescriptions with their patients, clinics, and providers information
 */
const getAllPrescriptionsWithDetails = createServerFn({
  method: "GET",
}).handler(
  async (): Promise<
    {
      prescription: Prescription.EncodedT;
      patient: Patient.EncodedT;
      clinic: Clinic.EncodedT;
      provider: User.EncodedT;
    }[]
  > => {
    const res = await Prescription.API.getAllWithDetails();
    return res;
  },
);

/**
 * Toggle the status of a prescription
 * @param {string} id - The ID of the prescription
 * @param {string} status - The new status of the prescription
 * @returns {Promise<void>}
 */
const togglePrescriptionStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: string }) => data)
  .handler(async ({ data }): Promise<void> => {
    await Prescription.API.toggleStatus(data.id, data.status);
  });

/**
 * Get paginated prescriptions for a patient.
 */
const getPatientPrescriptions = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { patientId: string; offset?: number; limit?: number }) => data,
  )
  .handler(
    async ({
      data,
    }): Promise<
      Result<{
        items: Prescription.EncodedT[];
        pagination: Pagination;
      }>
    > => {
      const authorized = await userRoleTokenHasCapability([
        User.CAPABILITIES.READ_ALL_PATIENT,
      ]);

      if (!authorized) {
        return Promise.reject({
          message: "Unauthorized: Insufficient permissions",
          source: "getPatientPrescriptions",
        });
      }

      try {
        const result = await Prescription.API.getByPatientId({
          patientId: data.patientId,
          limit: data.limit ?? 10,
          offset: data.offset ?? 0,
          includeCount: true,
        });

        return Result.ok({ items: result.items, pagination: result.pagination });
      } catch (error) {
        Sentry.captureException(error);
        return Result.err({
          _tag: "ServerError" as const,
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch prescriptions",
        });
      }
    },
  );

export {
  getAllPrescriptions,
  getAllPrescriptionsWithDetails,
  togglePrescriptionStatus,
  getPatientPrescriptions,
};
