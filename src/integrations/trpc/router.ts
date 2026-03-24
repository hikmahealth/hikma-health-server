import { createTRPCRouter, createCallerFactory } from "./init";
import { queryProcedures } from "./routers/queries";
import { commandProcedures } from "./routers/commands";

// Nested query routers
import { patientsQueryRouter } from "./routers/queries/patients";
import {
  clinicsQueryRouter,
  clinicDepartmentsQueryRouter,
} from "./routers/queries/clinics";
import {
  registrationFormQueryRouter,
  allRegistrationFormsQueryRouter,
  eventFormsQueryRouter,
} from "./routers/queries/forms";
import { appointmentsQueryRouter } from "./routers/queries/appointments";
import {
  prescriptionsQueryRouter,
  prescriptionItemsQueryRouter,
} from "./routers/queries/prescriptions";
import {
  drugsQueryRouter,
  inventoryQueryRouter,
  dispensingQueryRouter,
} from "./routers/queries/pharmacy";
import { syncQueryRouter } from "./routers/queries/sync";
import { educationQueryRouter } from "./routers/queries/education";

// Nested command routers
import { patientsCommandRouter } from "./routers/commands/patients";
import { visitsCommandRouter } from "./routers/commands/visits";
import { vitalsCommandRouter } from "./routers/commands/vitals";
import { appointmentsCommandRouter } from "./routers/commands/appointments";
import { prescriptionsCommandRouter } from "./routers/commands/prescriptions";
import { prescriptionItemsCommandRouter } from "./routers/commands/prescription-items";
import { dispensingCommandRouter } from "./routers/commands/pharmacy";
import { syncCommandRouter } from "./routers/commands/sync";
import { educationCommandRouter } from "./routers/commands/education";

/** Query-only router served at /rpc/query */
export const queryAppRouter = createTRPCRouter({
  // Existing flat procedures (unchanged wire names)
  ...queryProcedures,
  // Nested domain routers
  patients: patientsQueryRouter,
  clinics: clinicsQueryRouter,
  clinic_departments: clinicDepartmentsQueryRouter,
  registration_form: registrationFormQueryRouter,
  all_registration_forms: allRegistrationFormsQueryRouter,
  event_forms: eventFormsQueryRouter,
  appointments: appointmentsQueryRouter,
  prescriptions: prescriptionsQueryRouter,
  prescription_items: prescriptionItemsQueryRouter,
  drugs: drugsQueryRouter,
  inventory: inventoryQueryRouter,
  dispensing: dispensingQueryRouter,
  sync: syncQueryRouter,
  education: educationQueryRouter,
});

/** Command-only router served at /rpc/command */
export const commandAppRouter = createTRPCRouter({
  // Existing flat procedures (unchanged wire names)
  ...commandProcedures,
  // Nested domain routers
  patients: patientsCommandRouter,
  visits: visitsCommandRouter,
  vitals: vitalsCommandRouter,
  appointments: appointmentsCommandRouter,
  prescriptions: prescriptionsCommandRouter,
  prescription_items: prescriptionItemsCommandRouter,
  dispensing: dispensingCommandRouter,
  sync: syncCommandRouter,
  education: educationCommandRouter,
});

/** Merged router for client-side type inference (never served directly) */
const appRouter = createTRPCRouter({
  ...queryProcedures,
  ...commandProcedures,
  // Include nested routers in merged type
  patients_q: patientsQueryRouter,
  clinics: clinicsQueryRouter,
  clinic_departments: clinicDepartmentsQueryRouter,
  registration_form: registrationFormQueryRouter,
  all_registration_forms: allRegistrationFormsQueryRouter,
  event_forms: eventFormsQueryRouter,
  appointments_q: appointmentsQueryRouter,
  prescriptions_q: prescriptionsQueryRouter,
  prescription_items_q: prescriptionItemsQueryRouter,
  drugs: drugsQueryRouter,
  inventory: inventoryQueryRouter,
  dispensing_q: dispensingQueryRouter,
  sync_q: syncQueryRouter,
  education_q: educationQueryRouter,
  patients_c: patientsCommandRouter,
  visits: visitsCommandRouter,
  vitals: vitalsCommandRouter,
  appointments_c: appointmentsCommandRouter,
  prescriptions_c: prescriptionsCommandRouter,
  prescription_items_c: prescriptionItemsCommandRouter,
  dispensing_c: dispensingCommandRouter,
  sync_c: syncCommandRouter,
  education_c: educationCommandRouter,
});

export type AppRouter = typeof appRouter;

/**
 * Server-side caller for invoking tRPC procedures directly (e.g. from createServerFn).
 * Pass a TRPCContext with the auth header to get full middleware processing.
 */
export const createServerCaller = createCallerFactory(commandAppRouter);
