//! Shared database helpers for sync operations (REST and cloud).
//!
//! These functions handle dynamic column discovery and value conversion
//! but contain NO sync-protocol semantics (timestamps, conflict policies).

use std::collections::{HashMap, HashSet};

use rusqlite::Connection;
use serde_json::Value;

use crate::RawRecord;

/// Returns column names for `table`, excluding `local_server_*` tracking columns.
/// Used for SELECT queries where we want only client-visible data.
pub fn get_data_columns(conn: &Connection, table: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info(\"{}\")", table))
        .map_err(|e| format!("PRAGMA table_info failed for {table}: {e}"))?;

    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| format!("Failed to query table_info for {table}: {e}"))?
        .filter_map(|r| r.ok())
        .filter(|name| !name.starts_with("local_server_"))
        .collect();

    Ok(cols)
}

/// Returns ALL column names for `table` as a HashSet.
/// Used for filtering incoming records to only valid columns.
pub fn get_all_columns(conn: &Connection, table: &str) -> Result<HashSet<String>, String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info(\"{}\")", table))
        .map_err(|e| format!("PRAGMA table_info failed for {table}: {e}"))?;

    let cols: HashSet<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| format!("Failed to query table_info for {table}: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(cols)
}

/// Executes a SELECT and maps each row into a `RawRecord` using the provided column list.
pub fn query_records(
    conn: &Connection,
    sql: &str,
    param: i64,
    columns: &[String],
) -> Result<Vec<RawRecord>, String> {
    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| format!("Failed to prepare: {e}"))?;

    let rows = stmt
        .query_map([param], |row| {
            let mut id = String::new();
            let mut created_at = 0i64;
            let mut updated_at = 0i64;
            let mut data = HashMap::new();

            for (i, col) in columns.iter().enumerate() {
                let val = row_value_at(row, i);
                match col.as_str() {
                    "id" => {
                        if let Value::String(ref s) = val {
                            id = s.clone();
                        }
                    }
                    "created_at" => {
                        if let Value::Number(ref n) = val {
                            created_at = n.as_i64().unwrap_or(0);
                        }
                    }
                    "updated_at" => {
                        if let Value::Number(ref n) = val {
                            updated_at = n.as_i64().unwrap_or(0);
                        }
                    }
                    _ => {}
                }
                data.insert(col.clone(), val);
            }

            Ok(RawRecord {
                id,
                created_at,
                updated_at,
                data,
            })
        })
        .map_err(|e| format!("Failed to query: {e}"))?;

    let mut records = Vec::new();
    for r in rows {
        records.push(r.map_err(|e| format!("Failed to read row: {e}"))?);
    }
    Ok(records)
}

/// Reads a column value from a row as a `serde_json::Value`.
/// Falls back gracefully for all SQLite types.
pub fn row_value_at(row: &rusqlite::Row, idx: usize) -> Value {
    // Try types in order of likelihood
    if let Ok(v) = row.get::<_, i64>(idx) {
        return Value::Number(v.into());
    }
    if let Ok(v) = row.get::<_, f64>(idx) {
        return serde_json::Number::from_f64(v)
            .map(Value::Number)
            .unwrap_or(Value::Null);
    }
    if let Ok(v) = row.get::<_, String>(idx) {
        return Value::String(v);
    }
    Value::Null
}

/// Converts a `serde_json::Value` to a rusqlite-compatible boxed parameter.
///
/// SQLite STRICT mode is picky: TEXT columns reject integers, INTEGER columns
/// reject strings, etc. We map JSON types to their natural SQLite affinity.
pub fn json_value_to_sql(val: &Value) -> Box<dyn rusqlite::types::ToSql> {
    match val {
        Value::Null => Box::new(Option::<String>::None),
        Value::Bool(b) => Box::new(if *b { 1i64 } else { 0i64 }),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(f) = n.as_f64() {
                Box::new(f)
            } else {
                // Fallback: store as text
                Box::new(n.to_string())
            }
        }
        Value::String(s) => Box::new(s.clone()),
        // Arrays and objects → store as JSON text
        Value::Array(_) | Value::Object(_) => Box::new(val.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    #[test]
    fn get_data_columns_excludes_server_columns() {
        let conn = setup_test_db();
        let cols = get_data_columns(&conn, "clinics").unwrap();
        assert!(cols.contains(&"id".to_string()));
        assert!(cols.contains(&"name".to_string()));
        assert!(!cols.iter().any(|c| c.starts_with("local_server_")));
    }

    #[test]
    fn get_all_columns_includes_server_columns() {
        let conn = setup_test_db();
        let cols = get_all_columns(&conn, "clinics").unwrap();
        assert!(cols.contains("id"));
        assert!(cols.contains("name"));
        assert!(cols.contains("local_server_created_at"));
        assert!(cols.contains("local_server_last_modified_at"));
        assert!(cols.contains("local_server_deleted_at"));
    }

    #[test]
    fn get_data_columns_nonexistent_table_returns_empty() {
        let conn = setup_test_db();
        let cols = get_data_columns(&conn, "nonexistent_table").unwrap();
        assert!(cols.is_empty());
    }

    #[test]
    fn query_records_maps_structured_columns() {
        let conn = setup_test_db();

        conn.execute(
            r#"INSERT INTO clinics (id, name, created_at, updated_at, is_deleted, is_archived,
                local_server_created_at, local_server_last_modified_at)
               VALUES ('c1', 'Test Clinic', 1000, 2000, 0, 0, 3000, 3000)"#,
            [],
        )
        .unwrap();

        let columns = get_data_columns(&conn, "clinics").unwrap();
        let col_list = columns
            .iter()
            .map(|c| format!("\"{c}\""))
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT {} FROM \"clinics\" WHERE local_server_created_at > ?1",
            col_list
        );

        let records = query_records(&conn, &sql, 0, &columns).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].id, "c1");
        assert_eq!(records[0].created_at, 1000);
        assert_eq!(records[0].updated_at, 2000);
        assert_eq!(records[0].data["name"], Value::String("Test Clinic".into()));
    }

    #[test]
    fn json_value_to_sql_handles_all_types() {
        // Null
        let boxed = json_value_to_sql(&Value::Null);
        assert!(boxed.as_ref().to_sql().is_ok());

        // Bool
        let boxed = json_value_to_sql(&Value::Bool(true));
        assert!(boxed.as_ref().to_sql().is_ok());

        // Integer
        let boxed = json_value_to_sql(&serde_json::json!(42));
        assert!(boxed.as_ref().to_sql().is_ok());

        // Float
        let boxed = json_value_to_sql(&serde_json::json!(3.14));
        assert!(boxed.as_ref().to_sql().is_ok());

        // String
        let boxed = json_value_to_sql(&serde_json::json!("hello"));
        assert!(boxed.as_ref().to_sql().is_ok());

        // Array → JSON text
        let boxed = json_value_to_sql(&serde_json::json!([1, 2, 3]));
        assert!(boxed.as_ref().to_sql().is_ok());

        // Object → JSON text
        let boxed = json_value_to_sql(&serde_json::json!({"key": "val"}));
        assert!(boxed.as_ref().to_sql().is_ok());
    }
}
