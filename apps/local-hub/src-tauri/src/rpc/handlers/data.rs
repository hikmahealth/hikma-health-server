// Data management handlers.
//
// Destructive operations on the local database — clear all data, etc.
// Passphrase verification is handled by the caller (Tauri command layer),
// not here. These are pure database operations.

use rusqlite::Connection;

use super::HandlerResult;

/// Tables that hold domain data synced from clients.
/// Ordered so that child/FK-dependent tables come before parents,
/// avoiding foreign key constraint violations when PRAGMA foreign_keys is ON.
const DATA_TABLES: &[&str] = &[
    // leaf / child tables first
    "patient_allergy_reactions",
    "patient_allergies",
    "patient_observations",
    "patient_tobacco_history",
    "patient_vitals",
    "patient_problems",
    "patient_additional_attributes",
    "dispensing_records",
    "prescription_items",
    "prescriptions",
    "inventory_transactions",
    "drug_batches",
    "clinic_inventory",
    "drug_catalogue",
    "events",
    "visits",
    "appointments",
    "event_forms",
    "registration_forms",
    "event_logs",
    "resources",
    "clinic_departments",
    "peers",
    // parent / root tables last
    "user_clinic_permissions",
    "patients",
    "users",
    "clinics",
    "app_config",
];

/// Deletes all rows from every domain data table.
///
/// Preserves schema and migration history.
/// Disables foreign keys for the duration, then clears inside a transaction
/// so the wipe is atomic — all tables clear or none do.
pub fn clear_all_tables(conn: &Connection) -> HandlerResult {
    conn.execute_batch("PRAGMA foreign_keys = OFF;")?;

    let result = (|| -> HandlerResult {
        let tx = conn.unchecked_transaction()?;
        let mut tables_cleared: i64 = 0;
        let mut rows_deleted: i64 = 0;

        for table in DATA_TABLES {
            let sql = format!("DELETE FROM {}", table);
            let affected = tx.execute(&sql, [])?;
            rows_deleted += affected as i64;
            tables_cleared += 1;
        }

        tx.commit()?;

        Ok(serde_json::json!({
            "cleared": true,
            "tables_cleared": tables_cleared,
            "rows_deleted": rows_deleted,
        }))
    })();

    // Re-enable foreign keys regardless of success/failure
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    fn seed_data(conn: &Connection) {
        let now = 1000i64;
        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted, is_archived, attributes, metadata,
                                  created_at, updated_at,
                                  local_server_created_at, local_server_last_modified_at)
             VALUES ('c1', 'Clinic', 0, 0, '[]', '{}', ?1, ?1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO users (id, clinic_id, name, role, email, hashed_password,
                                created_at, updated_at, is_deleted,
                                local_server_created_at, local_server_last_modified_at)
             VALUES ('u1', 'c1', 'Test', 'admin', 'a@b.com', 'hash', ?1, ?1, 0, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO patients (id, given_name, surname, date_of_birth, citizenship, hometown,
                                   phone, sex, additional_data, metadata, is_deleted,
                                   government_id, external_patient_id,
                                   created_at, updated_at,
                                   local_server_created_at, local_server_last_modified_at)
             VALUES ('p1', 'A', 'B', '1990-01-01', 'X', 'Y', '555', 'M', '{}', '{}', 0,
                     'G1', 'E1', ?1, ?1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();
    }

    fn count_rows(conn: &Connection, table: &str) -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn clear_all_tables_empties_data() {
        let conn = setup_test_db();
        seed_data(&conn);

        assert!(count_rows(&conn, "clinics") > 0);
        assert!(count_rows(&conn, "users") > 0);
        assert!(count_rows(&conn, "patients") > 0);

        let result = clear_all_tables(&conn).unwrap();

        assert_eq!(result["cleared"], true);
        assert!(result["rows_deleted"].as_i64().unwrap() >= 3);

        for table in DATA_TABLES {
            assert_eq!(count_rows(&conn, table), 0, "{} should be empty", table);
        }
    }

    #[test]
    fn clear_all_tables_on_empty_db() {
        let conn = setup_test_db();
        let result = clear_all_tables(&conn).unwrap();

        assert_eq!(result["cleared"], true);
        assert_eq!(result["rows_deleted"], 0);
        assert_eq!(
            result["tables_cleared"].as_i64().unwrap(),
            DATA_TABLES.len() as i64
        );
    }

    #[test]
    fn clear_all_tables_is_idempotent() {
        let conn = setup_test_db();
        seed_data(&conn);

        clear_all_tables(&conn).unwrap();
        let result = clear_all_tables(&conn).unwrap();

        assert_eq!(result["cleared"], true);
        assert_eq!(result["rows_deleted"], 0);
    }

    #[test]
    fn foreign_keys_restored_after_clear() {
        let conn = setup_test_db();
        seed_data(&conn);
        clear_all_tables(&conn).unwrap();

        // FK enforcement should be back on
        let fk_status: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
            .unwrap();
        assert_eq!(fk_status, 1, "foreign_keys should be re-enabled");
    }
}
