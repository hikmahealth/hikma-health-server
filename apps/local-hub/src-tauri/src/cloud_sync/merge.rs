//! Applies cloud-pulled changes into the local SQLite database.
//!
//! **Critical invariant**: none of these operations touch `local_server_last_modified_at`.
//! On INSERT we set it to the record's `updated_at` (not `now()`).
//! On UPDATE (conflict) we leave it untouched.
//! On soft-delete we only set `local_server_deleted_at`.
//!
//! This prevents cloud-pulled records from appearing in the push set.

use std::collections::HashSet;

use rusqlite::{params_from_iter, Connection};
use serde_json::Value;

use super::{CloudSyncError, SYNCABLE_TABLES};
use crate::{sync_utils, RawRecord, SyncDatabaseChangeSet};

/// Applies all changes from the cloud into the local database.
///
/// Returns `(created_count, updated_count, deleted_count)`.
pub fn apply_cloud_changes(
    conn: &Connection,
    changes: &SyncDatabaseChangeSet,
) -> Result<(usize, usize, usize), CloudSyncError> {
    let mut total_created = 0usize;
    let mut total_updated = 0usize;
    let mut total_deleted = 0usize;

    for table_name in SYNCABLE_TABLES {
        let changeset = match changes.get_table_changes(table_name) {
            Some(cs) => cs,
            None => continue,
        };

        let valid_columns =
            sync_utils::get_all_columns(conn, table_name).map_err(CloudSyncError)?;
        if valid_columns.is_empty() {
            // Table doesn't exist locally — skip
            continue;
        }

        for record in &changeset.created {
            upsert_cloud_record(conn, table_name, record, &valid_columns)?;
            total_created += 1;
        }

        for record in &changeset.updated {
            upsert_cloud_record(conn, table_name, record, &valid_columns)?;
            total_updated += 1;
        }

        for id in &changeset.deleted {
            soft_delete_cloud_record(conn, table_name, id)?;
            total_deleted += 1;
        }

        let (c, u, d) = (
            changeset.created.len(),
            changeset.updated.len(),
            changeset.deleted.len(),
        );
        if c + u + d > 0 {
            println!("[cloud_merge]   {table_name} -> {c} created, {u} updated, {d} deleted");
        }
    }

    println!("[cloud_merge] totals -> created={total_created}, updated={total_updated}, deleted={total_deleted}");

    Ok((total_created, total_updated, total_deleted))
}

/// Builds a dynamic `INSERT ... ON CONFLICT` that:
/// - Inserts the record with `local_server_created_at = updated_at` and
///   `local_server_last_modified_at = updated_at` (record's own timestamp, not now()).
/// - On conflict, updates all data columns **except** `local_server_last_modified_at`
///   and `local_server_created_at`.
fn upsert_cloud_record(
    conn: &Connection,
    table: &str,
    record: &RawRecord,
    valid_columns: &HashSet<String>,
) -> Result<(), CloudSyncError> {
    // Columns we never let the cloud overwrite on UPDATE
    const PROTECTED_ON_UPDATE: &[&str] = &[
        "local_server_created_at",
        "local_server_last_modified_at",
        "local_server_deleted_at",
    ];

    // Build the column→value map from the record's flat fields.
    // The RawRecord has `id`, `created_at`, `updated_at` as top-level fields
    // plus everything in `data` (which via serde(flatten) also contains id/created_at/updated_at).
    let mut col_vals: Vec<(String, Value)> = Vec::new();

    // Always include the core fields
    col_vals.push(("id".to_string(), Value::String(record.id.clone())));
    col_vals.push((
        "created_at".to_string(),
        Value::Number(record.created_at.into()),
    ));
    col_vals.push((
        "updated_at".to_string(),
        Value::Number(record.updated_at.into()),
    ));

    // Add everything from `data`, skipping duplicates of the above
    for (key, val) in &record.data {
        if key == "id" || key == "created_at" || key == "updated_at" {
            continue;
        }
        col_vals.push((key.clone(), val.clone()));
    }

    // Filter to only columns that exist in the table
    let col_vals: Vec<(String, Value)> = col_vals
        .into_iter()
        .filter(|(k, _)| valid_columns.contains(k))
        .collect();

    if col_vals.is_empty() {
        return Ok(()); // nothing to insert
    }

    // Add server tracking columns for INSERT
    let mut columns: Vec<String> = col_vals.iter().map(|(k, _)| k.clone()).collect();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = col_vals
        .iter()
        .map(|(_, v)| sync_utils::json_value_to_sql(v))
        .collect();

    // local_server_created_at = record.updated_at (not now())
    if valid_columns.contains("local_server_created_at")
        && !columns.contains(&"local_server_created_at".to_string())
    {
        columns.push("local_server_created_at".to_string());
        values.push(Box::new(record.updated_at));
    }

    // local_server_last_modified_at = record.updated_at (not now())
    if valid_columns.contains("local_server_last_modified_at")
        && !columns.contains(&"local_server_last_modified_at".to_string())
    {
        columns.push("local_server_last_modified_at".to_string());
        values.push(Box::new(record.updated_at));
    }

    // Build placeholders
    let placeholders: Vec<String> = (1..=columns.len()).map(|i| format!("?{i}")).collect();

    // Build ON CONFLICT SET clause — skip protected columns
    let update_clauses: Vec<String> = columns
        .iter()
        .filter(|c| c.as_str() != "id" && !PROTECTED_ON_UPDATE.contains(&c.as_str()))
        .map(|c| format!("\"{c}\" = excluded.\"{c}\""))
        .collect();

    let sql = if update_clauses.is_empty() {
        format!(
            "INSERT OR IGNORE INTO \"{}\" ({}) VALUES ({})",
            table,
            columns
                .iter()
                .map(|c| format!("\"{c}\""))
                .collect::<Vec<_>>()
                .join(", "),
            placeholders.join(", "),
        )
    } else {
        format!(
            "INSERT INTO \"{}\" ({}) VALUES ({}) ON CONFLICT(id) DO UPDATE SET {}",
            table,
            columns
                .iter()
                .map(|c| format!("\"{c}\""))
                .collect::<Vec<_>>()
                .join(", "),
            placeholders.join(", "),
            update_clauses.join(", "),
        )
    };

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|b| b.as_ref()).collect();

    conn.execute(&sql, params_from_iter(param_refs))
        .map_err(|e| {
            eprintln!(
                "[cloud_merge] ERROR: upsert failed for {table} id={}: {e}",
                record.id
            );
            CloudSyncError(format!("Upsert failed for {table} id={}: {e}", record.id))
        })?;

    Ok(())
}

