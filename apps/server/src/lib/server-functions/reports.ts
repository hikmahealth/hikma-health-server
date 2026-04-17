import { createServerFn } from "@tanstack/react-start";
import { superAdminMiddleware } from "@/middleware/auth";
import db, { pool } from "@/db";
import { sql } from "kysely";
import { validateSQL } from "@/db/utils";
import { Logger } from "@hikmahealth/js-utils";

/**
 * Validate and update the compiled SQL of a single report component.
 * Uses PREPARE/DEALLOCATE to validate syntax and schema before persisting.
 */
export const updateComponentSql = createServerFn({ method: "POST" })
  .inputValidator((data: { componentId: string; compiledSql: string }) => data)
  .middleware([superAdminMiddleware])
  .handler(async ({ data }) => {
    const { componentId, compiledSql } = data;
    Logger.log({
      msg: "[updateComponentSql] called",
      data: {
        componentId,
        sqlLength: compiledSql.length,
      },
    });

    Logger.log({ msg: "[updateComponentSql] validating SQL..." });
    const validation = await validateSQL(pool, compiledSql);
    Logger.log({ msg: "[updateComponentSql] validation result:", validation });
    if (!validation.valid) {
      Logger.error({
        msg: "[updateComponentSql] invalid SQL:",
        error: validation.error,
      });
      return Promise.reject({
        message: `Invalid SQL: ${validation.error}`,
        source: "updateComponentSql",
      });
    }

    // SQL is valid — persist the update
    Logger.log({
      msg: "[updateComponentSql] persisting update for component:",
      componentId,
    });
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

    Logger.log({ msg: "[updateComponentSql] update result:", result });
    Logger.log("[updateComponentSql] done");
    return { componentId, compiledSql };
  });
