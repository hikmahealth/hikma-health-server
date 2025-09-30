/**
 * Recovery and self healing script to standardize and fix and update any issues with user permissions.
 * Use case: Ideally this runs frequently, our could run on system start, if added to the pnpm run start script.
 *
 * It works by fetching all users from the database and:
 * FOR ROLES
 * 1. If the user does not have a role, they just get a "provider" role.
 * 2. If the user has a role, but it is not a valid role, they get a "provider" role.
 * 3. If the user has a valid role, they keep their role.
 *
 * FOR CLINIC PERMISSIONS
 * 1. If there is a missing clinic in the user_clinic_permissions table, it is created with the user's role defaults (registrar only gets can_register, provider gets ... and so on. If a user is super_admin, all permissions are granted)
 * 2. If for all clinics the user already has an entry, keep the entry (even if its mismatched to the role type. e.g: if an existing registrar has can_view_history for a certain clinic, just keep it.)
 *
 *
 * TODO:
 * 1. If a user does not have a clinic id, one must be added for them as the default one. if there are no clinics then a default one must be created.
 *
 * SOME UNCONVENTIONAL DECISIONS MADE:
 * 1. Not running in transactions, like everything else in HH, we want to accept partial updates. so that as much of the system is fixed as possible.
 */

import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { getDatabaseConfig } from "../src/db/db-config";
import type { Database } from "../src/db/index";
import "dotenv/config";
import UserClinicPermissions from "../src/models/user-clinic-permissions";
import User from "../src/models/user";
import db from "../src/db/index";

const VALID_ROLES = User.roles;
type ValidRole = User.RoleT;

// Default role when none exists or invalid
const DEFAULT_ROLE: ValidRole = "provider";

// Check if running in dry-run mode
const isDryRun = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";

const ROLE_PERMISSIONS = UserClinicPermissions.rolePermissions;

/**
 * Initialize database connection
 * Importing from db instead. If needed we can init our own db below.
 */
// function initializeDatabase(): Kysely<Database> {
//   const config = getDatabaseConfig();
//   return new Kysely<Database>({
//     dialect: new PostgresDialect({
//       pool: new Pool(config),
//     }),
//   });
// }

/**
 * Check if a role is valid
 */
function isValidRole(role: string | null | undefined): role is ValidRole {
  return (
    role !== null &&
    role !== undefined &&
    VALID_ROLES.includes(role as ValidRole)
  );
}

/**
 * Fix user roles that are missing or invalid
 */
async function fixUserRoles(db: Kysely<Database>): Promise<void> {
  console.log(`Starting role recovery${isDryRun ? " (DRY RUN)" : ""}...`);

  // Get all users (including deleted ones as they might need cleanup too)
  const users = await db
    .selectFrom("users")
    .select(["id", "name", "role", "email", "is_deleted"])
    .execute();

  let rolesFixed = 0;
  let rolesKept = 0;

  for (const user of users) {
    if (!isValidRole(user.role)) {
      // User has no role or invalid role - assign default role
      console.log(
        `User ${user.email} (${user.name}) has invalid role "${user.role}" - ${isDryRun ? "would assign" : "assigning"} "${DEFAULT_ROLE}"`,
      );

      if (!isDryRun) {
        await db
          .updateTable("users")
          .set({
            role: DEFAULT_ROLE,
            updated_at: sql`now()`,
          })
          .where("id", "=", user.id)
          .execute();
      }

      rolesFixed++;
    } else {
      // User has valid role - keep it
      rolesKept++;
    }
  }

  console.log(
    `Role recovery complete: ${rolesFixed} ${isDryRun ? "would be fixed" : "fixed"}, ${rolesKept} kept as-is`,
  );
}

/**
 * Create missing clinic permissions for users
 */
