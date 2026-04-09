//! Cloud sync — orchestrates bidirectional sync between the local SQLite hub
//! and the remote cloud server (Node.js + PostgreSQL).
//!
//! Flow:
//! 1. Read `last_pulled_at` watermark from the `peers` table (cloud row)
//! 2. Pull: GET  {cloud}/sync?lastPulledAt={watermark}
//! 3. Merge: apply cloud changes locally WITHOUT bumping `local_server_last_modified_at`
//! 4. Push: gather local changes where `local_server_last_modified_at > watermark`,
//!          POST {cloud}/sync?lastPulledAt={watermark}
//! 5. Update watermark on success

pub(crate) mod merge;
pub(crate) mod peer;
pub(crate) mod pull;
pub(crate) mod push;

use rusqlite::Connection;
use serde::Serialize;

use crate::SyncDatabaseChangeSet;

/// Every table that participates in cloud sync.
/// Excludes `peers` (hub-local) and `event_logs` (audit-only).
pub const SYNCABLE_TABLES: &[&str] = &[
    "patients",
    "users",
    "clinics",
    "events",
    "event_forms",
    "visits",
    "registration_forms",
    "patient_additional_attributes",
    "appointments",
    "prescriptions",
    "patient_vitals",
    "user_clinic_permissions",
    "app_config",
    "patient_problems",
    "clinic_departments",
    "drug_catalogue",
    "clinic_inventory",
    "prescription_items",
    "dispensing_records",
    "patient_allergies",
    "patient_allergy_reactions",
    "patient_observations",
    "patient_tobacco_history",
    "drug_batches",
    "resources",
];

/// Opaque error wrapper — carries a human-readable message for the frontend.
#[derive(Debug)]
pub struct CloudSyncError(pub String);

impl std::fmt::Display for CloudSyncError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for CloudSyncError {}

impl From<rusqlite::Error> for CloudSyncError {
    fn from(e: rusqlite::Error) -> Self {
        Self(format!("SQLite error: {e}"))
    }
}

impl From<reqwest::Error> for CloudSyncError {
    fn from(e: reqwest::Error) -> Self {
        Self(format!("HTTP error: {e}"))
    }
}

/// Returned to the frontend after a successful cloud sync round.
#[derive(Debug, Clone, Serialize)]
pub struct CloudSyncSummary {
    pub pulled_created: usize,
    pub pulled_updated: usize,
    pub pulled_deleted: usize,
    pub pushed_created: usize,
    pub pushed_updated: usize,
    pub pushed_deleted: usize,
    /// The new watermark written to `peers.last_pulled_at`.
    pub new_timestamp: i64,
}

// ---- Sync phases (separated so `Connection` never crosses an await) ------

/// Phase 1: read the watermark (sync, no HTTP).
pub fn phase_read_watermark(conn: &Connection) -> Result<i64, CloudSyncError> {
    peer::get_cloud_last_pulled_at(conn)
}

/// Returns true when this is the very first cloud sync: no watermark has been
/// set yet AND the local database has no patient records. When both conditions
/// hold, the push phase should be skipped to avoid echoing freshly-pulled cloud
/// data back to the server.
pub fn is_first_sync(conn: &Connection, last_pulled_at: i64) -> Result<bool, CloudSyncError> {
    if last_pulled_at != 0 {
        return Ok(false);
    }
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM patients", [], |row| row.get(0))
        .map_err(CloudSyncError::from)?;
    Ok(count == 0)
}

/// Phase 2: pull from cloud (async HTTP, no DB).
pub async fn phase_pull(
    cloud_url: &str,
    api_key: &str,
    last_pulled_at: i64,
) -> Result<(SyncDatabaseChangeSet, i64), CloudSyncError> {
    pull::pull_from_cloud(cloud_url, api_key, last_pulled_at).await
}

