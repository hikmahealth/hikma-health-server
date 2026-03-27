import { createServerFn } from "@tanstack/react-start";
import { superAdminMiddleware } from "@/middleware/auth";
import db, { pool } from "@/db";
import { sql } from "kysely";
import { validateSQL } from "../../../db/utils";

/**
 * Validate and update the compiled SQL of a single report component.
 * Uses PREPARE/DEALLOCATE to validate syntax and schema before persisting.
 */
export const updateComponentSql = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { componentId: string; compiledSql: string }) => data,
  )
  .middleware([superAdminMiddleware])
  .handler(async ({ data }) => {
    const { componentId, compiledSql } = data;
    console.log("[updateComponentSql] called", { componentId, sqlLength: compiledSql.length });

    console.log("[updateComponentSql] validating SQL...");
    const validation = await validateSQL(pool, compiledSql);
    console.log("[updateComponentSql] validation result:", validation);
    if (!validation.valid) {
      console.error("[updateComponentSql] invalid SQL:", validation.error);
      return Promise.reject({
        message: `Invalid SQL: ${validation.error}`,
        source: "updateComponentSql",
      });
    }

    // SQL is valid — persist the update
    console.log("[updateComponentSql] persisting update for component:", componentId);
    const result = await db
      .updateTable("report_components")
      .set({
        compiled_sql: compiledSql,
        updated_at: sql`now()::timestamp with time zone`,
        last_modified: sql`now()::timestamp with time zone`,
      })
      .where("id", "=", componentId)
      .where("is_deleted", "=", false)
      .executeTakeFirst();

    console.log("[updateComponentSql] update result:", result);
    console.log("[updateComponentSql] done");
    return { componentId, compiledSql };
  });
