// Drug catalogue domain: search, get by ID, get by barcode.

use rusqlite::Connection;
use serde::Deserialize;

use super::HandlerResult;

// ============================================================================
// Payloads
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SearchDrugsQuery {
    pub search_term: Option<String>,
    pub form: Option<String>,
    pub route: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct GetDrugQuery {
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct GetDrugByBarcodeQuery {
    pub barcode: String,
}

// ============================================================================
// Shared
// ============================================================================

const DRUG_COLUMNS: &str =
    "id, barcode, generic_name, brand_name, form, route, dosage_quantity, dosage_units,
     manufacturer, sale_price, sale_currency, min_stock_level, max_stock_level,
     is_controlled, requires_refrigeration, is_active, notes, metadata,
     created_at, updated_at";

fn row_to_drug_json(row: &rusqlite::Row) -> rusqlite::Result<serde_json::Value> {
    Ok(serde_json::json!({
        "id": row.get::<_, String>(0)?,
        "barcode": row.get::<_, Option<String>>(1)?,
        "generic_name": row.get::<_, String>(2)?,
        "brand_name": row.get::<_, Option<String>>(3)?,
        "form": row.get::<_, String>(4)?,
        "route": row.get::<_, String>(5)?,
        "dosage_quantity": row.get::<_, String>(6)?,
        "dosage_units": row.get::<_, String>(7)?,
        "manufacturer": row.get::<_, Option<String>>(8)?,
        "sale_price": row.get::<_, String>(9)?,
        "sale_currency": row.get::<_, Option<String>>(10)?,
        "min_stock_level": row.get::<_, Option<i64>>(11)?,
        "max_stock_level": row.get::<_, Option<i64>>(12)?,
        "is_controlled": row.get::<_, i64>(13)?,
        "requires_refrigeration": row.get::<_, i64>(14)?,
        "is_active": row.get::<_, i64>(15)?,
        "notes": row.get::<_, Option<String>>(16)?,
        "metadata": row.get::<_, String>(17)?,
        "created_at": row.get::<_, i64>(18)?,
        "updated_at": row.get::<_, i64>(19)?,
    }))
}

// ============================================================================
// Handlers
// ============================================================================

pub fn handle_search_drugs(payload: &SearchDrugsQuery, conn: &Connection) -> HandlerResult {
    let mut conditions = vec![
        "is_deleted = 0".to_string(),
        "local_server_deleted_at IS NULL".to_string(),
    ];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(term) = &payload.search_term {
        conditions.push(format!(
            "(generic_name LIKE ?{idx} OR brand_name LIKE ?{idx} OR barcode LIKE ?{idx})"
        ));
        params.push(Box::new(format!("%{term}%")));
        idx += 1;
    }
    if let Some(form) = &payload.form {
        conditions.push(format!("form = ?{idx}"));
        params.push(Box::new(form.clone()));
        idx += 1;
    }
    if let Some(route) = &payload.route {
        conditions.push(format!("route = ?{idx}"));
        params.push(Box::new(route.clone()));
        idx += 1;
    }
    if let Some(is_active) = payload.is_active {
        conditions.push(format!("is_active = ?{idx}"));
        params.push(Box::new(if is_active { 1i64 } else { 0i64 }));
        // idx intentionally not incremented — last param
    }

    let sql = format!(
        "SELECT {DRUG_COLUMNS} FROM drug_catalogue WHERE {} ORDER BY generic_name ASC",
        conditions.join(" AND ")
    );

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), row_to_drug_json)?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

pub fn handle_get_drug(payload: &GetDrugQuery, conn: &Connection) -> HandlerResult {
    let sql = format!(
        "SELECT {DRUG_COLUMNS} FROM drug_catalogue
         WHERE id = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL"
    );

    match conn.query_row(&sql, rusqlite::params![payload.id], row_to_drug_json) {
        Ok(drug) => Ok(drug),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(serde_json::json!(null)),
        Err(e) => Err(e.into()),
    }
}

pub fn handle_get_drug_by_barcode(
    payload: &GetDrugByBarcodeQuery,
    conn: &Connection,
) -> HandlerResult {
    let sql = format!(
        "SELECT {DRUG_COLUMNS} FROM drug_catalogue
         WHERE barcode = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL"
    );

    match conn.query_row(&sql, rusqlite::params![payload.barcode], row_to_drug_json) {
        Ok(drug) => Ok(drug),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(serde_json::json!(null)),
        Err(e) => Err(e.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    fn insert_drug(conn: &Connection, id: &str, generic_name: &str, barcode: Option<&str>) {
        conn.execute(
            "INSERT INTO drug_catalogue (
                id, barcode, generic_name, form, route, dosage_quantity, dosage_units,
                sale_price, metadata, is_deleted, is_active,
                created_at, updated_at, last_modified, server_created_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, ?2, ?3, 'tablet', 'oral', '500', 'mg',
                      '10.00', '{}', 0, 1,
                      1000, 1000, 1000, 1000, 1000, 1000)",
            rusqlite::params![id, barcode, generic_name],
        )
        .unwrap();
    }

    #[test]
    fn search_drugs_no_filter() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Amoxicillin", Some("ABC123"));
        insert_drug(&conn, "d2", "Ibuprofen", None);

        let query = SearchDrugsQuery {
            search_term: None,
            form: None,
            route: None,
            is_active: None,
        };
        let result = handle_search_drugs(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn search_drugs_by_name() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Amoxicillin", None);
        insert_drug(&conn, "d2", "Ibuprofen", None);

        let query = SearchDrugsQuery {
            search_term: Some("amox".to_string()),
            form: None,
            route: None,
            is_active: None,
        };
        let result = handle_search_drugs(&query, &conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0]["generic_name"], "Amoxicillin");
    }

    #[test]
    fn search_drugs_excludes_soft_deleted() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Active Drug", None);
        insert_drug(&conn, "d2", "Deleted Drug", None);
        conn.execute(
            "UPDATE drug_catalogue SET local_server_deleted_at = 9999 WHERE id = 'd2'",
            [],
        )
        .unwrap();

        let query = SearchDrugsQuery {
            search_term: None,
            form: None,
            route: None,
            is_active: None,
        };
        let result = handle_search_drugs(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn get_drug_by_id() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Amoxicillin", None);

        let query = GetDrugQuery {
            id: "d1".to_string(),
        };
        let result = handle_get_drug(&query, &conn).unwrap();
        assert_eq!(result["generic_name"], "Amoxicillin");
    }

    #[test]
    fn get_drug_not_found() {
        let conn = setup_test_db();
        let query = GetDrugQuery {
            id: "missing".to_string(),
        };
        let result = handle_get_drug(&query, &conn).unwrap();
        assert!(result.is_null());
    }

    #[test]
    fn get_drug_by_barcode_found() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Amoxicillin", Some("BC001"));

        let query = GetDrugByBarcodeQuery {
            barcode: "BC001".to_string(),
        };
        let result = handle_get_drug_by_barcode(&query, &conn).unwrap();
        assert_eq!(result["id"], "d1");
    }

    #[test]
    fn get_drug_by_barcode_not_found() {
        let conn = setup_test_db();
        let query = GetDrugByBarcodeQuery {
            barcode: "NOPE".to_string(),
        };
        let result = handle_get_drug_by_barcode(&query, &conn).unwrap();
        assert!(result.is_null());
    }

    #[test]
    fn search_drugs_by_form_filter() {
        let conn = setup_test_db();
        insert_drug(&conn, "d1", "Drug A", None);
        // Insert a capsule drug
        conn.execute(
            "INSERT INTO drug_catalogue (
                id, generic_name, form, route, dosage_quantity, dosage_units,
                sale_price, metadata, is_deleted, is_active,
                created_at, updated_at, last_modified, server_created_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES ('d2', 'Drug B', 'capsule', 'oral', '250', 'mg',
                      '5.00', '{}', 0, 1, 1000, 1000, 1000, 1000, 1000, 1000)",
            [],
        )
        .unwrap();

        let query = SearchDrugsQuery {
            search_term: None,
            form: Some("capsule".to_string()),
            route: None,
            is_active: None,
        };
        let result = handle_search_drugs(&query, &conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0]["form"], "capsule");
    }

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn search_returns_all_when_no_filter(n in 1u32..10) {
            let conn = setup_test_db();
            for i in 0..n {
                insert_drug(&conn, &format!("d{i}"), &format!("Drug {i}"), None);
            }
            let query = SearchDrugsQuery {
                search_term: None, form: None, route: None, is_active: None,
            };
            let result = handle_search_drugs(&query, &conn).unwrap();
            prop_assert_eq!(result["data"].as_array().unwrap().len(), n as usize);
        }
    }
}
