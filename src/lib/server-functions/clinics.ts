import { createServerFn } from "@tanstack/react-start";
import Clinic from "@/models/clinic";

/**
 * Get all clinics
 * @returns {Promise<Clinic.T[]>} - The list of clinics
 */
const getAllClinics = createServerFn({ method: "GET" }).handler(async () => {
  const res = await Clinic.getAll();
  return res;
});

export { getAllClinics };
