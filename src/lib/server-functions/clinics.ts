import { createServerFn } from "@tanstack/react-start";
import Clinic from "@/models/clinic";
import * as Sentry from "@sentry/tanstackstart-react";
import ClinicDepartment from "@/models/clinic-department";

/**
 * Get all clinics
 * @returns {Promise<Clinic.T[]>} - The list of clinics
 */
export const getAllClinics = createServerFn({ method: "GET" }).handler(
  async () => {
    const res = await Clinic.getAll();
    return res;
  },
);

export const getClinicById = createServerFn({
  method: "GET",
})
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const clinicId = data.id;
    let result:
      | {
          data: {
            clinic: Clinic.EncodedT;
            departments: ClinicDepartment.EncodedT[];
          };
          error: null;
        }
      | { data: null; error: string };
    return await Sentry.startSpan({ name: "getClinicById" }, async () => {
      try {
        const clinic = await Clinic.getById(clinicId);
        const departments =
          await ClinicDepartment.API.getActiveByClinicId(clinicId);
        // Convert the clinic to a plain object for serialization
        result = {
          data: {
            clinic: clinic as Clinic.EncodedT,
            departments: departments as ClinicDepartment.EncodedT[],
          },
          error: null,
        };

        return result;
      } catch (error) {
        console.error("Error fetching clinic:", error);
        return {
          data: null,
          error: "Error fetching clinic",
        };
      }
    });
  });

export const createDepartment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      clinicId: string;
      name: string;
      code?: string;
      description?: string;
      can_dispense_medications: boolean;
      can_perform_labs: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const departmentId = await ClinicDepartment.API.upsert({
      clinic_id: data.clinicId,
      name: data.name,
      code: data.code || null,
      description: data.description || null,
      status: ClinicDepartment.STATUS.ACTIVE,
      can_dispense_medications: data.can_dispense_medications,
      can_perform_labs: data.can_perform_labs,
      can_perform_imaging: false,
      additional_capabilities: [],
      metadata: {},
      is_deleted: false,
    });

    return { success: true, departmentId };
  });
