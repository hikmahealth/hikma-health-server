// Clinic inventory domain: by_clinic, search, check_availability.

use rusqlite::Connection;
use serde::Deserialize;

use super::HandlerResult;

// ============================================================================
// Payloads
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct InventoryByClinicQuery {
    pub clinic_id: String,
}

#[derive(Debug, Deserialize)]
pub struct InventorySearchQuery {
    pub clinic_id: String,
    pub search_term: String,
}

#[derive(Debug, Deserialize)]
pub struct CheckAvailabilityQuery {
    pub drug_id: String,
    pub clinic_id: String,
    pub required_quantity: i64,
}

// ============================================================================
// Shared
// ============================================================================

const INVENTORY_COLUMNS: &str =
    "ci.id, ci.clinic_id, ci.drug_id, ci.batch_id, ci.batch_number, ci.batch_expiry_date,
     ci.quantity_available, ci.reserved_quantity, ci.last_counted_at, ci.metadata,
     ci.created_at, ci.updated_at";

fn row_to_inventory_json(row: &rusqlite::Row) -> rusqlite::Result<serde_json::Value> {
    Ok(serde_json::json!({
        "id": row.get::<_, String>(0)?,
        "clinic_id": row.get::<_, String>(1)?,
        "drug_id": row.get::<_, String>(2)?,
        "batch_id": row.get::<_, String>(3)?,
        "batch_number": row.get::<_, Option<String>>(4)?,
        "batch_expiry_date": row.get::<_, Option<i64>>(5)?,
        "quantity_available": row.get::<_, i64>(6)?,
        "reserved_quantity": row.get::<_, Option<i64>>(7)?,
        "last_counted_at": row.get::<_, Option<i64>>(8)?,
        "metadata": row.get::<_, String>(9)?,
        "created_at": row.get::<_, i64>(10)?,
        "updated_at": row.get::<_, i64>(11)?,
    }))
}

// ============================================================================
// Handlers
// ============================================================================

