//! Fetches changes from the cloud via HTTP GET.

use std::collections::HashMap;

use serde_json::Value;

use super::CloudSyncError;
use crate::{RawRecord, SyncDatabaseChangeSet, SyncTableChangeSet};

/// Response shape from the cloud's `GET /sync` endpoint.
#[derive(serde::Deserialize)]
struct CloudSyncResponse {
    changes: HashMap<String, CloudTableChangeSet>,
    timestamp: i64,
}

/// Cloud-side table changeset — mirrors `SyncTableChangeSet` but accepts
/// records whose `created_at` / `updated_at` may be ISO 8601 strings
/// (PostgreSQL timestamptz) rather than integer epoch-ms.
#[derive(serde::Deserialize)]
struct CloudTableChangeSet {
    #[serde(default)]
    created: Vec<HashMap<String, Value>>,
    #[serde(default)]
    updated: Vec<HashMap<String, Value>>,
    #[serde(default)]
    deleted: Vec<String>,
}

/// Pulls changes from the cloud since `last_pulled_at`.
///
/// Returns `(changes, cloud_timestamp)`. The caller uses `cloud_timestamp` as
/// the new watermark after a successful push.
pub async fn pull_from_cloud(
    cloud_url: &str,
    api_key: &str,
    last_pulled_at: i64,
) -> Result<(SyncDatabaseChangeSet, i64), CloudSyncError> {
    let url = format!(
        "{}/api/v2/sync?lastPulledAt={}&peerType=sync_hub",
        cloud_url, last_pulled_at
    );

    println!("[cloud_pull] GET {url}");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()?;

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        eprintln!("[cloud_pull] ERROR: HTTP {status} — {body}");
        return Err(CloudSyncError(format!(
            "Cloud pull failed (HTTP {status}): {body}"
        )));
    }

    let body: CloudSyncResponse = resp.json().await.map_err(|e| {
        eprintln!("[cloud_pull] ERROR: failed to parse response: {e}");
        CloudSyncError(format!("Failed to parse cloud sync response: {e}"))
    })?;

    let changes = convert_cloud_changes(body.changes)?;

    println!(
        "[cloud_pull] received changes for {} tables",
        changes.table_names().len()
    );
    for name in changes.table_names() {
        if let Some(cs) = changes.get_table_changes(name) {
            let (c, u, d) = (cs.created.len(), cs.updated.len(), cs.deleted.len());
            if c + u + d > 0 {
                println!("[cloud_pull]   {name} -> {c} created, {u} updated, {d} deleted");
            }
        }
    }

    Ok((changes, body.timestamp))
}

/// Converts the loosely-typed cloud response into the strictly-typed
/// `SyncDatabaseChangeSet` used internally.
fn convert_cloud_changes(
    cloud: HashMap<String, CloudTableChangeSet>,
) -> Result<SyncDatabaseChangeSet, CloudSyncError> {
    let mut result = SyncDatabaseChangeSet::new();

    for (table, cs) in cloud {
        let created = cs
            .created
            .into_iter()
            .map(cloud_row_to_raw_record)
            .collect::<Result<Vec<_>, _>>()?;
        let updated = cs
            .updated
            .into_iter()
            .map(cloud_row_to_raw_record)
            .collect::<Result<Vec<_>, _>>()?;

        let table_cs = SyncTableChangeSet {
            created,
            updated,
            deleted: cs.deleted,
        };

        result.add_table_changes(&table, table_cs);
    }

    Ok(result)
}

/// Converts a single cloud record (arbitrary JSON object) into a `RawRecord`.
///
/// `created_at` and `updated_at` are normalised to epoch-ms integers.
/// Accepts: integer, float, or ISO 8601 string.
fn cloud_row_to_raw_record(mut row: HashMap<String, Value>) -> Result<RawRecord, CloudSyncError> {
    let id = match row.remove("id") {
        Some(Value::String(s)) => s,
        Some(v) => v.to_string().trim_matches('"').to_string(),
        None => return Err(CloudSyncError("Cloud record missing 'id' field".into())),
    };

    let created_at = parse_timestamp(row.remove("created_at"))
        .map_err(|e| CloudSyncError(format!("Bad created_at on record {id}: {e}")))?;

    let updated_at = parse_timestamp(row.remove("updated_at"))
        .map_err(|e| CloudSyncError(format!("Bad updated_at on record {id}: {e}")))?;

    // Cloud may send null for recorded_by_user_id, but local schema requires NOT NULL
    if matches!(row.get("recorded_by_user_id"), Some(Value::Null) | None) {
        row.insert("recorded_by_user_id".into(), Value::String(String::new()));
    }

    // Cloud may send check_in_timestamp as an ISO string or null; local schema requires INTEGER NOT NULL.
    // Falls back to created_at (or 0 if that's also missing).
    if matches!(row.get("check_in_timestamp"), Some(Value::Null) | None) {
        row.insert(
            "check_in_timestamp".into(),
            Value::Number(created_at.into()),
        );
    }

    // Cloud (PostgreSQL) sends timestamp columns as ISO 8601 strings, but the
    // local SQLite STRICT schema expects INTEGER. Convert any ISO string values
    // to epoch-ms integers so upserts don't fail with type mismatches.
    normalise_iso_timestamps(&mut row);

    Ok(RawRecord {
        id,
        created_at,
        updated_at,
        data: row,
    })
}

