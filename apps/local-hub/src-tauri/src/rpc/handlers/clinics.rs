// Clinic and clinic department domain: listing clinics and departments.

use rusqlite::Connection;
use serde::Deserialize;

use super::HandlerResult;

// ============================================================================
// Payloads
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ListClinicDepartmentsQuery {
    pub clinic_id: String,
}

// ============================================================================
// Handlers
// ============================================================================

/// Lists all active, non-archived clinics.
pub fn handle_list_clinics(conn: &Connection) -> HandlerResult {
    let mut stmt = conn.prepare(
        "SELECT id, name, address, attributes, metadata, created_at, updated_at
         FROM clinics
         WHERE is_deleted = 0 AND is_archived = 0 AND local_server_deleted_at IS NULL
         ORDER BY name ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, Option<String>>(1)?,
            "address": row.get::<_, Option<String>>(2)?,
            "attributes": row.get::<_, String>(3)?,
            "metadata": row.get::<_, String>(4)?,
            "created_at": row.get::<_, Option<i64>>(5)?,
            "updated_at": row.get::<_, Option<i64>>(6)?,
        }))
    })?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

/// Lists departments for a given clinic.
pub fn handle_list_clinic_departments(
    payload: &ListClinicDepartmentsQuery,
    conn: &Connection,
) -> HandlerResult {
    let mut stmt = conn.prepare(
        "SELECT id, clinic_id, name, code, description, status,
                can_dispense_medications, can_perform_labs, can_perform_imaging,
                additional_capabilities, metadata, created_at, updated_at
         FROM clinic_departments
         WHERE clinic_id = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL
         ORDER BY name ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![payload.clinic_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "clinic_id": row.get::<_, String>(1)?,
            "name": row.get::<_, String>(2)?,
            "code": row.get::<_, Option<String>>(3)?,
            "description": row.get::<_, Option<String>>(4)?,
            "status": row.get::<_, Option<String>>(5)?,
            "can_dispense_medications": row.get::<_, i64>(6)?,
            "can_perform_labs": row.get::<_, i64>(7)?,
            "can_perform_imaging": row.get::<_, i64>(8)?,
            "additional_capabilities": row.get::<_, Option<String>>(9)?,
            "metadata": row.get::<_, String>(10)?,
            "created_at": row.get::<_, Option<i64>>(11)?,
            "updated_at": row.get::<_, Option<i64>>(12)?,
        }))
    })?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    fn insert_clinic(conn: &Connection, id: &str, name: &str, is_archived: i64) {
        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted, is_archived, attributes, metadata,
                                  created_at, updated_at,
                                  local_server_created_at, local_server_last_modified_at)
             VALUES (?1, ?2, 0, ?3, '[]', '{}', 1000, 1000, 1000, 1000)",
            rusqlite::params![id, name, is_archived],
        )
        .unwrap();
    }

    fn insert_department(conn: &Connection, id: &str, clinic_id: &str, name: &str) {
        conn.execute(
            "INSERT INTO clinic_departments (id, clinic_id, name, metadata,
                                             is_deleted, created_at, updated_at,
                                             local_server_created_at, local_server_last_modified_at)
             VALUES (?1, ?2, ?3, '{}', 0, 1000, 1000, 1000, 1000)",
            rusqlite::params![id, clinic_id, name],
        )
        .unwrap();
    }

    #[test]
    fn list_clinics_returns_active_only() {
        let conn = setup_test_db();
        insert_clinic(&conn, "c1", "Active Clinic", 0);
        insert_clinic(&conn, "c2", "Archived Clinic", 1);

        let result = handle_list_clinics(&conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0]["id"], "c1");
    }

    #[test]
    fn list_clinics_empty() {
        let conn = setup_test_db();
        let result = handle_list_clinics(&conn).unwrap();
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    #[test]
    fn list_clinics_excludes_soft_deleted() {
        let conn = setup_test_db();
        insert_clinic(&conn, "c1", "Live", 0);
        insert_clinic(&conn, "c2", "Deleted", 0);
        conn.execute(
            "UPDATE clinics SET local_server_deleted_at = 9999 WHERE id = 'c2'",
            [],
        )
        .unwrap();

        let result = handle_list_clinics(&conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn list_clinics_sorted_by_name() {
        let conn = setup_test_db();
        insert_clinic(&conn, "c1", "Zebra Clinic", 0);
        insert_clinic(&conn, "c2", "Alpha Clinic", 0);

        let result = handle_list_clinics(&conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data[0]["name"], "Alpha Clinic");
        assert_eq!(data[1]["name"], "Zebra Clinic");
    }

    #[test]
    fn list_departments_for_clinic() {
        let conn = setup_test_db();
        insert_clinic(&conn, "c1", "Clinic 1", 0);
        insert_department(&conn, "d1", "c1", "Emergency");
        insert_department(&conn, "d2", "c1", "Pharmacy");
        insert_department(&conn, "d3", "c2", "Other Clinic Dept");

        let query = ListClinicDepartmentsQuery {
            clinic_id: "c1".to_string(),
        };
        let result = handle_list_clinic_departments(&query, &conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 2);
    }

    #[test]
    fn list_departments_excludes_soft_deleted() {
        let conn = setup_test_db();
        insert_clinic(&conn, "c1", "Clinic", 0);
        insert_department(&conn, "d1", "c1", "Live");
        insert_department(&conn, "d2", "c1", "Dead");
        conn.execute(
            "UPDATE clinic_departments SET local_server_deleted_at = 9999 WHERE id = 'd2'",
            [],
        )
        .unwrap();

        let query = ListClinicDepartmentsQuery {
            clinic_id: "c1".to_string(),
        };
        let result = handle_list_clinic_departments(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn list_departments_empty_for_unknown_clinic() {
        let conn = setup_test_db();
        let query = ListClinicDepartmentsQuery {
            clinic_id: "nonexistent".to_string(),
        };
        let result = handle_list_clinic_departments(&query, &conn).unwrap();
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn n_clinics_returned(n in 1u32..15) {
            let conn = setup_test_db();
            for i in 0..n {
                insert_clinic(&conn, &format!("c{i}"), &format!("Clinic {i}"), 0);
            }
            let result = handle_list_clinics(&conn).unwrap();
            prop_assert_eq!(result["data"].as_array().unwrap().len(), n as usize);
        }

        #[test]
        fn departments_isolated_per_clinic(n_c1 in 0u32..8, n_c2 in 0u32..8) {
            let conn = setup_test_db();
            insert_clinic(&conn, "c1", "C1", 0);
            insert_clinic(&conn, "c2", "C2", 0);
            for i in 0..n_c1 {
                insert_department(&conn, &format!("d1_{i}"), "c1", &format!("Dept {i}"));
            }
            for i in 0..n_c2 {
                insert_department(&conn, &format!("d2_{i}"), "c2", &format!("Dept {i}"));
            }
            let q1 = ListClinicDepartmentsQuery { clinic_id: "c1".into() };
            let q2 = ListClinicDepartmentsQuery { clinic_id: "c2".into() };
            let r1 = handle_list_clinic_departments(&q1, &conn).unwrap();
            let r2 = handle_list_clinic_departments(&q2, &conn).unwrap();
            prop_assert_eq!(r1["data"].as_array().unwrap().len(), n_c1 as usize);
            prop_assert_eq!(r2["data"].as_array().unwrap().len(), n_c2 as usize);
        }
    }
}
