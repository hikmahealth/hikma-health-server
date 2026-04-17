//! Reads and writes the cloud-peer sync watermark from the `peers` table.
//!
//! The cloud server is stored as a row with `peer_type = 'cloud_server'`.
//! `last_pulled_at` tracks the most recent successful sync timestamp.

use rusqlite::Connection;

use super::CloudSyncError;

/// Returns the `last_pulled_at` value for the cloud peer, or `0` if no cloud
/// peer row exists (first sync).
pub fn get_cloud_last_pulled_at(conn: &Connection) -> Result<i64, CloudSyncError> {
    let result = conn.query_row(
        "SELECT COALESCE(last_synced_at, 0) FROM peers WHERE peer_type = 'cloud_server' LIMIT 1",
        [],
        |row| row.get::<_, i64>(0),
    );

    match result {
        Ok(ts) => Ok(ts),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(0),
        Err(e) => Err(CloudSyncError(format!(
            "Failed to read cloud peer watermark: {e}"
        ))),
    }
}

/// Writes `timestamp` into the cloud peer's `last_synced_at` column.
///
/// If no `cloud_server` peer row exists yet (e.g. `upsert_cloud_peer` failed
/// silently during registration), inserts a minimal row so the watermark is
/// persisted regardless.
pub fn update_last_pulled_at(conn: &Connection, timestamp: i64) -> Result<(), CloudSyncError> {
    let rows_affected = conn
        .execute(
            "UPDATE peers SET last_synced_at = ?1 WHERE peer_type = 'cloud_server'",
            [timestamp],
        )
        .map_err(|e| CloudSyncError(format!("Failed to update cloud peer watermark: {e}")))?;

    if rows_affected == 0 {
        conn.execute(
            r#"INSERT INTO peers (id, peer_id, name, public_key, peer_type, status,
                protocol_version, last_synced_at, created_at, updated_at,
                local_server_created_at, local_server_last_modified_at)
               VALUES ('cloud_server', 'cloud_server', 'Cloud Server', '', 'cloud_server',
                       'registered', '1', ?1, ?1, ?1, ?1, ?1)"#,
            [timestamp],
        )
        .map_err(|e| CloudSyncError(format!("Failed to insert cloud peer watermark: {e}")))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    #[test]
    fn returns_zero_when_no_peer() {
        let conn = setup_test_db();
        let ts = get_cloud_last_pulled_at(&conn).unwrap();
        assert_eq!(ts, 0);
    }

    #[test]
    fn get_update_roundtrip() {
        let conn = setup_test_db();

        // Insert a cloud peer row
        conn.execute(
            r#"INSERT INTO peers (id, peer_id, name, public_key, peer_type, status,
                protocol_version, last_synced_at, created_at, updated_at,
                local_server_created_at, local_server_last_modified_at)
               VALUES ('cloud-1', 'cloud-1', 'Cloud', '', 'cloud_server', 'registered',
                       '1', 0, 1000, 1000, 1000, 1000)"#,
            [],
        )
        .unwrap();

        assert_eq!(get_cloud_last_pulled_at(&conn).unwrap(), 0);

        update_last_pulled_at(&conn, 42_000).unwrap();
        assert_eq!(get_cloud_last_pulled_at(&conn).unwrap(), 42_000);

        // Updating again overwrites
        update_last_pulled_at(&conn, 99_000).unwrap();
        assert_eq!(get_cloud_last_pulled_at(&conn).unwrap(), 99_000);
    }

    #[test]
    fn update_is_noop_when_no_peer() {
        let conn = setup_test_db();
        // Should not error even with no cloud peer row
        get_cloud_last_pulled_at(&conn).unwrap();
        assert_eq!(get_cloud_last_pulled_at(&conn).unwrap(), 0);
    }
}