/// Scans all values in a row and converts ISO 8601 strings to epoch-ms integers.
/// Only touches `Value::String` entries that successfully parse as ISO 8601;
/// other strings are left untouched.
fn normalise_iso_timestamps(row: &mut HashMap<String, Value>) {
    for value in row.values_mut() {
        if let Value::String(s) = value {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
                *value = Value::Number(dt.timestamp_millis().into());
            } else if let Ok(naive) =
                chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f")
            {
                *value = Value::Number(naive.and_utc().timestamp_millis().into());
            }
        }
    }
}

/// Parses a JSON value into an epoch-millisecond timestamp.
///
/// Accepts:
/// - integers (returned as-is)
/// - floats (truncated to i64)
/// - ISO 8601 strings like "2024-01-15T10:30:00.000Z"
/// - `null` / missing → defaults to 0
fn parse_timestamp(value: Option<Value>) -> Result<i64, String> {
    match value {
        None | Some(Value::Null) => Ok(0),
        Some(Value::Number(n)) => n
            .as_i64()
            .or_else(|| n.as_f64().map(|f| f as i64))
            .ok_or_else(|| format!("non-finite number: {n}")),
        Some(Value::String(s)) => {
            // Try parsing as integer first (string-encoded number)
            if let Ok(n) = s.parse::<i64>() {
                return Ok(n);
            }
            // Parse ISO 8601 → epoch ms
            chrono::DateTime::parse_from_rfc3339(&s)
                .or_else(|_| {
                    // Try without timezone (assume UTC)
                    chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S%.f")
                        .map(|naive| naive.and_utc().fixed_offset())
                })
                .map(|dt| dt.timestamp_millis())
                .map_err(|e| format!("unparseable timestamp '{s}': {e}"))
        }
        Some(other) => Err(format!("unexpected type: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_integer() {
        assert_eq!(
            parse_timestamp(Some(Value::Number(1708700000000_i64.into()))).unwrap(),
            1708700000000
        );
    }

    #[test]
    fn parse_null_defaults_zero() {
        assert_eq!(parse_timestamp(None).unwrap(), 0);
        assert_eq!(parse_timestamp(Some(Value::Null)).unwrap(), 0);
    }

    #[test]
    fn parse_iso_string() {
        let ts = parse_timestamp(Some(Value::String("2024-02-23T12:00:00.000Z".into()))).unwrap();
        assert!(ts > 0);
        // 2024-02-23T12:00:00Z = 1708689600000 ms
        assert_eq!(ts, 1708689600000);
    }

    #[test]
    fn parse_string_encoded_integer() {
        assert_eq!(
            parse_timestamp(Some(Value::String("1708700000000".into()))).unwrap(),
            1708700000000
        );
    }

    #[test]
    fn cloud_row_conversion() {
        let mut row = HashMap::new();
        row.insert("id".into(), Value::String("patient-1".into()));
        row.insert(
            "created_at".into(),
            Value::String("2024-01-01T00:00:00.000Z".into()),
        );
        row.insert("updated_at".into(), Value::Number(2000.into()));
        row.insert("name".into(), Value::String("Test".into()));

        let record = cloud_row_to_raw_record(row).unwrap();
        assert_eq!(record.id, "patient-1");
        assert_eq!(record.updated_at, 2000);
        assert!(record.created_at > 0);
        assert_eq!(
            record.data.get("name").unwrap(),
            &Value::String("Test".into())
        );
        // id, created_at, updated_at should NOT be in data
        assert!(!record.data.contains_key("id"));
        assert!(!record.data.contains_key("created_at"));
        assert!(!record.data.contains_key("updated_at"));
    }
}