/// Marks a record as soft-deleted without touching `local_server_last_modified_at`.
fn soft_delete_cloud_record(
    conn: &Connection,
    table: &str,
    id: &str,
) -> Result<(), CloudSyncError> {
    let now = crate::timestamp();
    let sql = format!(
        "UPDATE \"{}\" SET local_server_deleted_at = ?1 WHERE id = ?2 AND local_server_deleted_at IS NULL",
        table
    );
    conn.execute(&sql, rusqlite::params![now, id])
        .map_err(|e| {
            eprintln!("[cloud_merge] ERROR: soft-delete failed for {table} id={id}: {e}");
            CloudSyncError(format!("Soft-delete failed for {table} id={id}: {e}"))
        })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cloud_sync::push;
    use crate::{test_utils::setup_test_db, SyncTableChangeSet};
    use proptest::prelude::*;
    use std::collections::HashMap;

    fn make_record(id: &str, created: i64, updated: i64, extra: Vec<(&str, Value)>) -> RawRecord {
        let mut data = HashMap::new();
        for (k, v) in extra {
            data.insert(k.to_string(), v);
        }
        RawRecord {
            id: id.to_string(),
            created_at: created,
            updated_at: updated,
            data,
        }
    }

    /// Helper: read `local_server_last_modified_at` for a given table/id.
    fn read_lslm(conn: &Connection, table: &str, id: &str) -> i64 {
        conn.query_row(
            &format!(
                "SELECT local_server_last_modified_at FROM \"{}\" WHERE id = ?1",
                table
            ),
            [id],
            |row| row.get(0),
        )
        .unwrap()
    }

    fn read_lsca(conn: &Connection, table: &str, id: &str) -> i64 {
        conn.query_row(
            &format!(
                "SELECT local_server_created_at FROM \"{}\" WHERE id = ?1",
                table
            ),
            [id],
            |row| row.get(0),
        )
        .unwrap()
    }

    #[test]
    fn merge_insert_uses_record_timestamp_not_now() {
        let conn = setup_test_db();
        let record = make_record(
            "clinic-1",
            1000,
            2000,
            vec![
                ("name", Value::String("Test Clinic".into())),
                ("is_deleted", Value::Number(0.into())),
                ("is_archived", Value::Number(0.into())),
            ],
        );

        let mut changes = SyncDatabaseChangeSet::new();
        let mut cs = SyncTableChangeSet::new();
        cs.created.push(record);
        changes.add_table_changes("clinics", cs);

        let (c, u, d) = apply_cloud_changes(&conn, &changes).unwrap();
        assert_eq!((c, u, d), (1, 0, 0));

        // local_server_last_modified_at should be the record's updated_at (2000), not now()
        let lslm = read_lslm(&conn, "clinics", "clinic-1");
        assert_eq!(lslm, 2000);

        let lsca = read_lsca(&conn, "clinics", "clinic-1");
        assert_eq!(lsca, 2000);
    }

    #[test]
    fn merge_does_not_bump_last_modified_on_update() {
        let conn = setup_test_db();

        // First, insert a record directly with a known local_server_last_modified_at
        conn.execute(
            r#"INSERT INTO clinics (id, name, created_at, updated_at, is_deleted, is_archived,
                local_server_created_at, local_server_last_modified_at)
               VALUES ('clinic-1', 'Original', 1000, 1000, 0, 0, 500, 500)"#,
            [],
        )
        .unwrap();

        assert_eq!(read_lslm(&conn, "clinics", "clinic-1"), 500);

        // Now merge a cloud update for the same record
        let record = make_record(
            "clinic-1",
            1000,
            3000,
            vec![
                ("name", Value::String("Updated from Cloud".into())),
                ("is_deleted", Value::Number(0.into())),
                ("is_archived", Value::Number(0.into())),
            ],
        );

        let mut changes = SyncDatabaseChangeSet::new();
        let mut cs = SyncTableChangeSet::new();
        cs.updated.push(record);
        changes.add_table_changes("clinics", cs);

        apply_cloud_changes(&conn, &changes).unwrap();

        // local_server_last_modified_at must still be 500 (untouched by merge)
        assert_eq!(read_lslm(&conn, "clinics", "clinic-1"), 500);

        // But the name should be updated
        let name: String = conn
            .query_row(
                "SELECT name FROM clinics WHERE id = 'clinic-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(name, "Updated from Cloud");
    }

    #[test]
    fn soft_delete_does_not_bump_last_modified() {
        let conn = setup_test_db();

        conn.execute(
            r#"INSERT INTO clinics (id, name, created_at, updated_at, is_deleted, is_archived,
                local_server_created_at, local_server_last_modified_at)
               VALUES ('clinic-del', 'To Delete', 1000, 1000, 0, 0, 500, 500)"#,
            [],
        )
        .unwrap();

        let mut changes = SyncDatabaseChangeSet::new();
        let mut cs = SyncTableChangeSet::new();
        cs.deleted.push("clinic-del".to_string());
        changes.add_table_changes("clinics", cs);

        apply_cloud_changes(&conn, &changes).unwrap();

        // local_server_last_modified_at must still be 500
        assert_eq!(read_lslm(&conn, "clinics", "clinic-del"), 500);

        // But local_server_deleted_at should be set
        let deleted_at: Option<i64> = conn
            .query_row(
                "SELECT local_server_deleted_at FROM clinics WHERE id = 'clinic-del'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(deleted_at.is_some());
    }

    #[test]
    fn unknown_columns_from_cloud_are_skipped() {
        let conn = setup_test_db();
        let record = make_record(
            "clinic-unk",
            1000,
            2000,
            vec![
                ("name", Value::String("Test".into())),
                ("is_deleted", Value::Number(0.into())),
                ("is_archived", Value::Number(0.into())),
                // This column doesn't exist in the clinics table
                (
                    "nonexistent_column",
                    Value::String("should be ignored".into()),
                ),
            ],
        );

        let mut changes = SyncDatabaseChangeSet::new();
        let mut cs = SyncTableChangeSet::new();
        cs.created.push(record);
        changes.add_table_changes("clinics", cs);

        // Should succeed without error
        let result = apply_cloud_changes(&conn, &changes);
        assert!(result.is_ok());
    }

    // Property test: cloud-pulled records must NEVER appear in the push set.
    // Merge sets local_server_last_modified_at = record.updated_at (always <= watermark),
    // so gathered local changes should always be empty after applying cloud records.
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(20))]
        #[test]
        fn cloud_pulled_records_not_in_push_set(
            count in 1usize..=10,
            watermark in 5000i64..10000,
        ) {
            let conn = setup_test_db();

            // Build cloud changeset: all records have updated_at <= watermark
            let mut cloud_changes = SyncDatabaseChangeSet::new();
            let mut cs = SyncTableChangeSet::new();

            for i in 0..count {
                let record = make_record(
                    &format!("cloud-clinic-{i}"),
                    1000,
                    // updated_at is always before or at the watermark
                    watermark - (i as i64) - 1,
                    vec![
                        ("name", Value::String(format!("Cloud Clinic {i}"))),
                        ("is_deleted", Value::Number(0.into())),
                        ("is_archived", Value::Number(0.into())),
                    ],
                );
                cs.created.push(record);
            }
            cloud_changes.add_table_changes("clinics", cs);

            // Apply cloud changes
            apply_cloud_changes(&conn, &cloud_changes).unwrap();

            // Gather local changes using the same watermark
            let local_changes = push::gather_local_changes(&conn, watermark).unwrap();

            // The push set must be empty — cloud records must not leak
            prop_assert!(
                local_changes.is_empty(),
                "Cloud-pulled records leaked into push set! \
                 watermark={watermark}, count={count}, changes={local_changes:?}"
            );
        }
    }
}
