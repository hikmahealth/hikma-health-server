// Visit, event, and vitals domain: CRUD for visits, events, and patient vitals.

use rusqlite::Connection;
use serde::Deserialize;

use super::serde_flexible::{flexible_opt_timestamp, flexible_timestamp, stringify_json};
use super::{now_millis, HandlerResult};

// ============================================================================
// Payloads
// ============================================================================

/// Create an event for a patient within a visit.
#[derive(Debug, Deserialize)]
pub struct CreateEventCommand {
    pub id: String,
    pub patient_id: String,
    pub form_id: String,
    pub visit_id: String,
    pub event_type: String,
    #[serde(deserialize_with = "stringify_json")]
    pub form_data: String, // JSON text
    #[serde(deserialize_with = "stringify_json")]
    pub metadata: String, // JSON text
    #[serde(deserialize_with = "flexible_timestamp")]
    pub created_at: i64,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub updated_at: i64,
    pub recorded_by_user_id: String,
}

/// Get visits for a given patient.
#[derive(Debug, Deserialize)]
pub struct GetVisitsQuery {
    pub patient_id: String,
}

/// Get events for a given patient + visit.
#[derive(Debug, Deserialize)]
pub struct GetVisitEventsQuery {
    pub patient_id: String,
    pub visit_id: String,
}

/// Update an existing visit.
#[derive(Debug, Deserialize)]
pub struct UpdateVisitCommand {
    pub id: String,
    pub provider_id: Option<String>,
    pub provider_name: Option<String>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub check_in_timestamp: Option<i64>,
    pub metadata: Option<String>,
    pub clinic_id: Option<String>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub updated_at: Option<i64>,
}

/// Update an existing vitals record.
#[derive(Debug, Deserialize)]
pub struct UpdateVitalsCommand {
    pub id: String,
    pub systolic_bp: Option<f64>,
    pub diastolic_bp: Option<f64>,
    pub bp_position: Option<String>,
    pub height_cm: Option<f64>,
    pub weight_kg: Option<f64>,
    pub bmi: Option<f64>,
    pub waist_circumference_cm: Option<f64>,
    pub heart_rate: Option<f64>,
    pub pulse_rate: Option<f64>,
    pub oxygen_saturation: Option<f64>,
    pub respiratory_rate: Option<f64>,
    pub temperature_celsius: Option<f64>,
    pub pain_level: Option<f64>,
    pub metadata: Option<String>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub updated_at: Option<i64>,
}

// ============================================================================
// Handlers
// ============================================================================

pub fn handle_create_event(payload: &CreateEventCommand, conn: &Connection) -> HandlerResult {
    let now = now_millis();

    conn.execute(
        r#"INSERT INTO events (
            id, patient_id, form_id, visit_id, event_type,
            form_data, metadata, is_deleted,
            created_at, updated_at, recorded_by_user_id,
            local_server_created_at, local_server_last_modified_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, 0,
            ?8, ?9, ?10,
            ?11, ?12
        )
        ON CONFLICT(id) DO UPDATE SET
            form_data = excluded.form_data,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at,
            local_server_last_modified_at = excluded.local_server_last_modified_at
        "#,
        rusqlite::params![
            payload.id,
            payload.patient_id,
            payload.form_id,
            payload.visit_id,
            payload.event_type,
            payload.form_data,
            payload.metadata,
            payload.created_at,
            payload.updated_at,
            payload.recorded_by_user_id,
            now,
            now,
        ],
    )?;

    Ok(serde_json::json!({ "event_id": payload.id }))
}

pub fn handle_get_visits(payload: &GetVisitsQuery, conn: &Connection) -> HandlerResult {
    let mut stmt = conn.prepare(
        "SELECT id, patient_id, clinic_id, provider_id, provider_name,
                check_in_timestamp, metadata, created_at, updated_at
         FROM visits
         WHERE patient_id = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL
         ORDER BY check_in_timestamp DESC",
    )?;

    let rows = stmt.query_map(rusqlite::params![payload.patient_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "patient_id": row.get::<_, String>(1)?,
            "clinic_id": row.get::<_, String>(2)?,
            "provider_id": row.get::<_, String>(3)?,
            "provider_name": row.get::<_, String>(4)?,
            "check_in_timestamp": row.get::<_, i64>(5)?,
            "metadata": row.get::<_, String>(6)?,
            "created_at": row.get::<_, i64>(7)?,
            "updated_at": row.get::<_, i64>(8)?,
        }))
    })?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

