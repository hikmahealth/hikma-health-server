// Dispensing records domain: query by patient, create record.

use rusqlite::Connection;
use serde::Deserialize;

use super::serde_flexible::flexible_timestamp;
use super::{now_millis, HandlerResult};

// ============================================================================
// Payloads
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct DispensingByPatientQuery {
    pub patient_id: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateDispensingCommand {
    pub id: Option<String>,
    pub clinic_id: String,
    pub drug_id: String,
    pub batch_id: Option<String>,
    pub prescription_item_id: Option<String>,
    pub patient_id: String,
    pub quantity_dispensed: i64,
    pub dosage_instructions: Option<String>,
    pub days_supply: Option<i64>,
    pub dispensed_by: String,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub dispensed_at: i64,
    #[serde(default, deserialize_with = "stringify_json_opt")]
    pub metadata: Option<String>,
    #[serde(default, deserialize_with = "crate::rpc::handlers::serde_flexible::flexible_opt_timestamp")]
    pub created_at: Option<i64>,
    #[serde(default, deserialize_with = "crate::rpc::handlers::serde_flexible::flexible_opt_timestamp")]
    pub updated_at: Option<i64>,
}

/// Like stringify_json but returns Option<String>, defaulting to "{}".
fn stringify_json_opt<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::Deserialize;
    let val = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(Some(match val {
        Some(serde_json::Value::String(s)) => s,
        Some(other) => other.to_string(),
        None => "{}".to_string(),
    }))
}

// ============================================================================
// Handlers
// ============================================================================

pub fn handle_dispensing_by_patient(
    payload: &DispensingByPatientQuery,
    conn: &Connection,
) -> HandlerResult {
    let mut stmt = conn.prepare(
        "SELECT id, clinic_id, drug_id, batch_id, prescription_item_id,
                patient_id, quantity_dispensed, dosage_instructions, days_supply,
                dispensed_by, dispensed_at, metadata, created_at, updated_at
         FROM dispensing_records
         WHERE patient_id = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL
         ORDER BY dispensed_at DESC",
    )?;

    let rows = stmt.query_map(rusqlite::params![payload.patient_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "clinic_id": row.get::<_, String>(1)?,
            "drug_id": row.get::<_, String>(2)?,
            "batch_id": row.get::<_, Option<String>>(3)?,
            "prescription_item_id": row.get::<_, Option<String>>(4)?,
            "patient_id": row.get::<_, String>(5)?,
            "quantity_dispensed": row.get::<_, i64>(6)?,
            "dosage_instructions": row.get::<_, Option<String>>(7)?,
            "days_supply": row.get::<_, Option<i64>>(8)?,
            "dispensed_by": row.get::<_, String>(9)?,
            "dispensed_at": row.get::<_, i64>(10)?,
            "metadata": row.get::<_, String>(11)?,
            "created_at": row.get::<_, i64>(12)?,
            "updated_at": row.get::<_, i64>(13)?,
        }))
    })?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