async function fixClinicPermissions(db: Kysely<Database>): Promise<void> {
  console.log(
    `Starting clinic permissions recovery${isDryRun ? " (DRY RUN)" : ""}...`,
  );

  // Get all users (including deleted ones)
  const users = await db
    .selectFrom("users")
    .select(["id", "name", "role", "email", "clinic_id"])
    .execute();

  // Get all clinics (including deleted ones)
  const clinics = await db
    .selectFrom("clinics")
    .select(["id", "name"])
    .execute();

  if (clinics.length === 0) {
    console.error("No clinics found in the system");
    console.error("Contact Hikma Health for support. Send this screenshot");
    return;
  }

  let permissionsCreated = 0;
  let permissionsKept = 0;

  // For each user, ensure they have permissions for all clinics
  for (const user of users) {
    const userRole = (
      isValidRole(user.role) ? user.role : DEFAULT_ROLE
    ) as ValidRole;
    const rolePermissions = ROLE_PERMISSIONS[userRole];

    // Get existing permissions for this user
    const existingPermissions = await db
      .selectFrom("user_clinic_permissions")
      .select("clinic_id")
      .where("user_id", "=", user.id)
      .execute();

    const existingClinicIds = new Set(
      existingPermissions.map((p) => p.clinic_id),
    );

    // Check each clinic
    for (const clinic of clinics) {
      if (!existingClinicIds.has(clinic.id)) {
        // Missing permission entry - create with role defaults
        console.log(
          `${isDryRun ? "Would create" : "Creating"} permissions for user ${user.email} (${userRole}) in clinic ${clinic.name || clinic.id}`,
        );

        if (isDryRun) {
          console.log(
            `Permissions: register=${rolePermissions.can_register_patients}, view=${rolePermissions.can_view_history}, edit=${rolePermissions.can_edit_records}, delete=${rolePermissions.can_delete_records}, admin=${rolePermissions.is_clinic_admin}`,
          );
        }

        if (!isDryRun) {
          try {
            await db
              .insertInto("user_clinic_permissions")
              .values({
                user_id: user.id,
                clinic_id: clinic.id,
                can_register_patients: rolePermissions.can_register_patients,
                can_view_history: rolePermissions.can_view_history,
                can_edit_records: rolePermissions.can_edit_records,
                can_delete_records: rolePermissions.can_delete_records,
                is_clinic_admin: rolePermissions.is_clinic_admin,
                created_by: null, // System generated
                last_modified_by: null, // System generated
                created_at: sql`now()`,
                updated_at: sql`now()`,
              })
              .execute();
          } catch (error) {
            // Handle potential race conditions or constraint violations
            console.error(
              `Failed to create permissions for user ${user.email} in clinic ${clinic.name}: ${error}`,
            );
          }
        }

        permissionsCreated++;
      } else {
        // Permission exists - keep it as is (even if mismatched with role)
        permissionsKept++;
      }
    }
  }

  console.log(
    `Clinic permissions recovery complete: ${permissionsCreated} ${isDryRun ? "would be created" : "created"}, ${permissionsKept} kept as-is`,
  );
}

/**
 * Main recovery function
 */
export async function runRecovery(): Promise<void> {
  console.log("Starting User Permissions Recovery Script");
  if (isDryRun) {
    console.log("Running in DRY RUN mode - no changes will be made");
  }
  console.log("=".repeat(50));

  try {
    // These are going to be run sequentially
    await fixUserRoles(db);
    console.log("\n");

    await fixClinicPermissions(db);
    console.log("\n");

    // THERE is no need to clean up orphaned permissions. Hikma Health is a no delete system. only soft-deletes are allowed.
    // Therefore, all permissions without valid users or clinics will be kept as is.

    console.log("=".repeat(50));
    console.log(
      `✅ User Permissions Recovery ${isDryRun ? "simulation" : ""} completed successfully!`,
    );
    if (isDryRun) {
      console.log("Run without DRY_RUN=true to apply changes");
    }
  } catch (error) {
    console.error("Error during recovery:", error);
    console.error(
      "Please contact Hikma Health tech team with this screenshot.",
    );
    throw error;
  } finally {
    await db.destroy();
  }
}

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRecovery()
    .then(() => {
      console.log("\nExiting...");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nFatal error:", error);
      process.exit(1);
    });
}