pub fn handle_get_visit_events(payload: &GetVisitEventsQuery, conn: &Connection) -> HandlerResult {
    let mut stmt = conn.prepare(
        "SELECT id, patient_id, form_id, visit_id, event_type,
                form_data, metadata, created_at, updated_at, recorded_by_user_id
         FROM events
         WHERE patient_id = ?1 AND visit_id = ?2
           AND is_deleted = 0 AND local_server_deleted_at IS NULL
         ORDER BY created_at DESC",
    )?;

    let rows = stmt.query_map(
        rusqlite::params![payload.patient_id, payload.visit_id],
        |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "patient_id": row.get::<_, String>(1)?,
                "form_id": row.get::<_, String>(2)?,
                "visit_id": row.get::<_, String>(3)?,
                "event_type": row.get::<_, String>(4)?,
                "form_data": row.get::<_, String>(5)?,
                "metadata": row.get::<_, String>(6)?,
                "created_at": row.get::<_, i64>(7)?,
                "updated_at": row.get::<_, i64>(8)?,
                "recorded_by_user_id": row.get::<_, String>(9)?,
            }))
        },
    )?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

/// Updates mutable fields on an existing visit.
pub fn handle_update_visit(payload: &UpdateVisitCommand, conn: &Connection) -> HandlerResult {
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
    set_if_some!(provider_name, "provider_name");
    set_if_some!(check_in_timestamp, "check_in_timestamp");
    set_if_some!(metadata, "metadata");
    set_if_some!(clinic_id, "clinic_id");

    let updated_at = payload.updated_at.unwrap_or(now);
    sets.push(format!("updated_at = ?{idx}"));
    params.push(Box::new(updated_at));
    idx += 1;

    params.push(Box::new(payload.id.clone()));

    let sql = format!(
        "UPDATE visits SET {} WHERE id = ?{idx} AND is_deleted = 0 AND local_server_deleted_at IS NULL",
        sets.join(", ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let changed = conn.execute(&sql, param_refs.as_slice())?;

    if changed == 0 {
        return Err(format!("Visit '{}' not found", payload.id).into());
    }

    // Return updated visit
    let row = conn.query_row(
        "SELECT id, patient_id, clinic_id, provider_id, provider_name,
                check_in_timestamp, metadata, created_at, updated_at
         FROM visits WHERE id = ?1",
        rusqlite::params![payload.id],
        |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "patient_id": row.get::<_, String>(1)?,
                "clinic_id": row.get::<_, String>(2)?,
                "provider_id": row.get::<_, String>(3)?,
                "provider_name": row.get::<_, String>(4)?,
                "check_in_timestamp": row.get::<_, i64>(5)?,
                "metadata": row.get::<_, String>(6)?,
                "created_at": row.get::<_, i64>(7)?,
                "updated_at": row.get::<_, i64>(8)?,
            }))
        },
    )?;
    Ok(row)
}