pub fn handle_create_dispensing(
    payload: &CreateDispensingCommand,
    conn: &Connection,
) -> HandlerResult {
    let now = now_millis();
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::now_v7().to_string());
    let metadata = payload.metadata.as_deref().unwrap_or("{}");
    let created_at = payload.created_at.unwrap_or(now);
    let updated_at = payload.updated_at.unwrap_or(now);

    conn.execute(
        "INSERT INTO dispensing_records (
            id, clinic_id, drug_id, batch_id, prescription_item_id,
            patient_id, quantity_dispensed, dosage_instructions, days_supply,
            dispensed_by, dispensed_at, metadata, is_deleted,
            created_at, updated_at, last_modified, server_created_at,
            local_server_created_at, local_server_last_modified_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, ?8, ?9,
            ?10, ?11, ?12, 0,
            ?13, ?14, ?15, ?16,
            ?17, ?18
        )
        ON CONFLICT(id) DO UPDATE SET
            quantity_dispensed = excluded.quantity_dispensed,
            dosage_instructions = excluded.dosage_instructions,
            days_supply = excluded.days_supply,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at,
            local_server_last_modified_at = excluded.local_server_last_modified_at",
        rusqlite::params![
            id,
            payload.clinic_id,
            payload.drug_id,
            payload.batch_id,
            payload.prescription_item_id,
            payload.patient_id,
            payload.quantity_dispensed,
            payload.dosage_instructions,
            payload.days_supply,
            payload.dispensed_by,
            payload.dispensed_at,
            metadata,
            created_at,
            updated_at,
            now,
            now,
            now,
            now,
        ],
    )?;

    Ok(serde_json::json!({ "id": id }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    fn make_create_cmd(id: &str, patient_id: &str) -> CreateDispensingCommand {
        CreateDispensingCommand {
            id: Some(id.to_string()),
            clinic_id: "c1".to_string(),
            drug_id: "d1".to_string(),
            batch_id: Some("b1".to_string()),
            prescription_item_id: None,
            patient_id: patient_id.to_string(),
            quantity_dispensed: 10,
            dosage_instructions: Some("Take 2 daily".to_string()),
            days_supply: Some(5),
            dispensed_by: "u1".to_string(),
            dispensed_at: 1000,
            metadata: Some("{}".to_string()),
            created_at: Some(1000),
            updated_at: Some(1000),
        }
    }

    #[test]
    fn create_and_query_dispensing() {
        let conn = setup_test_db();
        let cmd = make_create_cmd("disp1", "p1");
        let result = handle_create_dispensing(&cmd, &conn).unwrap();
        assert_eq!(result["id"], "disp1");

        let query = DispensingByPatientQuery {
            patient_id: "p1".to_string(),
        };
        let result = handle_dispensing_by_patient(&query, &conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0]["quantity_dispensed"], 10);
    }

    #[test]
    fn dispensing_by_patient_excludes_other_patients() {
        let conn = setup_test_db();
        handle_create_dispensing(&make_create_cmd("d1", "p1"), &conn).unwrap();
        handle_create_dispensing(&make_create_cmd("d2", "p2"), &conn).unwrap();

        let query = DispensingByPatientQuery {
            patient_id: "p1".to_string(),
        };
        let result = handle_dispensing_by_patient(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn dispensing_by_patient_empty() {
        let conn = setup_test_db();
        let query = DispensingByPatientQuery {
            patient_id: "nobody".to_string(),
        };
        let result = handle_dispensing_by_patient(&query, &conn).unwrap();
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    #[test]
    fn dispensing_excludes_soft_deleted() {
        let conn = setup_test_db();
        handle_create_dispensing(&make_create_cmd("d1", "p1"), &conn).unwrap();
        conn.execute(
            "UPDATE dispensing_records SET local_server_deleted_at = 9999 WHERE id = 'd1'",
            [],
        )
        .unwrap();

        let query = DispensingByPatientQuery {
            patient_id: "p1".to_string(),
        };
        let result = handle_dispensing_by_patient(&query, &conn).unwrap();
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    #[test]
    fn create_dispensing_generates_id_when_missing() {
        let conn = setup_test_db();
        let mut cmd = make_create_cmd("_unused", "p1");
        cmd.id = None;
        let result = handle_create_dispensing(&cmd, &conn).unwrap();
        assert!(result["id"].as_str().unwrap().len() > 10);
    }

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn n_dispensing_records_for_patient(n in 1u32..10) {
            let conn = setup_test_db();
            for i in 0..n {
                handle_create_dispensing(
                    &make_create_cmd(&format!("d{i}"), "p1"),
                    &conn,
                ).unwrap();
            }
            let query = DispensingByPatientQuery { patient_id: "p1".into() };
            let result = handle_dispensing_by_patient(&query, &conn).unwrap();
            prop_assert_eq!(result["data"].as_array().unwrap().len(), n as usize);
        }
    }
}
