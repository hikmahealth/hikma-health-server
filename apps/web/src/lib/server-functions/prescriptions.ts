import { createServerFn } from "@tanstack/react-start";
import Prescription from "@/models/prescription";
import Patient from "@/models/patient";
import Clinic from "@/models/clinic";
import User from "@/models/user";

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

export {
  getAllPrescriptions,
  getAllPrescriptionsWithDetails,
  togglePrescriptionStatus,
};
