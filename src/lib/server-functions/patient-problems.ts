import { createServerFn } from "@tanstack/react-start";
import PatientProblem from "@/models/patient-problem";
import User from "@/models/user";
import { userRoleTokenHasCapability } from "../auth/request";
import type { Pagination } from "./builders";
import * as Sentry from "@sentry/tanstackstart-react";
import { type Result, ok, err } from "@/lib/utils";

/**
 * Get paginated problems for a patient, most recently updated first.
 */
const getPatientProblems = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { patientId: string; offset?: number; limit?: number }) => data,
  )
  .handler(
    async ({
      data,
    }): Promise<
      Result<{
        items: PatientProblem.EncodedT[];
        pagination: Pagination;
      }>
    > => {
      const authorized = await userRoleTokenHasCapability([
        User.CAPABILITIES.READ_ALL_PATIENT,
      ]);

      if (!authorized) {
        return Promise.reject({
          message: "Unauthorized: Insufficient permissions",
          source: "getPatientProblems",
        });
      }

      try {
        const result = await PatientProblem.getByPatientIdPaginated({
          patientId: data.patientId,
          limit: data.limit ?? 5,
          offset: data.offset ?? 0,
          includeCount: true,
        });

        return ok({ items: result.items, pagination: result.pagination });
      } catch (error) {
        Sentry.captureException(error);
        return err({
          _tag: "ServerError" as const,
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch patient problems",
        });
      }
    },
  );

export { getPatientProblems };
