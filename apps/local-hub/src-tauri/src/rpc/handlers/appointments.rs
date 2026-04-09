// Appointments domain: list, get, search, create, update, cancel, complete.

use rusqlite::Connection;
use serde::Deserialize;

use super::serde_flexible::{flexible_opt_timestamp, flexible_timestamp, stringify_json};
use super::{default_limit, now_millis, HandlerResult};

// ============================================================================
// Payloads
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ListAppointmentsQuery {
    #[serde(deserialize_with = "flexible_timestamp")]
    pub start_date: i64,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub end_date: i64,
    pub clinic_id: Option<String>,
    pub status: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

#[derive(Debug, Deserialize)]
pub struct GetAppointmentQuery {
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct GetPatientAppointmentsQuery {
    pub patient_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SearchAppointmentsQuery {
    pub search_query: String,
    pub clinic_id: String,
    pub department_ids: Option<Vec<String>>,
    pub status: Option<Vec<String>>,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub date: i64,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateAppointmentCommand {
    pub id: Option<String>,
    pub provider_id: Option<String>,
    pub clinic_id: String,
    pub patient_id: String,
    pub user_id: String,
    pub current_visit_id: String,
    pub fulfilled_visit_id: Option<String>,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub timestamp: i64,
    pub duration: Option<i64>,
    pub reason: String,
    pub notes: String,
    #[serde(default)]
    pub is_walk_in: i64,
    #[serde(deserialize_with = "stringify_json")]
    pub departments: String,
    pub status: String,
    #[serde(deserialize_with = "stringify_json")]
    pub metadata: String,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub created_at: i64,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAppointmentCommand {
    pub id: String,
    pub provider_id: Option<String>,
    pub fulfilled_visit_id: Option<String>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub timestamp: Option<i64>,
    pub duration: Option<i64>,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub is_walk_in: Option<i64>,
    pub departments: Option<String>,
    pub status: Option<String>,
    pub metadata: Option<String>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CancelAppointmentCommand {
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct CompleteAppointmentCommand {
    pub id: String,
    pub user_id: String,
    pub visit_id: Option<String>,
}

// ============================================================================
// Shared
// ============================================================================

const APPT_COLUMNS: &str =
    "id, provider_id, clinic_id, patient_id, user_id, current_visit_id,
     fulfilled_visit_id, timestamp, duration, reason, notes,
     is_walk_in, departments, status, metadata, created_at, updated_at";

fn row_to_appointment_json(row: &rusqlite::Row) -> rusqlite::Result<serde_json::Value> {
    Ok(serde_json::json!({
        "id": row.get::<_, String>(0)?,
        "provider_id": row.get::<_, Option<String>>(1)?,
        "clinic_id": row.get::<_, String>(2)?,
        "patient_id": row.get::<_, String>(3)?,
        "user_id": row.get::<_, String>(4)?,
        "current_visit_id": row.get::<_, String>(5)?,
        "fulfilled_visit_id": row.get::<_, Option<String>>(6)?,
        "timestamp": row.get::<_, i64>(7)?,
        "duration": row.get::<_, Option<i64>>(8)?,
        "reason": row.get::<_, String>(9)?,
        "notes": row.get::<_, String>(10)?,
        "is_walk_in": row.get::<_, i64>(11)?,
        "departments": row.get::<_, String>(12)?,
        "status": row.get::<_, String>(13)?,
        "metadata": row.get::<_, String>(14)?,
        "created_at": row.get::<_, i64>(15)?,
        "updated_at": row.get::<_, i64>(16)?,
    }))
}

const NOT_DELETED: &str = "is_deleted = 0 AND local_server_deleted_at IS NULL";

// ============================================================================
// Handlers
// ============================================================================

pub fn handle_list_appointments(
    payload: &ListAppointmentsQuery,
    conn: &Connection,
) -> HandlerResult {
    let mut conditions = vec![
        NOT_DELETED.to_string(),
        "timestamp >= ?1".to_string(),
        "timestamp <= ?2".to_string(),
    ];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(payload.start_date),
        Box::new(payload.end_date),
    ];
    let mut idx = 3;

    if let Some(clinic_id) = &payload.clinic_id {
        conditions.push(format!("clinic_id = ?{idx}"));
        params.push(Box::new(clinic_id.clone()));
        idx += 1;
    }
    if let Some(status) = &payload.status {
        conditions.push(format!("status = ?{idx}"));
        params.push(Box::new(status.clone()));
        idx += 1;
    }

    // Count query
    let count_sql = format!(
        "SELECT COUNT(*) FROM appointments WHERE {}",
        conditions.join(" AND ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let total: i64 = conn.query_row(&count_sql, param_refs.as_slice(), |r| r.get(0))?;

    // Data query with pagination
    conditions.push(format!("1=1 ORDER BY timestamp DESC LIMIT ?{idx} OFFSET ?{}", idx + 1));
    params.push(Box::new(payload.limit));
    params.push(Box::new(payload.offset));

    let data_sql = format!(
        "SELECT {APPT_COLUMNS} FROM appointments WHERE {}",
        conditions.join(" AND ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&data_sql)?;
    let rows = stmt.query_map(param_refs.as_slice(), row_to_appointment_json)?;
    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({
        "data": data,
        "total": total,
        "limit": payload.limit,
        "offset": payload.offset,
    }))
}

pub fn handle_get_appointment(
    payload: &GetAppointmentQuery,
    conn: &Connection,
) -> HandlerResult {
    let sql = format!(
        "SELECT {APPT_COLUMNS} FROM appointments WHERE id = ?1 AND {NOT_DELETED}"
    );
    match conn.query_row(&sql, rusqlite::params![payload.id], row_to_appointment_json) {
        Ok(appt) => Ok(appt),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(serde_json::json!(null)),
        Err(e) => Err(e.into()),
    }
}

pub fn handle_get_patient_appointments(
    payload: &GetPatientAppointmentsQuery,
    conn: &Connection,
) -> HandlerResult {
    let sql = format!(
        "SELECT {APPT_COLUMNS} FROM appointments
         WHERE patient_id = ?1 AND {NOT_DELETED}
         ORDER BY timestamp DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params![payload.patient_id],
        row_to_appointment_json,
    )?;
    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

/// Searches appointments by patient name or reason, scoped to a clinic and date.
pub fn handle_search_appointments(
    payload: &SearchAppointmentsQuery,
    conn: &Connection,
) -> HandlerResult {
    let like_term = format!("%{}%", payload.search_query);

    // Build dynamic WHERE
    let mut conditions = vec![
        "a.is_deleted = 0".to_string(),
        "a.local_server_deleted_at IS NULL".to_string(),
        "a.clinic_id = ?1".to_string(),
        "a.timestamp >= ?2".to_string(),
    ];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(payload.clinic_id.clone()),
        Box::new(payload.date),
    ];
    let mut idx = 3;

    // Text search on patient name or appointment reason
    conditions.push(format!(
        "(p.given_name LIKE ?{idx} OR p.surname LIKE ?{idx} OR a.reason LIKE ?{idx})"
    ));
    params.push(Box::new(like_term));
    idx += 1;

    if let Some(statuses) = &payload.status {
        if !statuses.is_empty() {
            let placeholders: Vec<String> = statuses
                .iter()
                .enumerate()
                .map(|(i, _)| format!("?{}", idx + i))
                .collect();
            conditions.push(format!("a.status IN ({})", placeholders.join(", ")));
            for s in statuses {
                params.push(Box::new(s.clone()));
            }
            idx += statuses.len();
        }
    }

    // Count
    let count_sql = format!(
        "SELECT COUNT(*)
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE {}",
        conditions.join(" AND ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let total: i64 = conn.query_row(&count_sql, param_refs.as_slice(), |r| r.get(0))?;

    // Data
    params.push(Box::new(payload.limit));
    params.push(Box::new(payload.offset));
    let data_sql = format!(
        "SELECT a.id, a.provider_id, a.clinic_id, a.patient_id, a.user_id, a.current_visit_id,
                a.fulfilled_visit_id, a.timestamp, a.duration, a.reason, a.notes,
                a.is_walk_in, a.departments, a.status, a.metadata, a.created_at, a.updated_at
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE {}
         ORDER BY a.timestamp DESC
         LIMIT ?{idx} OFFSET ?{}",
        conditions.join(" AND "),
        idx + 1
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&data_sql)?;
    let rows = stmt.query_map(param_refs.as_slice(), row_to_appointment_json)?;
    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({
        "data": data,
        "total": total,
        "limit": payload.limit,
        "offset": payload.offset,
    }))
}

pub fn handle_create_appointment(
    payload: &CreateAppointmentCommand,
    conn: &Connection,
) -> HandlerResult {
    let now = now_millis();
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::now_v7().to_string());

    conn.execute(
        r#"INSERT INTO appointments (
            id, provider_id, clinic_id, patient_id, user_id, current_visit_id,
            fulfilled_visit_id, timestamp, duration, reason, notes,
            is_walk_in, departments, status, metadata, is_deleted,
            created_at, updated_at, last_modified, server_created_at,
            local_server_created_at, local_server_last_modified_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6,
            ?7, ?8, ?9, ?10, ?11,
            ?12, ?13, ?14, ?15, 0,
            ?16, ?17, ?18, ?19,
            ?20, ?21
        )
        ON CONFLICT(id) DO UPDATE SET
            provider_id = excluded.provider_id,
            fulfilled_visit_id = excluded.fulfilled_visit_id,
            timestamp = excluded.timestamp,
            duration = excluded.duration,
            reason = excluded.reason,
            notes = excluded.notes,
            is_walk_in = excluded.is_walk_in,
            departments = excluded.departments,
            status = excluded.status,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at,
            local_server_last_modified_at = excluded.local_server_last_modified_at
        "#,
        rusqlite::params![
            id,
            payload.provider_id,
            payload.clinic_id,
            payload.patient_id,
            payload.user_id,
            payload.current_visit_id,
            payload.fulfilled_visit_id,
            payload.timestamp,
            payload.duration,
            payload.reason,
            payload.notes,
            payload.is_walk_in,
            payload.departments,
            payload.status,
            payload.metadata,
            payload.created_at,
            payload.updated_at,
            now,
            now,
            now,
            now,
        ],
    )?;

    Ok(serde_json::json!({ "appointment_id": id }))
}

pub fn handle_update_appointment(
    payload: &UpdateAppointmentCommand,
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

    set_if_some!(provider_id, "provider_id");
    set_if_some!(fulfilled_visit_id, "fulfilled_visit_id");
    set_if_some!(timestamp, "timestamp");
    set_if_some!(duration, "duration");
    set_if_some!(reason, "reason");
    set_if_some!(notes, "notes");
    set_if_some!(is_walk_in, "is_walk_in");
    set_if_some!(departments, "departments");
    set_if_some!(status, "status");
    set_if_some!(metadata, "metadata");

    let updated_at = payload.updated_at.unwrap_or(now);
    sets.push(format!("updated_at = ?{idx}"));
    params.push(Box::new(updated_at));
    idx += 1;

    params.push(Box::new(payload.id.clone()));

    let sql = format!(
        "UPDATE appointments SET {} WHERE id = ?{idx} AND {NOT_DELETED}",
        sets.join(", ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let changed = conn.execute(&sql, param_refs.as_slice())?;

    if changed == 0 {
        return Err(format!("Appointment '{}' not found", payload.id).into());
    }

    // Return updated record
    let get_query = GetAppointmentQuery {
        id: payload.id.clone(),
    };
    handle_get_appointment(&get_query, conn)
}

pub fn handle_cancel_appointment(
    payload: &CancelAppointmentCommand,
    conn: &Connection,
) -> HandlerResult {
    let now = now_millis();
    let changed = conn.execute(
        &format!(
            "UPDATE appointments SET status = 'cancelled', updated_at = ?1,
             local_server_last_modified_at = ?2
             WHERE id = ?3 AND {NOT_DELETED}"
        ),
        rusqlite::params![now, now, payload.id],
    )?;

    if changed == 0 {
        return Err(format!("Appointment '{}' not found", payload.id).into());
    }
    Ok(serde_json::json!({ "cancelled": true }))
}

pub fn handle_complete_appointment(
    payload: &CompleteAppointmentCommand,
    conn: &Connection,
) -> HandlerResult {
    let now = now_millis();
    let changed = conn.execute(
        &format!(
            "UPDATE appointments SET status = 'completed', fulfilled_visit_id = ?1,
             updated_at = ?2, local_server_last_modified_at = ?3
             WHERE id = ?4 AND {NOT_DELETED}"
        ),
        rusqlite::params![payload.visit_id, now, now, payload.id],
    )?;

    if changed == 0 {
        return Err(format!("Appointment '{}' not found", payload.id).into());
    }
    Ok(serde_json::json!({ "completed": true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    fn insert_patient(conn: &Connection, id: &str, given: &str, surname: &str) {
        conn.execute(
            "INSERT INTO patients (
                id, given_name, surname, date_of_birth, citizenship, hometown,
                phone, sex, additional_data, metadata, is_deleted,
                government_id, external_patient_id,
                created_at, updated_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, ?2, ?3, '1990-01-01', 'X', 'Town',
                      '555', 'M', '{}', '{}', 0, 'GOV', 'EXT',
                      1000, 1000, 1000, 1000)",
            rusqlite::params![id, given, surname],
        )
        .unwrap();
    }

    fn make_create_cmd(id: &str, patient_id: &str, ts: i64) -> CreateAppointmentCommand {
        CreateAppointmentCommand {
            id: Some(id.to_string()),
            provider_id: Some("prov1".to_string()),
            clinic_id: "c1".to_string(),
            patient_id: patient_id.to_string(),
            user_id: "u1".to_string(),
            current_visit_id: "v1".to_string(),
            fulfilled_visit_id: None,
            timestamp: ts,
            duration: Some(30),
            reason: "Checkup".to_string(),
            notes: "".to_string(),
            is_walk_in: 0,
            departments: "[]".to_string(),
            status: "pending".to_string(),
            metadata: "{}".to_string(),
            created_at: ts,
            updated_at: ts,
        }
    }

    #[test]
    fn create_appointment() {
        let conn = setup_test_db();
        let cmd = make_create_cmd("a1", "p1", 1000);
        let result = handle_create_appointment(&cmd, &conn).unwrap();
        assert_eq!(result["appointment_id"], "a1");
    }

    #[test]
    fn get_appointment_by_id() {
        let conn = setup_test_db();
        handle_create_appointment(&make_create_cmd("a1", "p1", 1000), &conn).unwrap();

        let query = GetAppointmentQuery {
            id: "a1".to_string(),
        };
        let result = handle_get_appointment(&query, &conn).unwrap();
        assert_eq!(result["id"], "a1");
        assert_eq!(result["status"], "pending");
    }

    #[test]
    fn get_appointment_not_found() {
        let conn = setup_test_db();
        let query = GetAppointmentQuery {
            id: "missing".to_string(),
        };
        let result = handle_get_appointment(&query, &conn).unwrap();
        assert!(result.is_null());
    }

    #[test]
    fn list_appointments_by_date_range() {
        let conn = setup_test_db();
        handle_create_appointment(&make_create_cmd("a1", "p1", 1000), &conn).unwrap();
        handle_create_appointment(&make_create_cmd("a2", "p1", 2000), &conn).unwrap();
        handle_create_appointment(&make_create_cmd("a3", "p1", 5000), &conn).unwrap();

        let query = ListAppointmentsQuery {
            start_date: 500,
            end_date: 3000,
            clinic_id: None,
            status: None,
            limit: 20,
            offset: 0,
        };
        let result = handle_list_appointments(&query, &conn).unwrap();
        assert_eq!(result["total"], 2);
        assert_eq!(result["data"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn list_appointments_with_status_filter() {
        let conn = setup_test_db();
        handle_create_appointment(&make_create_cmd("a1", "p1", 1000), &conn).unwrap();
        // Change a1 to completed
        conn.execute(
            "UPDATE appointments SET status = 'completed' WHERE id = 'a1'",
            [],
        )
        .unwrap();
        handle_create_appointment(&make_create_cmd("a2", "p1", 1000), &conn).unwrap();

        let query = ListAppointmentsQuery {
            start_date: 0,
            end_date: 9999,
            clinic_id: None,
            status: Some("pending".to_string()),
            limit: 20,
            offset: 0,
        };
        let result = handle_list_appointments(&query, &conn).unwrap();
        assert_eq!(result["total"], 1);
    }

    #[test]
    fn get_patient_appointments() {
        let conn = setup_test_db();
        handle_create_appointment(&make_create_cmd("a1", "p1", 1000), &conn).unwrap();
        handle_create_appointment(&make_create_cmd("a2", "p2", 1000), &conn).unwrap();

        let query = GetPatientAppointmentsQuery {
            patient_id: "p1".to_string(),
        };
        let result = handle_get_patient_appointments(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn update_appointment() {
        let conn = setup_test_db();
        handle_create_appointment(&make_create_cmd("a1", "p1", 1000), &conn).unwrap();

        let update = UpdateAppointmentCommand {
            id: "a1".to_string(),
            provider_id: None,
            fulfilled_visit_id: None,
            timestamp: None,
            duration: Some(60),
            reason: Some("Follow-up".to_string()),
            notes: None,
            is_walk_in: None,
            departments: None,
            status: Some("confirmed".to_string()),
            metadata: None,
            updated_at: None,
        };
        let result = handle_update_appointment(&update, &conn).unwrap();
        assert_eq!(result["status"], "confirmed");
        assert_eq!(result["reason"], "Follow-up");
        assert_eq!(result["duration"], 60);
    }

    #[test]
    fn cancel_appointment() {
        let conn = setup_test_db();
        handle_create_appointment(&make_create_cmd("a1", "p1", 1000), &conn).unwrap();

        let cmd = CancelAppointmentCommand {
            id: "a1".to_string(),
        };
        handle_cancel_appointment(&cmd, &conn).unwrap();

        let q = GetAppointmentQuery {
            id: "a1".to_string(),
        };
        let result = handle_get_appointment(&q, &conn).unwrap();
        assert_eq!(result["status"], "cancelled");
    }

    #[test]
    fn complete_appointment() {
        let conn = setup_test_db();
        handle_create_appointment(&make_create_cmd("a1", "p1", 1000), &conn).unwrap();

        let cmd = CompleteAppointmentCommand {
            id: "a1".to_string(),
            user_id: "u1".to_string(),
            visit_id: Some("visit_123".to_string()),
        };
        handle_complete_appointment(&cmd, &conn).unwrap();

        let q = GetAppointmentQuery {
            id: "a1".to_string(),
        };
        let result = handle_get_appointment(&q, &conn).unwrap();
        assert_eq!(result["status"], "completed");
        assert_eq!(result["fulfilled_visit_id"], "visit_123");
    }

    #[test]
    fn cancel_nonexistent_fails() {
        let conn = setup_test_db();
        let cmd = CancelAppointmentCommand {
            id: "ghost".to_string(),
        };
        assert!(handle_cancel_appointment(&cmd, &conn).is_err());
    }

    #[test]
    fn search_appointments_by_patient_name() {
        let conn = setup_test_db();
        insert_patient(&conn, "p1", "Alice", "Smith");
        insert_patient(&conn, "p2", "Bob", "Jones");
        handle_create_appointment(&make_create_cmd("a1", "p1", 1000), &conn).unwrap();
        handle_create_appointment(&make_create_cmd("a2", "p2", 1000), &conn).unwrap();

        let query = SearchAppointmentsQuery {
            search_query: "Alice".to_string(),
            clinic_id: "c1".to_string(),
            department_ids: None,
            status: None,
            date: 0,
            limit: 20,
            offset: 0,
        };
        let result = handle_search_appointments(&query, &conn).unwrap();
        assert_eq!(result["total"], 1);
        assert_eq!(result["data"][0]["patient_id"], "p1");
    }

    #[test]
    fn appointments_exclude_soft_deleted() {
        let conn = setup_test_db();
        handle_create_appointment(&make_create_cmd("a1", "p1", 1000), &conn).unwrap();
        conn.execute(
            "UPDATE appointments SET local_server_deleted_at = 9999 WHERE id = 'a1'",
            [],
        )
        .unwrap();

        let q = GetAppointmentQuery {
            id: "a1".to_string(),
        };
        let result = handle_get_appointment(&q, &conn).unwrap();
        assert!(result.is_null());
    }

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn create_n_then_list(n in 1u32..10) {
            let conn = setup_test_db();
            for i in 0..n {
                handle_create_appointment(
                    &make_create_cmd(&format!("a{i}"), "p1", 1000 + i as i64),
                    &conn,
                ).unwrap();
            }
            let query = ListAppointmentsQuery {
                start_date: 0, end_date: 99999,
                clinic_id: None, status: None,
                limit: 100, offset: 0,
            };
            let result = handle_list_appointments(&query, &conn).unwrap();
            prop_assert_eq!(result["total"].as_i64().unwrap(), n as i64);
        }

        #[test]
        fn patient_appointments_isolated(n_p1 in 0u32..8, n_p2 in 0u32..8) {
            let conn = setup_test_db();
            for i in 0..n_p1 {
                handle_create_appointment(
                    &make_create_cmd(&format!("p1a{i}"), "p1", 1000),
                    &conn,
                ).unwrap();
            }
            for i in 0..n_p2 {
                handle_create_appointment(
                    &make_create_cmd(&format!("p2a{i}"), "p2", 1000),
                    &conn,
                ).unwrap();
            }
            let q1 = GetPatientAppointmentsQuery { patient_id: "p1".into() };
            let q2 = GetPatientAppointmentsQuery { patient_id: "p2".into() };
            let r1 = handle_get_patient_appointments(&q1, &conn).unwrap();
            let r2 = handle_get_patient_appointments(&q2, &conn).unwrap();
            prop_assert_eq!(r1["data"].as_array().unwrap().len(), n_p1 as usize);
            prop_assert_eq!(r2["data"].as_array().unwrap().len(), n_p2 as usize);
        }

        /// Upsert is idempotent — re-inserting same appointment doesn't duplicate
        #[test]
        fn appointment_upsert_idempotent(repeats in 1u32..5) {
            let conn = setup_test_db();
            let cmd = make_create_cmd("idem_a", "p1", 1000);
            for _ in 0..repeats {
                handle_create_appointment(&cmd, &conn).unwrap();
            }
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM appointments WHERE id = 'idem_a'", [], |r| r.get(0))
                .unwrap();
            prop_assert_eq!(count, 1);
        }
    }
}
