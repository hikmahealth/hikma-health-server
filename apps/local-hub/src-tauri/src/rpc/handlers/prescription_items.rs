// Prescription items domain: by_prescription, by_patient, create, update, dispense.

use rusqlite::Connection;
use serde::Deserialize;

use super::serde_flexible::{flexible_opt_timestamp, flexible_timestamp};
use super::{now_millis, HandlerResult};

// ============================================================================
// Payloads
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ItemsByPrescriptionQuery {
    pub prescription_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ItemsByPatientQuery {
    pub patient_id: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePrescriptionItemCommand {
    pub id: Option<String>,
    pub prescription_id: String,
    pub patient_id: String,
    pub drug_id: String,
    pub clinic_id: String,
    pub dosage_instructions: String,
    pub quantity_prescribed: i64,
    pub quantity_dispensed: Option<i64>,
    pub refills_authorized: Option<i64>,
    pub refills_used: Option<i64>,
    pub item_status: Option<String>,
    pub notes: Option<String>,
    #[serde(default, deserialize_with = "stringify_json_opt")]
    pub metadata: Option<String>,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub created_at: i64,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrescriptionItemCommand {
    pub id: String,
    pub dosage_instructions: Option<String>,
    pub quantity_prescribed: Option<i64>,
    pub quantity_dispensed: Option<i64>,
    pub refills_authorized: Option<i64>,
    pub refills_used: Option<i64>,
    pub item_status: Option<String>,
    pub notes: Option<String>,
    pub metadata: Option<String>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct DispensePrescriptionItemCommand {
    pub id: String,
    pub provider_id: String,
    /// Map of batch_id → quantity dispensed from that batch.
    pub batch_quantities: std::collections::HashMap<String, i64>,
}

// ============================================================================
// Shared
// ============================================================================

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

const ITEM_COLUMNS: &str =
    "id, prescription_id, patient_id, drug_id, clinic_id,
     dosage_instructions, quantity_prescribed, quantity_dispensed,
     refills_authorized, refills_used, item_status, notes, metadata,
     created_at, updated_at";

const NOT_DELETED: &str = "is_deleted = 0 AND local_server_deleted_at IS NULL";

fn row_to_item_json(row: &rusqlite::Row) -> rusqlite::Result<serde_json::Value> {
    Ok(serde_json::json!({
        "id": row.get::<_, String>(0)?,
        "prescription_id": row.get::<_, String>(1)?,
        "patient_id": row.get::<_, String>(2)?,
        "drug_id": row.get::<_, String>(3)?,
        "clinic_id": row.get::<_, String>(4)?,
        "dosage_instructions": row.get::<_, String>(5)?,
        "quantity_prescribed": row.get::<_, i64>(6)?,
        "quantity_dispensed": row.get::<_, Option<i64>>(7)?,
        "refills_authorized": row.get::<_, Option<i64>>(8)?,
        "refills_used": row.get::<_, Option<i64>>(9)?,
        "item_status": row.get::<_, Option<String>>(10)?,
        "notes": row.get::<_, Option<String>>(11)?,
        "metadata": row.get::<_, String>(12)?,
        "created_at": row.get::<_, i64>(13)?,
        "updated_at": row.get::<_, i64>(14)?,
    }))
}

fn get_item_by_id(
    id: &str,
    conn: &Connection,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let sql = format!(
        "SELECT {ITEM_COLUMNS} FROM prescription_items WHERE id = ?1 AND {NOT_DELETED}"
    );
    match conn.query_row(&sql, rusqlite::params![id], row_to_item_json) {
        Ok(item) => Ok(item),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(serde_json::json!(null)),
        Err(e) => Err(e.into()),
    }
}

// ============================================================================
// Handlers
// ============================================================================

pub fn handle_items_by_prescription(
    payload: &ItemsByPrescriptionQuery,
    conn: &Connection,
) -> HandlerResult {
    let sql = format!(
        "SELECT {ITEM_COLUMNS} FROM prescription_items
         WHERE prescription_id = ?1 AND {NOT_DELETED}
         ORDER BY created_at ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params![payload.prescription_id],
        row_to_item_json,
    )?;
    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

pub fn handle_items_by_patient(
    payload: &ItemsByPatientQuery,
    conn: &Connection,
) -> HandlerResult {
    let sql = format!(
        "SELECT {ITEM_COLUMNS} FROM prescription_items
         WHERE patient_id = ?1 AND {NOT_DELETED}
         ORDER BY created_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![payload.patient_id], row_to_item_json)?;
    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

pub fn handle_create_prescription_item(
    payload: &CreatePrescriptionItemCommand,
    conn: &Connection,
) -> HandlerResult {
    let now = now_millis();
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::now_v7().to_string());
    let metadata = payload.metadata.as_deref().unwrap_or("{}");

    conn.execute(
        r#"INSERT INTO prescription_items (
            id, prescription_id, patient_id, drug_id, clinic_id,
            dosage_instructions, quantity_prescribed, quantity_dispensed,
            refills_authorized, refills_used, item_status, notes, metadata,
            is_deleted, created_at, updated_at, last_modified, server_created_at,
            local_server_created_at, local_server_last_modified_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, ?8,
            ?9, ?10, ?11, ?12, ?13,
            0, ?14, ?15, ?16, ?17,
            ?18, ?19
        )
        ON CONFLICT(id) DO UPDATE SET
            dosage_instructions = excluded.dosage_instructions,
            quantity_prescribed = excluded.quantity_prescribed,
            quantity_dispensed = excluded.quantity_dispensed,
            refills_authorized = excluded.refills_authorized,
            refills_used = excluded.refills_used,
            item_status = excluded.item_status,
            notes = excluded.notes,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at,
            local_server_last_modified_at = excluded.local_server_last_modified_at
        "#,
        rusqlite::params![
            id,
            payload.prescription_id,
            payload.patient_id,
            payload.drug_id,
            payload.clinic_id,
            payload.dosage_instructions,
            payload.quantity_prescribed,
            payload.quantity_dispensed.unwrap_or(0),
            payload.refills_authorized.unwrap_or(0),
            payload.refills_used.unwrap_or(0),
            payload.item_status.as_deref().unwrap_or("active"),
            payload.notes,
            metadata,
            payload.created_at,
            payload.updated_at,
            now,
            now,
            now,
            now,
        ],
    )?;

    Ok(serde_json::json!({ "id": id }))
}

pub fn handle_update_prescription_item(
    payload: &UpdatePrescriptionItemCommand,
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

    set_if_some!(dosage_instructions, "dosage_instructions");
    set_if_some!(quantity_prescribed, "quantity_prescribed");
    set_if_some!(quantity_dispensed, "quantity_dispensed");
    set_if_some!(refills_authorized, "refills_authorized");
    set_if_some!(refills_used, "refills_used");
    set_if_some!(item_status, "item_status");
    set_if_some!(notes, "notes");
    set_if_some!(metadata, "metadata");

    let updated_at = payload.updated_at.unwrap_or(now);
    sets.push(format!("updated_at = ?{idx}"));
    params.push(Box::new(updated_at));
    idx += 1;

    params.push(Box::new(payload.id.clone()));

    let sql = format!(
        "UPDATE prescription_items SET {} WHERE id = ?{idx} AND {NOT_DELETED}",
        sets.join(", ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let changed = conn.execute(&sql, param_refs.as_slice())?;

    if changed == 0 {
        return Err(format!("Prescription item '{}' not found", payload.id).into());
    }
    get_item_by_id(&payload.id, conn)
}

/// Dispenses a prescription item by recording dispensing from one or more batches.
/// Increments quantity_dispensed on the item and creates dispensing_records.
pub fn handle_dispense_prescription_item(
    payload: &DispensePrescriptionItemCommand,
    conn: &Connection,
) -> HandlerResult {
    let now = now_millis();
    let total_qty: i64 = payload.batch_quantities.values().sum();

    // Load item to get drug_id, clinic_id, patient_id
    let (drug_id, clinic_id, patient_id, dosage, current_dispensed): (
        String,
        String,
        String,
        String,
        i64,
    ) = conn
        .query_row(
            &format!(
                "SELECT drug_id, clinic_id, patient_id, dosage_instructions,
                 COALESCE(quantity_dispensed, 0)
                 FROM prescription_items WHERE id = ?1 AND {NOT_DELETED}"
            ),
            rusqlite::params![payload.id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                format!("Prescription item '{}' not found", payload.id)
            }
            other => other.to_string(),
        })?;

    conn.execute_batch("BEGIN")?;

    let result = (|| -> HandlerResult {
        // Update quantity_dispensed on the item
        conn.execute(
            &format!(
                "UPDATE prescription_items SET quantity_dispensed = ?1, updated_at = ?2,
                 local_server_last_modified_at = ?3
                 WHERE id = ?4 AND {NOT_DELETED}"
            ),
            rusqlite::params![current_dispensed + total_qty, now, now, payload.id],
        )?;

        // Create a dispensing record for each batch
        for (batch_id, qty) in &payload.batch_quantities {
            let disp_id = uuid::Uuid::now_v7().to_string();
            conn.execute(
                "INSERT INTO dispensing_records (
                    id, clinic_id, drug_id, batch_id, prescription_item_id,
                    patient_id, quantity_dispensed, dosage_instructions, days_supply,
                    dispensed_by, dispensed_at, metadata, is_deleted,
                    created_at, updated_at, last_modified, server_created_at,
                    local_server_created_at, local_server_last_modified_at
                ) VALUES (
                    ?1, ?2, ?3, ?4, ?5,
                    ?6, ?7, ?8, NULL,
                    ?9, ?10, '{}', 0,
                    ?11, ?12, ?13, ?14,
                    ?15, ?16
                )",
                rusqlite::params![
                    disp_id, clinic_id, drug_id, batch_id, payload.id,
                    patient_id, qty, dosage,
                    payload.provider_id, now,
                    now, now, now, now,
                    now, now,
                ],
            )?;
        }

        Ok(serde_json::json!({
            "ok": true,
            "total_dispensed": current_dispensed + total_qty,
        }))
    })();

    match &result {
        Ok(_) => conn.execute_batch("COMMIT")?,
        Err(_) => conn.execute_batch("ROLLBACK")?,
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    fn make_create_cmd(id: &str, rx_id: &str, patient_id: &str) -> CreatePrescriptionItemCommand {
        CreatePrescriptionItemCommand {
            id: Some(id.to_string()),
            prescription_id: rx_id.to_string(),
            patient_id: patient_id.to_string(),
            drug_id: "d1".to_string(),
            clinic_id: "c1".to_string(),
            dosage_instructions: "1 tab daily".to_string(),
            quantity_prescribed: 30,
            quantity_dispensed: Some(0),
            refills_authorized: Some(2),
            refills_used: Some(0),
            item_status: Some("active".to_string()),
            notes: None,
            metadata: Some("{}".to_string()),
            created_at: 1000,
            updated_at: 1000,
        }
    }

    #[test]
    fn create_and_get_by_prescription() {
        let conn = setup_test_db();
        handle_create_prescription_item(&make_create_cmd("pi1", "rx1", "p1"), &conn).unwrap();
        handle_create_prescription_item(&make_create_cmd("pi2", "rx1", "p1"), &conn).unwrap();
        handle_create_prescription_item(&make_create_cmd("pi3", "rx2", "p1"), &conn).unwrap();

        let query = ItemsByPrescriptionQuery {
            prescription_id: "rx1".to_string(),
        };
        let result = handle_items_by_prescription(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn get_by_patient() {
        let conn = setup_test_db();
        handle_create_prescription_item(&make_create_cmd("pi1", "rx1", "p1"), &conn).unwrap();
        handle_create_prescription_item(&make_create_cmd("pi2", "rx1", "p2"), &conn).unwrap();

        let query = ItemsByPatientQuery {
            patient_id: "p1".to_string(),
        };
        let result = handle_items_by_patient(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn update_item() {
        let conn = setup_test_db();
        handle_create_prescription_item(&make_create_cmd("pi1", "rx1", "p1"), &conn).unwrap();

        let update = UpdatePrescriptionItemCommand {
            id: "pi1".to_string(),
            dosage_instructions: Some("2 tabs daily".to_string()),
            quantity_prescribed: Some(60),
            quantity_dispensed: None,
            refills_authorized: None,
            refills_used: None,
            item_status: None,
            notes: None,
            metadata: None,
            updated_at: None,
        };
        let result = handle_update_prescription_item(&update, &conn).unwrap();
        assert_eq!(result["dosage_instructions"], "2 tabs daily");
        assert_eq!(result["quantity_prescribed"], 60);
    }

    #[test]
    fn dispense_item() {
        let conn = setup_test_db();
        handle_create_prescription_item(&make_create_cmd("pi1", "rx1", "p1"), &conn).unwrap();

        let mut batches = std::collections::HashMap::new();
        batches.insert("batch_a".to_string(), 10);
        batches.insert("batch_b".to_string(), 5);

        let cmd = DispensePrescriptionItemCommand {
            id: "pi1".to_string(),
            provider_id: "pharm1".to_string(),
            batch_quantities: batches,
        };
        let result = handle_dispense_prescription_item(&cmd, &conn).unwrap();
        assert_eq!(result["total_dispensed"], 15);

        // Check dispensing records were created
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM dispensing_records WHERE prescription_item_id = 'pi1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);

        // Check quantity_dispensed was updated on the item
        let item = get_item_by_id("pi1", &conn).unwrap();
        assert_eq!(item["quantity_dispensed"], 15);
    }

    #[test]
    fn dispense_nonexistent_fails() {
        let conn = setup_test_db();
        let cmd = DispensePrescriptionItemCommand {
            id: "ghost".to_string(),
            provider_id: "p1".to_string(),
            batch_quantities: std::collections::HashMap::new(),
        };
        assert!(handle_dispense_prescription_item(&cmd, &conn).is_err());
    }

    #[test]
    fn items_exclude_soft_deleted() {
        let conn = setup_test_db();
        handle_create_prescription_item(&make_create_cmd("pi1", "rx1", "p1"), &conn).unwrap();
        conn.execute(
            "UPDATE prescription_items SET local_server_deleted_at = 9999 WHERE id = 'pi1'",
            [],
        )
        .unwrap();

        let query = ItemsByPrescriptionQuery {
            prescription_id: "rx1".to_string(),
        };
        let result = handle_items_by_prescription(&query, &conn).unwrap();
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn n_items_for_prescription(n in 1u32..10) {
            let conn = setup_test_db();
            for i in 0..n {
                handle_create_prescription_item(
                    &make_create_cmd(&format!("pi{i}"), "rx1", "p1"),
                    &conn,
                ).unwrap();
            }
            let query = ItemsByPrescriptionQuery { prescription_id: "rx1".into() };
            let result = handle_items_by_prescription(&query, &conn).unwrap();
            prop_assert_eq!(result["data"].as_array().unwrap().len(), n as usize);
        }

        #[test]
        fn upsert_idempotent(repeats in 1u32..5) {
            let conn = setup_test_db();
            let cmd = make_create_cmd("idem_pi", "rx1", "p1");
            for _ in 0..repeats {
                handle_create_prescription_item(&cmd, &conn).unwrap();
            }
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM prescription_items WHERE id = 'idem_pi'", [], |r| r.get(0))
                .unwrap();
            prop_assert_eq!(count, 1);
        }
    }
}