/// Phase 3 (standalone): merge cloud changes into local DB inside a
/// transaction. Used on first sync where no push follows.
pub fn phase_merge(
    conn: &Connection,
    cloud_changes: &SyncDatabaseChangeSet,
) -> Result<(usize, usize, usize), CloudSyncError> {
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| CloudSyncError(format!("Failed to begin merge transaction: {e}")))?;

    let result = merge::apply_cloud_changes(conn, cloud_changes);

    match &result {
        Ok(_) => {
            conn.execute_batch("COMMIT")
                .map_err(|e| CloudSyncError(format!("Failed to commit merge: {e}")))?;
        }
        Err(_) => {
            eprintln!("[cloud_merge] ERROR: transaction rolled back");
            let _ = conn.execute_batch("ROLLBACK");
        }
    }

    result
}

/// Phases 3+4a: merge cloud changes then gather local changes in a single
/// transaction. Holding `BEGIN IMMEDIATE` across both operations prevents
/// concurrent client writes from slipping between merge and gather, which
/// would cause records to appear in the push set with stale data or be
/// missed entirely.
///
/// Returns `(merge_counts, local_changes)`.
pub fn phase_merge_and_gather(
    conn: &Connection,
    cloud_changes: &SyncDatabaseChangeSet,
    last_pulled_at: i64,
) -> Result<((usize, usize, usize), SyncDatabaseChangeSet), CloudSyncError> {
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| CloudSyncError(format!("Failed to begin merge transaction: {e}")))?;

    let merge_result = merge::apply_cloud_changes(conn, cloud_changes);

    match merge_result {
        Ok(counts) => {
            let gather_result = push::gather_local_changes(conn, last_pulled_at);
            match gather_result {
                Ok(local_changes) => {
                    conn.execute_batch("COMMIT")
                        .map_err(|e| CloudSyncError(format!("Failed to commit: {e}")))?;
                    Ok((counts, local_changes))
                }
                Err(e) => {
                    eprintln!("[cloud_sync] ERROR: gather failed, rolling back merge");
                    let _ = conn.execute_batch("ROLLBACK");
                    Err(e)
                }
            }
        }
        Err(e) => {
            eprintln!("[cloud_sync] ERROR: merge failed, rolling back");
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

/// Phase 4b: push local changes to cloud (async HTTP, no DB).
pub async fn phase_push(
    cloud_url: &str,
    api_key: &str,
    last_pulled_at: i64,
    local_changes: &SyncDatabaseChangeSet,
) -> Result<(), CloudSyncError> {
    push::push_to_cloud(cloud_url, api_key, last_pulled_at, local_changes).await
}

/// Phase 5: update watermark after successful push (sync, no HTTP).
pub fn phase_update_watermark(conn: &Connection, timestamp: i64) -> Result<(), CloudSyncError> {
    peer::update_last_pulled_at(conn, timestamp)
}

/// Sums (created, updated, deleted) counts across all tables in a changeset.
pub fn count_changes(changes: &SyncDatabaseChangeSet) -> (usize, usize, usize) {
    let mut c = 0usize;
    let mut u = 0usize;
    let mut d = 0usize;
    for name in changes.table_names() {
        if let Some(cs) = changes.get_table_changes(name) {
            c += cs.created.len();
            u += cs.updated.len();
            d += cs.deleted.len();
        }
    }
    (c, u, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn syncable_tables_excludes_peers_and_event_logs() {
        assert!(!SYNCABLE_TABLES.contains(&"peers"));
        assert!(!SYNCABLE_TABLES.contains(&"event_logs"));
    }

    #[test]
    fn syncable_tables_includes_key_tables() {
        assert!(SYNCABLE_TABLES.contains(&"patients"));
        assert!(SYNCABLE_TABLES.contains(&"users"));
        assert!(SYNCABLE_TABLES.contains(&"clinics"));
        assert!(SYNCABLE_TABLES.contains(&"events"));
        assert!(SYNCABLE_TABLES.contains(&"visits"));
    }
}
