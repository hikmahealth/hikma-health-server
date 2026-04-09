// Prescriptions domain: search, by_patient_visit, create, update, update_status, pickup.

use rusqlite::Connection;
use serde::Deserialize;

use super::serde_flexible::{flexible_opt_timestamp, flexible_timestamp, stringify_json};
use super::{default_limit, now_millis, HandlerResult};

// ============================================================================
// Payloads
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SearchPrescriptionsQuery {
    pub search_query: Option<String>,
    pub clinic_id: Option<String>,
    pub status: Option<Vec<String>>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub date: Option<i64>,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

#[derive(Debug, Deserialize)]
pub struct PrescriptionsByPatientVisitQuery {
    pub patient_id: String,
    pub visit_id: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePrescriptionCommand {
    pub id: Option<String>,
    pub patient_id: String,
    pub provider_id: String,
    pub filled_by: Option<String>,
    pub pickup_clinic_id: Option<String>,
    pub visit_id: Option<String>,
    pub priority: Option<String>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub expiration_date: Option<i64>,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub prescribed_at: i64,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub filled_at: Option<i64>,
    pub status: String,
    #[serde(deserialize_with = "stringify_json")]
    pub items: String,
    pub notes: String,
    #[serde(deserialize_with = "stringify_json")]
    pub metadata: String,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub created_at: i64,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrescriptionCommand {
    pub id: String,
    pub filled_by: Option<String>,
    pub pickup_clinic_id: Option<String>,
    pub priority: Option<String>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub expiration_date: Option<i64>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub filled_at: Option<i64>,
    pub status: Option<String>,
    pub items: Option<String>,
    pub notes: Option<String>,
    pub metadata: Option<String>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrescriptionStatusCommand {
    pub id: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct PickupPrescriptionCommand {
    pub id: String,
    pub provider_id: String,
}

// ============================================================================
// Shared
// ============================================================================

const RX_COLUMNS: &str =
    "id, patient_id, provider_id, filled_by, pickup_clinic_id, visit_id,
     priority, expiration_date, prescribed_at, filled_at, status,
     items, notes, metadata, created_at, updated_at";

const NOT_DELETED: &str = "is_deleted = 0 AND local_server_deleted_at IS NULL";

fn row_to_prescription_json(row: &rusqlite::Row) -> rusqlite::Result<serde_json::Value> {
    Ok(serde_json::json!({
        "id": row.get::<_, String>(0)?,
        "patient_id": row.get::<_, String>(1)?,
        "provider_id": row.get::<_, String>(2)?,
        "filled_by": row.get::<_, Option<String>>(3)?,
        "pickup_clinic_id": row.get::<_, Option<String>>(4)?,
        "visit_id": row.get::<_, Option<String>>(5)?,
        "priority": row.get::<_, Option<String>>(6)?,
        "expiration_date": row.get::<_, Option<i64>>(7)?,
        "prescribed_at": row.get::<_, i64>(8)?,
        "filled_at": row.get::<_, Option<i64>>(9)?,
        "status": row.get::<_, String>(10)?,
        "items": row.get::<_, String>(11)?,
        "notes": row.get::<_, String>(12)?,
        "metadata": row.get::<_, String>(13)?,
        "created_at": row.get::<_, i64>(14)?,
        "updated_at": row.get::<_, i64>(15)?,
    }))
}

fn get_prescription_by_id(
    id: &str,
    conn: &Connection,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let sql = format!(
        "SELECT {RX_COLUMNS} FROM prescriptions WHERE id = ?1 AND {NOT_DELETED}"
    );
    match conn.query_row(&sql, rusqlite::params![id], row_to_prescription_json) {
        Ok(rx) => Ok(rx),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(serde_json::json!(null)),
        Err(e) => Err(e.into()),
    }
}

// ============================================================================
// Handlers
// ============================================================================

pub fn handle_search_prescriptions(
    payload: &SearchPrescriptionsQuery,
    conn: &Connection,
) -> HandlerResult {
    let mut conditions = vec![
        "rx.is_deleted = 0".to_string(),
        "rx.local_server_deleted_at IS NULL".to_string(),
    ];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(term) = &payload.search_query {
        let like = format!("%{term}%");
        conditions.push(format!(
            "(p.given_name LIKE ?{idx} OR p.surname LIKE ?{idx} OR rx.notes LIKE ?{idx})"
        ));
        params.push(Box::new(like));
        idx += 1;
    }
    if let Some(clinic_id) = &payload.clinic_id {
        conditions.push(format!("rx.pickup_clinic_id = ?{idx}"));
        params.push(Box::new(clinic_id.clone()));
        idx += 1;
    }
    if let Some(statuses) = &payload.status {
        if !statuses.is_empty() {
            let phs: Vec<String> = statuses
                .iter()
                .enumerate()
                .map(|(i, _)| format!("?{}", idx + i))
                .collect();
            conditions.push(format!("rx.status IN ({})", phs.join(", ")));
            for s in statuses {
                params.push(Box::new(s.clone()));
            }
            idx += statuses.len();
        }
    }
    if let Some(date) = payload.date {
        conditions.push(format!("rx.prescribed_at >= ?{idx}"));
        params.push(Box::new(date));
        idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    // Count
    let count_sql = format!(
        "SELECT COUNT(*)
         FROM prescriptions rx
         LEFT JOIN patients p ON p.id = rx.patient_id
         WHERE {where_clause}"
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let total: i64 = conn.query_row(&count_sql, param_refs.as_slice(), |r| r.get(0))?;

    // Data
    params.push(Box::new(payload.limit));
    params.push(Box::new(payload.offset));
    let data_sql = format!(
        "SELECT rx.id, rx.patient_id, rx.provider_id, rx.filled_by, rx.pickup_clinic_id,
                rx.visit_id, rx.priority, rx.expiration_date, rx.prescribed_at, rx.filled_at,
                rx.status, rx.items, rx.notes, rx.metadata, rx.created_at, rx.updated_at
         FROM prescriptions rx
         LEFT JOIN patients p ON p.id = rx.patient_id
         WHERE {where_clause}
         ORDER BY rx.prescribed_at DESC
         LIMIT ?{idx} OFFSET ?{}",
        idx + 1
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&data_sql)?;
    let rows = stmt.query_map(param_refs.as_slice(), row_to_prescription_json)?;
    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({
        "data": data,
        "total": total,
        "limit": payload.limit,
        "offset": payload.offset,
    }))
}

pub fn handle_prescriptions_by_patient_visit(
    payload: &PrescriptionsByPatientVisitQuery,
    conn: &Connection,
) -> HandlerResult {
    let sql = format!(
        "SELECT {RX_COLUMNS} FROM prescriptions
         WHERE patient_id = ?1 AND visit_id = ?2 AND {NOT_DELETED}
         ORDER BY prescribed_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params![payload.patient_id, payload.visit_id],
        row_to_prescription_json,
    )?;
    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

pub fn handle_create_prescription(
    payload: &CreatePrescriptionCommand,
    conn: &Connection,
) -> HandlerResult {
    let now = now_millis();
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::now_v7().to_string());

    conn.execute(
        r#"INSERT INTO prescriptions (
            id, patient_id, provider_id, filled_by, pickup_clinic_id, visit_id,
            priority, expiration_date, prescribed_at, filled_at, status,
            items, notes, metadata, is_deleted,
            created_at, updated_at, last_modified, server_created_at,
            local_server_created_at, local_server_last_modified_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6,
            ?7, ?8, ?9, ?10, ?11,
            ?12, ?13, ?14, 0,
            ?15, ?16, ?17, ?18,
            ?19, ?20
        )
        ON CONFLICT(id) DO UPDATE SET
            filled_by = excluded.filled_by,
            pickup_clinic_id = excluded.pickup_clinic_id,
            priority = excluded.priority,
            expiration_date = excluded.expiration_date,
            filled_at = excluded.filled_at,
            status = excluded.status,
            items = excluded.items,
            notes = excluded.notes,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at,
            local_server_last_modified_at = excluded.local_server_last_modified_at
        "#,
        rusqlite::params![
            id,
            payload.patient_id,
            payload.provider_id,
            payload.filled_by,
            payload.pickup_clinic_id,
            payload.visit_id,
            payload.priority,
            payload.expiration_date,
            payload.prescribed_at,
            payload.filled_at,
            payload.status,
            payload.items,
            payload.notes,
            payload.metadata,
            payload.created_at,
            payload.updated_at,
            now,
            now,
            now,
            now,
        ],
    )?;

    Ok(serde_json::json!({ "prescription_id": id }))
}

pub fn handle_update_prescription(
    payload: &UpdatePrescriptionCommand,
    conn: &Connection,
) -> HandlerResult {
    let now = now_millis();
    let mut sets = vec!["local_server_last_modified_at = ?1".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];
    let mut idx = 2;

    macro_rules! set_if_some {
        ($field:ident, $col:expr) => {
            if let Some(ref val) = payload.$field {
                sets.push(format!("{} = ?{idx}", $col));
                params.push(Box::new(val.clone()));
                idx += 1;
            }
        };
    }

    set_if_some!(filled_by, "filled_by");
    set_if_some!(pickup_clinic_id, "pickup_clinic_id");
    set_if_some!(priority, "priority");
    set_if_some!(expiration_date, "expiration_date");
    set_if_some!(filled_at, "filled_at");
    set_if_some!(status, "status");
    set_if_some!(items, "items");
    set_if_some!(notes, "notes");
    set_if_some!(metadata, "metadata");

    let updated_at = payload.updated_at.unwrap_or(now);
    sets.push(format!("updated_at = ?{idx}"));
    params.push(Box::new(updated_at));
    idx += 1;

    params.push(Box::new(payload.id.clone()));

    let sql = format!(
        "UPDATE prescriptions SET {} WHERE id = ?{idx} AND {NOT_DELETED}",
        sets.join(", ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let changed = conn.execute(&sql, param_refs.as_slice())?;

    if changed == 0 {
        return Err(format!("Prescription '{}' not found", payload.id).into());
    }
    get_prescription_by_id(&payload.id, conn)
}

pub fn handle_update_prescription_status(
    payload: &UpdatePrescriptionStatusCommand,
    conn: &Connection,
) -> HandlerResult {
    let now = now_millis();
    let changed = conn.execute(
        &format!(
            "UPDATE prescriptions SET status = ?1, updated_at = ?2,
             local_server_last_modified_at = ?3
             WHERE id = ?4 AND {NOT_DELETED}"
        ),
        rusqlite::params![payload.status, now, now, payload.id],
    )?;

    if changed == 0 {
        return Err(format!("Prescription '{}' not found", payload.id).into());
    }
    Ok(serde_json::json!({ "ok": true }))
}

pub fn handle_pickup_prescription(
    payload: &PickupPrescriptionCommand,
    conn: &Connection,
) -> HandlerResult {
    let now = now_millis();
    let changed = conn.execute(
        &format!(
            "UPDATE prescriptions SET status = 'picked-up', filled_by = ?1,
             filled_at = ?2, updated_at = ?3, local_server_last_modified_at = ?4
             WHERE id = ?5 AND {NOT_DELETED}"
        ),
        rusqlite::params![payload.provider_id, now, now, now, payload.id],
    )?;

    if changed == 0 {
        return Err(format!("Prescription '{}' not found", payload.id).into());
    }
    Ok(serde_json::json!({ "ok": true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    fn make_create_cmd(id: &str, patient_id: &str, visit_id: &str) -> CreatePrescriptionCommand {
        CreatePrescriptionCommand {
            id: Some(id.to_string()),
            patient_id: patient_id.to_string(),
            provider_id: "prov1".to_string(),
            filled_by: None,
            pickup_clinic_id: Some("c1".to_string()),
            visit_id: Some(visit_id.to_string()),
            priority: Some("normal".to_string()),
            expiration_date: Some(9999999),
            prescribed_at: 1000,
            filled_at: None,
            status: "pending".to_string(),
            items: "[]".to_string(),
            notes: "Take with food".to_string(),
            metadata: "{}".to_string(),
            created_at: 1000,
            updated_at: 1000,
        }
    }

    #[test]
    fn create_prescription() {
        let conn = setup_test_db();
        let cmd = make_create_cmd("rx1", "p1", "v1");
        let result = handle_create_prescription(&cmd, &conn).unwrap();
        assert_eq!(result["prescription_id"], "rx1");
    }

    #[test]
    fn by_patient_visit() {
        let conn = setup_test_db();
        handle_create_prescription(&make_create_cmd("rx1", "p1", "v1"), &conn).unwrap();
        handle_create_prescription(&make_create_cmd("rx2", "p1", "v2"), &conn).unwrap();

        let query = PrescriptionsByPatientVisitQuery {
            patient_id: "p1".to_string(),
            visit_id: "v1".to_string(),
        };
        let result = handle_prescriptions_by_patient_visit(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn search_prescriptions_no_filter() {
        let conn = setup_test_db();
        handle_create_prescription(&make_create_cmd("rx1", "p1", "v1"), &conn).unwrap();
        handle_create_prescription(&make_create_cmd("rx2", "p2", "v2"), &conn).unwrap();

        let query = SearchPrescriptionsQuery {
            search_query: None,
            clinic_id: None,
            status: None,
            date: None,
            limit: 20,
            offset: 0,
        };
        let result = handle_search_prescriptions(&query, &conn).unwrap();
        assert_eq!(result["total"], 2);
    }

    #[test]
    fn search_prescriptions_by_status() {
        let conn = setup_test_db();
        handle_create_prescription(&make_create_cmd("rx1", "p1", "v1"), &conn).unwrap();
        let mut cmd2 = make_create_cmd("rx2", "p1", "v2");
        cmd2.status = "prepared".to_string();
        handle_create_prescription(&cmd2, &conn).unwrap();

        let query = SearchPrescriptionsQuery {
            search_query: None,
            clinic_id: None,
            status: Some(vec!["pending".to_string()]),
            date: None,
            limit: 20,
            offset: 0,
        };
        let result = handle_search_prescriptions(&query, &conn).unwrap();
        assert_eq!(result["total"], 1);
    }

    #[test]
    fn update_prescription() {
        let conn = setup_test_db();
        handle_create_prescription(&make_create_cmd("rx1", "p1", "v1"), &conn).unwrap();

        let update = UpdatePrescriptionCommand {
            id: "rx1".to_string(),
            filled_by: Some("pharmacist1".to_string()),
            pickup_clinic_id: None,
            priority: Some("high".to_string()),
            expiration_date: None,
            filled_at: None,
            status: Some("prepared".to_string()),
            items: None,
            notes: None,
            metadata: None,
            updated_at: None,
        };
        let result = handle_update_prescription(&update, &conn).unwrap();
        assert_eq!(result["status"], "prepared");
        assert_eq!(result["priority"], "high");
    }

    #[test]
    fn update_prescription_status() {
        let conn = setup_test_db();
        handle_create_prescription(&make_create_cmd("rx1", "p1", "v1"), &conn).unwrap();

        let cmd = UpdatePrescriptionStatusCommand {
            id: "rx1".to_string(),
            status: "expired".to_string(),
        };
        handle_update_prescription_status(&cmd, &conn).unwrap();

        let rx = get_prescription_by_id("rx1", &conn).unwrap();
        assert_eq!(rx["status"], "expired");
    }

    #[test]
    fn pickup_prescription() {
        let conn = setup_test_db();
        handle_create_prescription(&make_create_cmd("rx1", "p1", "v1"), &conn).unwrap();

        let cmd = PickupPrescriptionCommand {
            id: "rx1".to_string(),
            provider_id: "pharm1".to_string(),
        };
        handle_pickup_prescription(&cmd, &conn).unwrap();

        let rx = get_prescription_by_id("rx1", &conn).unwrap();
        assert_eq!(rx["status"], "picked-up");
        assert_eq!(rx["filled_by"], "pharm1");
    }

    #[test]
    fn prescriptions_exclude_soft_deleted() {
        let conn = setup_test_db();
        handle_create_prescription(&make_create_cmd("rx1", "p1", "v1"), &conn).unwrap();
        conn.execute(
            "UPDATE prescriptions SET local_server_deleted_at = 9999 WHERE id = 'rx1'",
            [],
        )
        .unwrap();

        let rx = get_prescription_by_id("rx1", &conn).unwrap();
        assert!(rx.is_null());
    }

    #[test]
    fn update_nonexistent_fails() {
        let conn = setup_test_db();
        let cmd = UpdatePrescriptionStatusCommand {
            id: "ghost".to_string(),
            status: "pending".to_string(),
        };
        assert!(handle_update_prescription_status(&cmd, &conn).is_err());
    }

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn create_n_then_search(n in 1u32..10) {
            let conn = setup_test_db();
            for i in 0..n {
                handle_create_prescription(
                    &make_create_cmd(&format!("rx{i}"), "p1", &format!("v{i}")),
                    &conn,
                ).unwrap();
            }
            let query = SearchPrescriptionsQuery {
                search_query: None, clinic_id: None,
                status: None, date: None,
                limit: 100, offset: 0,
            };
            let result = handle_search_prescriptions(&query, &conn).unwrap();
            prop_assert_eq!(result["total"].as_i64().unwrap(), n as i64);
        }

        #[test]
        fn upsert_idempotent(repeats in 1u32..5) {
            let conn = setup_test_db();
            let cmd = make_create_cmd("idem_rx", "p1", "v1");
            for _ in 0..repeats {
                handle_create_prescription(&cmd, &conn).unwrap();
            }
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM prescriptions WHERE id = 'idem_rx'", [], |r| r.get(0))
                .unwrap();
            prop_assert_eq!(count, 1);
        }
    }
}
