//! Gathers local changes since the watermark and pushes them to the cloud.
//!
//! Uses `PRAGMA table_info` for dynamic column discovery so we send structured
//! records (not blobs) to the cloud.

use rusqlite::Connection;

use super::{CloudSyncError, SYNCABLE_TABLES};
use crate::{sync_utils, SyncDatabaseChangeSet, SyncTableChangeSet};

/// Queries every syncable table for records modified after `last_pulled_at`.
///
/// - **created**: `local_server_created_at > last_pulled_at` AND not deleted
/// - **updated**: `local_server_last_modified_at > last_pulled_at`
///                AND `local_server_created_at <= last_pulled_at` AND not deleted
/// - **deleted**: `local_server_deleted_at > last_pulled_at`
pub fn gather_local_changes(
    conn: &Connection,
    last_pulled_at: i64,
) -> Result<SyncDatabaseChangeSet, CloudSyncError> {
    println!(
        "[cloud_gather] scanning {} tables since watermark={last_pulled_at}",
        SYNCABLE_TABLES.len()
    );

    let mut changeset = SyncDatabaseChangeSet::new();

    for &table in SYNCABLE_TABLES {
        let columns = sync_utils::get_data_columns(conn, table).map_err(CloudSyncError)?;
        if columns.is_empty() {
            continue;
        }

        let table_changes = gather_table_changes(conn, table, &columns, last_pulled_at)?;
        let (c, u, d) = (
            table_changes.created.len(),
            table_changes.updated.len(),
            table_changes.deleted.len(),
        );
        if c + u + d > 0 {
            println!("[cloud_gather]   {table} -> {c} created, {u} updated, {d} deleted");
        }
        changeset.add_table_changes(table, table_changes);
    }

    Ok(changeset)
}

/// Gathers created/updated/deleted records from a single table.
fn gather_table_changes(
    conn: &Connection,
    table: &str,
    columns: &[String],
    last_pulled_at: i64,
) -> Result<SyncTableChangeSet, CloudSyncError> {
    let col_list = columns
        .iter()
        .map(|c| format!("\"{c}\""))
        .collect::<Vec<_>>()
        .join(", ");

    let mut cs = SyncTableChangeSet::new();

    // Created records
    let sql_created = format!(
        "SELECT {} FROM \"{}\" WHERE local_server_created_at > ?1 AND local_server_deleted_at IS NULL",
        col_list, table
    );
    cs.created = sync_utils::query_records(conn, &sql_created, last_pulled_at, columns)
        .map_err(CloudSyncError)?;

    // Updated records (modified after watermark but created before)
    let sql_updated = format!(
        "SELECT {} FROM \"{}\" WHERE local_server_last_modified_at > ?1 \
         AND local_server_created_at <= ?1 AND local_server_deleted_at IS NULL",
        col_list, table
    );
    cs.updated = sync_utils::query_records(conn, &sql_updated, last_pulled_at, columns)
        .map_err(CloudSyncError)?;

    // Deleted record IDs
    let sql_deleted = format!(
        "SELECT id FROM \"{}\" WHERE local_server_deleted_at > ?1",
        table
    );
    let mut stmt = conn
        .prepare(&sql_deleted)
        .map_err(|e| CloudSyncError(format!("Failed to prepare delete query for {table}: {e}")))?;
    cs.deleted = stmt
        .query_map([last_pulled_at], |row| row.get::<_, String>(0))
        .map_err(|e| CloudSyncError(format!("Failed to query deletes for {table}: {e}")))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(cs)
}

/// Pushes local changes to the cloud via HTTP POST.
/// No-op if the changeset is empty.
pub async fn push_to_cloud(
    cloud_url: &str,
    api_key: &str,
    last_pulled_at: i64,
    changes: &SyncDatabaseChangeSet,
) -> Result<(), CloudSyncError> {
    if changes.is_empty() {
        println!("[cloud_push] nothing to push, skipping");
        return Ok(());
    }

    let url = format!(
        "{}/api/v2/sync?lastPulledAt={}&peerType=sync_hub",
        cloud_url, last_pulled_at
    );
    println!("[cloud_push] POST {url}");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()?;

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(changes)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        eprintln!("[cloud_push] ERROR: HTTP {status} — {body}");
        return Err(CloudSyncError(format!(
            "Cloud push failed (HTTP {status}): {body}"
        )));
    }

    println!("[cloud_push] completed successfully");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    #[test]
    fn locally_modified_records_included_in_push() {
        let conn = setup_test_db();

        // Insert a record with local_server_last_modified_at > watermark
        conn.execute(
            r#"INSERT INTO clinics (id, name, created_at, updated_at, is_deleted, is_archived,
                local_server_created_at, local_server_last_modified_at)
               VALUES ('c1', 'Clinic 1', 1000, 2000, 0, 0, 3000, 5000)"#,
            [],
        )
        .unwrap();

        let changes = gather_local_changes(&conn, 2000).unwrap();
        let clinics = changes.get_table_changes("clinics").unwrap();

        // Should appear in created (local_server_created_at=3000 > watermark=2000)
        assert_eq!(clinics.created.len(), 1);
        assert_eq!(clinics.created[0].id, "c1");
    }

    #[test]
    fn updated_records_partitioned_correctly() {
        let conn = setup_test_db();

        // Created before watermark, modified after
        conn.execute(
            r#"INSERT INTO clinics (id, name, created_at, updated_at, is_deleted, is_archived,
                local_server_created_at, local_server_last_modified_at)
               VALUES ('c2', 'Clinic 2', 1000, 2000, 0, 0, 1000, 5000)"#,
            [],
        )
        .unwrap();

        let changes = gather_local_changes(&conn, 2000).unwrap();
        let clinics = changes.get_table_changes("clinics").unwrap();

        // Should appear in updated (created_at <= watermark, modified > watermark)
        assert_eq!(clinics.created.len(), 0);
        assert_eq!(clinics.updated.len(), 1);
        assert_eq!(clinics.updated[0].id, "c2");
    }

    #[test]
    fn deleted_records_appear_in_push_deleted() {
        let conn = setup_test_db();

        conn.execute(
            r#"INSERT INTO clinics (id, name, created_at, updated_at, is_deleted, is_archived,
                local_server_created_at, local_server_last_modified_at, local_server_deleted_at)
               VALUES ('c3', 'Deleted Clinic', 1000, 2000, 0, 0, 1000, 1000, 5000)"#,
            [],
        )
        .unwrap();

        let changes = gather_local_changes(&conn, 2000).unwrap();
        let clinics = changes.get_table_changes("clinics").unwrap();

        assert!(clinics.deleted.contains(&"c3".to_string()));
    }

    #[test]
    fn gather_returns_empty_when_nothing_changed() {
        let conn = setup_test_db();

        // Insert record that's older than watermark
        conn.execute(
            r#"INSERT INTO clinics (id, name, created_at, updated_at, is_deleted, is_archived,
                local_server_created_at, local_server_last_modified_at)
               VALUES ('c-old', 'Old Clinic', 1000, 1000, 0, 0, 1000, 1000)"#,
            [],
        )
        .unwrap();

        let changes = gather_local_changes(&conn, 5000).unwrap();
        assert!(changes.is_empty());
    }
}