pub fn handle_inventory_by_clinic(
    payload: &InventoryByClinicQuery,
    conn: &Connection,
) -> HandlerResult {
    let sql = format!(
        "SELECT {INVENTORY_COLUMNS}
         FROM clinic_inventory ci
         WHERE ci.clinic_id = ?1 AND ci.is_deleted = 0 AND ci.local_server_deleted_at IS NULL
         ORDER BY ci.updated_at DESC"
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![payload.clinic_id], row_to_inventory_json)?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

/// Searches inventory for a clinic by joining drug_catalogue for name matching.
pub fn handle_inventory_search(
    payload: &InventorySearchQuery,
    conn: &Connection,
) -> HandlerResult {
    let sql = format!(
        "SELECT {INVENTORY_COLUMNS}
         FROM clinic_inventory ci
         JOIN drug_catalogue dc ON dc.id = ci.drug_id
         WHERE ci.clinic_id = ?1
           AND ci.is_deleted = 0 AND ci.local_server_deleted_at IS NULL
           AND dc.is_deleted = 0 AND dc.local_server_deleted_at IS NULL
           AND (dc.generic_name LIKE ?2 OR dc.brand_name LIKE ?2 OR dc.barcode LIKE ?2)
         ORDER BY dc.generic_name ASC"
    );

    let like_term = format!("%{}%", payload.search_term);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params![payload.clinic_id, like_term],
        row_to_inventory_json,
    )?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

/// Checks if a drug has sufficient available (unreserved) quantity at a clinic.
pub fn handle_check_availability(
    payload: &CheckAvailabilityQuery,
    conn: &Connection,
) -> HandlerResult {
    let total: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(quantity_available - COALESCE(reserved_quantity, 0)), 0)
             FROM clinic_inventory
             WHERE drug_id = ?1 AND clinic_id = ?2
               AND is_deleted = 0 AND local_server_deleted_at IS NULL",
            rusqlite::params![payload.drug_id, payload.clinic_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(serde_json::json!({
        "available": total >= payload.required_quantity,
        "total_available": total,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    fn insert_drug(conn: &Connection, id: &str, name: &str) {
        conn.execute(
            "INSERT INTO drug_catalogue (
                id, generic_name, form, route, dosage_quantity, dosage_units,
                sale_price, metadata, is_deleted, is_active,
                created_at, updated_at, last_modified, server_created_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, ?2, 'tablet', 'oral', '500', 'mg',
                      '10.00', '{}', 0, 1, 1000, 1000, 1000, 1000, 1000, 1000)",
            rusqlite::params![id, name],
        )
        .unwrap();
    }

    fn insert_inventory(
        conn: &Connection,
        id: &str,
        clinic_id: &str,
        drug_id: &str,
        qty: i64,
        reserved: i64,
    ) {
        conn.execute(
            "INSERT INTO clinic_inventory (
                id, clinic_id, drug_id, batch_id, quantity_available, reserved_quantity,
                metadata, is_deleted, created_at, updated_at, last_modified, server_created_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, ?2, ?3, 'batch1', ?4, ?5,
                      '{}', 0, 1000, 1000, 1000, 1000, 1000, 1000)",
            rusqlite::params![id, clinic_id, drug_id, qty, reserved],
        )
        .unwrap();
    }

    #[test]
    fn inventory_by_clinic() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Drug A");
        insert_inventory(&conn, "i1", "c1", "d1", 100, 10);
        insert_inventory(&conn, "i2", "c2", "d1", 50, 0);

        let query = InventoryByClinicQuery {
            clinic_id: "c1".to_string(),
        };
        let result = handle_inventory_by_clinic(&query, &conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0]["quantity_available"], 100);
    }

    #[test]
    fn inventory_search_by_drug_name() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Amoxicillin");
        insert_drug(&conn, "d2", "Ibuprofen");
        insert_inventory(&conn, "i1", "c1", "d1", 100, 0);
        insert_inventory(&conn, "i2", "c1", "d2", 50, 0);

        let query = InventorySearchQuery {
            clinic_id: "c1".to_string(),
            search_term: "amox".to_string(),
        };
        let result = handle_inventory_search(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn check_availability_sufficient() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Drug");
        insert_inventory(&conn, "i1", "c1", "d1", 100, 10);
        insert_inventory(&conn, "i2", "c1", "d1", 50, 5);

        let query = CheckAvailabilityQuery {
            drug_id: "d1".to_string(),
            clinic_id: "c1".to_string(),
            required_quantity: 100,
        };
        let result = handle_check_availability(&query, &conn).unwrap();
        // total available = (100 - 10) + (50 - 5) = 135
        assert_eq!(result["available"], true);
        assert_eq!(result["total_available"], 135);
    }

    #[test]
    fn check_availability_insufficient() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Drug");
        insert_inventory(&conn, "i1", "c1", "d1", 10, 5);

        let query = CheckAvailabilityQuery {
            drug_id: "d1".to_string(),
            clinic_id: "c1".to_string(),
            required_quantity: 10,
        };
        let result = handle_check_availability(&query, &conn).unwrap();
        assert_eq!(result["available"], false);
        assert_eq!(result["total_available"], 5);
    }

    #[test]
    fn check_availability_no_inventory() {
        let conn = setup_test_db();
        let query = CheckAvailabilityQuery {
            drug_id: "missing".to_string(),
            clinic_id: "c1".to_string(),
            required_quantity: 1,
        };
        let result = handle_check_availability(&query, &conn).unwrap();
        assert_eq!(result["available"], false);
    }

    #[test]
    fn inventory_excludes_soft_deleted() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Drug");
        insert_inventory(&conn, "i1", "c1", "d1", 100, 0);
        insert_inventory(&conn, "i2", "c1", "d1", 50, 0);
        conn.execute(
            "UPDATE clinic_inventory SET local_server_deleted_at = 9999 WHERE id = 'i2'",
            [],
        )
        .unwrap();

        let query = InventoryByClinicQuery {
            clinic_id: "c1".to_string(),
        };
        let result = handle_inventory_by_clinic(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 1);
    }

    use proptest::prelude::*;

    proptest! {
        /// Availability check: sum(available - reserved) >= required iff available == true
        #[test]
        fn availability_consistent_with_quantities(
            qty1 in 0i64..200,
            res1 in 0i64..100,
            qty2 in 0i64..200,
            res2 in 0i64..100,
            required in 1i64..300,
        ) {
            let conn = setup_test_db();
            insert_drug(&conn, "d1", "Drug");
            insert_inventory(&conn, "i1", "c1", "d1", qty1, res1);
            insert_inventory(&conn, "i2", "c1", "d1", qty2, res2);

            let query = CheckAvailabilityQuery {
                drug_id: "d1".to_string(),
                clinic_id: "c1".to_string(),
                required_quantity: required,
            };
            let result = handle_check_availability(&query, &conn).unwrap();
            let total = (qty1 - res1) + (qty2 - res2);
            let expected = total >= required;
            prop_assert_eq!(result["available"].as_bool().unwrap(), expected);
            prop_assert_eq!(result["total_available"].as_i64().unwrap(), total);
        }
    }
}