/// Updates mutable fields on an existing vitals record.
pub fn handle_update_vitals(payload: &UpdateVitalsCommand, conn: &Connection) -> HandlerResult {
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

    set_if_some!(systolic_bp, "systolic_bp");
    set_if_some!(diastolic_bp, "diastolic_bp");
    set_if_some!(bp_position, "bp_position");
    set_if_some!(height_cm, "height_cm");
    set_if_some!(weight_kg, "weight_kg");
    set_if_some!(bmi, "bmi");
    set_if_some!(waist_circumference_cm, "waist_circumference_cm");
    set_if_some!(heart_rate, "heart_rate");
    set_if_some!(pulse_rate, "pulse_rate");
    set_if_some!(oxygen_saturation, "oxygen_saturation");
    set_if_some!(respiratory_rate, "respiratory_rate");
    set_if_some!(temperature_celsius, "temperature_celsius");
    set_if_some!(pain_level, "pain_level");
    set_if_some!(metadata, "metadata");

    let updated_at = payload.updated_at.unwrap_or(now);
    sets.push(format!("updated_at = ?{idx}"));
    params.push(Box::new(updated_at));
    idx += 1;

    params.push(Box::new(payload.id.clone()));

    let sql = format!(
        "UPDATE patient_vitals SET {} WHERE id = ?{idx} AND is_deleted = 0 AND local_server_deleted_at IS NULL",
        sets.join(", ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let changed = conn.execute(&sql, param_refs.as_slice())?;

    if changed == 0 {
        return Err(format!("Vitals record '{}' not found", payload.id).into());
    }

    Ok(serde_json::json!({ "ok": true, "id": payload.id }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;
    use rusqlite::Connection;

    fn insert_test_patient(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO patients (
                id, given_name, surname, date_of_birth, citizenship, hometown,
                phone, sex, additional_data, metadata, is_deleted,
                government_id, external_patient_id,
                created_at, updated_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, 'Test', 'Patient', '1990-01-01', 'X', 'Town',
                      '555', 'M', '{}', '{}', 0,
                      'GOV', 'EXT',
                      1000, 2000, 1000, 2000)",
            rusqlite::params![id],
        )
        .unwrap();
    }

    fn insert_test_visit(conn: &Connection, id: &str, patient_id: &str) {
        conn.execute(
            "INSERT INTO visits (
                id, patient_id, clinic_id, provider_id, provider_name,
                check_in_timestamp, metadata, is_deleted,
                created_at, updated_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, ?2, 'clinic1', 'prov1', 'Dr Test',
                      1000, '{}', 0,
                      1000, 2000, 1000, 2000)",
            rusqlite::params![id, patient_id],
        )
        .unwrap();
    }

    fn make_test_event(id: &str, patient_id: &str, visit_id: &str) -> CreateEventCommand {
        CreateEventCommand {
            id: id.to_string(),
            patient_id: patient_id.to_string(),
            form_id: "form1".to_string(),
            visit_id: visit_id.to_string(),
            event_type: "vitals".to_string(),
            form_data: r#"{"bp":"120/80"}"#.to_string(),
            metadata: "{}".to_string(),
            created_at: 1000,
            updated_at: 2000,
            recorded_by_user_id: "user1".to_string(),
        }
    }

    #[test]
    fn create_event_inserts() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_visit(&conn, "v1", "p1");

        let cmd = make_test_event("e1", "p1", "v1");
        let result = handle_create_event(&cmd, &conn).unwrap();
        assert_eq!(result["event_id"], "e1");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM events WHERE id = 'e1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn create_event_upsert_updates() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_visit(&conn, "v1", "p1");

        let cmd = make_test_event("e2", "p1", "v1");
        handle_create_event(&cmd, &conn).unwrap();

        // Update form_data via upsert
        let mut cmd2 = make_test_event("e2", "p1", "v1");
        cmd2.form_data = r#"{"bp":"130/85"}"#.to_string();
        cmd2.updated_at = 3000;
        handle_create_event(&cmd2, &conn).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM events WHERE id = 'e2'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);

        let form_data: String = conn
            .query_row("SELECT form_data FROM events WHERE id = 'e2'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert!(form_data.contains("130/85"));
    }

    #[test]
    fn get_visits_for_patient() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_visit(&conn, "v1", "p1");
        insert_test_visit(&conn, "v2", "p1");

        let query = GetVisitsQuery {
            patient_id: "p1".to_string(),
        };
        let result = handle_get_visits(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn get_visits_excludes_other_patients() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_patient(&conn, "p2");
        insert_test_visit(&conn, "v1", "p1");
        insert_test_visit(&conn, "v2", "p2");

        let query = GetVisitsQuery {
            patient_id: "p1".to_string(),
        };
        let result = handle_get_visits(&query, &conn).unwrap();
        let visits = result["data"].as_array().unwrap();
        assert_eq!(visits.len(), 1);
        assert_eq!(visits[0]["id"], "v1");
    }

    #[test]
    fn get_visits_empty() {
        let conn = setup_test_db();
        let query = GetVisitsQuery {
            patient_id: "nonexistent".to_string(),
        };
        let result = handle_get_visits(&query, &conn).unwrap();
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    #[test]
    fn get_visit_events_correct() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_visit(&conn, "v1", "p1");

        let cmd1 = make_test_event("e1", "p1", "v1");
        let cmd2 = make_test_event("e2", "p1", "v1");
        handle_create_event(&cmd1, &conn).unwrap();
        handle_create_event(&cmd2, &conn).unwrap();

        let query = GetVisitEventsQuery {
            patient_id: "p1".to_string(),
            visit_id: "v1".to_string(),
        };
        let result = handle_get_visit_events(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn get_visit_events_excludes_soft_deleted() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_visit(&conn, "v1", "p1");

        let cmd = make_test_event("e_del", "p1", "v1");
        handle_create_event(&cmd, &conn).unwrap();

        // Soft-delete the event
        conn.execute(
            "UPDATE events SET local_server_deleted_at = 9999 WHERE id = 'e_del'",
            [],
        )
        .unwrap();

        let query = GetVisitEventsQuery {
            patient_id: "p1".to_string(),
            visit_id: "v1".to_string(),
        };
        let result = handle_get_visit_events(&query, &conn).unwrap();
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    #[test]
    fn get_visits_excludes_soft_deleted() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_visit(&conn, "v1", "p1");
        insert_test_visit(&conn, "v2", "p1");

        // Soft-delete one visit
        conn.execute(
            "UPDATE visits SET local_server_deleted_at = 9999 WHERE id = 'v1'",
            [],
        )
        .unwrap();

        let query = GetVisitsQuery {
            patient_id: "p1".to_string(),
        };
        let result = handle_get_visits(&query, &conn).unwrap();
        let visits = result["data"].as_array().unwrap();
        assert_eq!(visits.len(), 1);
        assert_eq!(visits[0]["id"], "v2");
    }

    #[test]
    fn get_visits_excludes_is_deleted_flag() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_visit(&conn, "v1", "p1");

        // Mark as deleted via the is_deleted flag
        conn.execute("UPDATE visits SET is_deleted = 1 WHERE id = 'v1'", [])
            .unwrap();

        let query = GetVisitsQuery {
            patient_id: "p1".to_string(),
        };
        let result = handle_get_visits(&query, &conn).unwrap();
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    #[test]
    fn create_event_preserves_all_fields() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_visit(&conn, "v1", "p1");

        let cmd = CreateEventCommand {
            id: "ef1".to_string(),
            patient_id: "p1".to_string(),
            form_id: "form_abc".to_string(),
            visit_id: "v1".to_string(),
            event_type: "lab_result".to_string(),
            form_data: r#"{"result":"positive"}"#.to_string(),
            metadata: r#"{"source":"mobile"}"#.to_string(),
            created_at: 5000,
            updated_at: 6000,
            recorded_by_user_id: "doc42".to_string(),
        };
        handle_create_event(&cmd, &conn).unwrap();

        let (form_id, event_type, form_data, recorded_by): (String, String, String, String) = conn
            .query_row(
                "SELECT form_id, event_type, form_data, recorded_by_user_id FROM events WHERE id = 'ef1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();
        assert_eq!(form_id, "form_abc");
        assert_eq!(event_type, "lab_result");
        assert!(form_data.contains("positive"));
        assert_eq!(recorded_by, "doc42");
    }

    // ========================================================================
    // Property-based tests
    // ========================================================================

    // ========================================================================
    // Visit update tests
    // ========================================================================

    #[test]
    fn update_visit_changes_fields() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_visit(&conn, "v1", "p1");

        let cmd = UpdateVisitCommand {
            id: "v1".to_string(),
            provider_id: Some("new_prov".to_string()),
            provider_name: Some("Dr. New".to_string()),
            check_in_timestamp: None,
            metadata: None,
            clinic_id: None,
            updated_at: None,
        };
        let result = handle_update_visit(&cmd, &conn).unwrap();
        assert_eq!(result["provider_id"], "new_prov");
        assert_eq!(result["provider_name"], "Dr. New");
    }

    #[test]
    fn update_visit_not_found() {
        let conn = setup_test_db();
        let cmd = UpdateVisitCommand {
            id: "ghost".to_string(),
            provider_id: None,
            provider_name: None,
            check_in_timestamp: None,
            metadata: None,
            clinic_id: None,
            updated_at: None,
        };
        assert!(handle_update_visit(&cmd, &conn).is_err());
    }

    // ========================================================================
    // Vitals update tests
    // ========================================================================

    fn insert_test_vitals(conn: &Connection, id: &str, patient_id: &str) {
        conn.execute(
            "INSERT INTO patient_vitals (
                id, patient_id, timestamp, metadata, is_deleted,
                created_at, updated_at, last_modified, server_created_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, ?2, 1000, '{}', 0,
                      1000, 1000, 1000, 1000, 1000, 1000)",
            rusqlite::params![id, patient_id],
        )
        .unwrap();
    }

    #[test]
    fn update_vitals_changes_fields() {
        let conn = setup_test_db();
        insert_test_patient(&conn, "p1");
        insert_test_vitals(&conn, "vit1", "p1");

        let cmd = UpdateVitalsCommand {
            id: "vit1".to_string(),
            systolic_bp: Some(120.0),
            diastolic_bp: Some(80.0),
            bp_position: Some("sitting".to_string()),
            height_cm: None,
            weight_kg: Some(75.5),
            bmi: None,
            waist_circumference_cm: None,
            heart_rate: None,
            pulse_rate: None,
            oxygen_saturation: None,
            respiratory_rate: None,
            temperature_celsius: None,
            pain_level: None,
            metadata: None,
            updated_at: None,
        };
        let result = handle_update_vitals(&cmd, &conn).unwrap();
        assert_eq!(result["ok"], true);

        // Verify values in DB
        let bp: f64 = conn
            .query_row(
                "SELECT systolic_bp FROM patient_vitals WHERE id = 'vit1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!((bp - 120.0).abs() < f64::EPSILON);
    }

    #[test]
    fn update_vitals_not_found() {
        let conn = setup_test_db();
        let cmd = UpdateVitalsCommand {
            id: "ghost".to_string(),
            systolic_bp: Some(120.0),
            diastolic_bp: None,
            bp_position: None,
            height_cm: None,
            weight_kg: None,
            bmi: None,
            waist_circumference_cm: None,
            heart_rate: None,
            pulse_rate: None,
            oxygen_saturation: None,
            respiratory_rate: None,
            temperature_celsius: None,
            pain_level: None,
            metadata: None,
            updated_at: None,
        };
        assert!(handle_update_vitals(&cmd, &conn).is_err());
    }

    use proptest::prelude::*;

    proptest! {
        /// Property: creating N events for a visit results in exactly N retrievable events
        #[test]
        fn create_n_events_then_retrieve(n in 1u32..15) {
            let conn = setup_test_db();
            insert_test_patient(&conn, "pp1");
            insert_test_visit(&conn, "pv1", "pp1");

            for i in 0..n {
                let cmd = make_test_event(&format!("pe{}", i), "pp1", "pv1");
                handle_create_event(&cmd, &conn).unwrap();
            }

            let query = GetVisitEventsQuery {
                patient_id: "pp1".to_string(),
                visit_id: "pv1".to_string(),
            };
            let result = handle_get_visit_events(&query, &conn).unwrap();
            prop_assert_eq!(result["data"].as_array().unwrap().len(), n as usize);
        }

        /// Property: events for different visits are isolated
        #[test]
        fn events_isolated_per_visit(
            n_v1 in 0u32..10,
            n_v2 in 0u32..10,
        ) {
            let conn = setup_test_db();
            insert_test_patient(&conn, "iso_p");
            insert_test_visit(&conn, "iso_v1", "iso_p");
            insert_test_visit(&conn, "iso_v2", "iso_p");

            for i in 0..n_v1 {
                let cmd = make_test_event(&format!("v1e{}", i), "iso_p", "iso_v1");
                handle_create_event(&cmd, &conn).unwrap();
            }
            for i in 0..n_v2 {
                let cmd = make_test_event(&format!("v2e{}", i), "iso_p", "iso_v2");
                handle_create_event(&cmd, &conn).unwrap();
            }

            let q1 = GetVisitEventsQuery {
                patient_id: "iso_p".to_string(),
                visit_id: "iso_v1".to_string(),
            };
            let q2 = GetVisitEventsQuery {
                patient_id: "iso_p".to_string(),
                visit_id: "iso_v2".to_string(),
            };
            let r1 = handle_get_visit_events(&q1, &conn).unwrap();
            let r2 = handle_get_visit_events(&q2, &conn).unwrap();
            prop_assert_eq!(r1["data"].as_array().unwrap().len(), n_v1 as usize);
            prop_assert_eq!(r2["data"].as_array().unwrap().len(), n_v2 as usize);
        }

        /// Property: creating N visits for a patient results in exactly N retrievable visits
        #[test]
        fn create_n_visits_then_retrieve(n in 1u32..15) {
            let conn = setup_test_db();
            insert_test_patient(&conn, "pvp");

            for i in 0..n {
                insert_test_visit(&conn, &format!("pvv{}", i), "pvp");
            }

            let query = GetVisitsQuery {
                patient_id: "pvp".to_string(),
            };
            let result = handle_get_visits(&query, &conn).unwrap();
            prop_assert_eq!(result["data"].as_array().unwrap().len(), n as usize);
        }

        /// Property: upsert is idempotent — re-inserting same event doesn't duplicate
        #[test]
        fn event_upsert_idempotent(repeats in 1u32..5) {
            let conn = setup_test_db();
            insert_test_patient(&conn, "idem_p");
            insert_test_visit(&conn, "idem_v", "idem_p");

            let cmd = make_test_event("idem_e", "idem_p", "idem_v");
            for _ in 0..repeats {
                handle_create_event(&cmd, &conn).unwrap();
            }

            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM events WHERE id = 'idem_e'", [], |r| r.get(0))
                .unwrap();
            prop_assert_eq!(count, 1);
        }
    }
}
