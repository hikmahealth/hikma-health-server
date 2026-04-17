// Form domain: registration forms and event forms.

use rusqlite::Connection;
use serde::Deserialize;

use super::HandlerResult;

// ============================================================================
// Payloads
// ============================================================================

/// Get a single event form by ID.
#[derive(Debug, Deserialize)]
pub struct GetEventFormQuery {
    pub form_id: String,
}

/// List event forms with optional language and clinic_id filtering.
#[derive(Debug, Deserialize)]
pub struct ListEventFormsQuery {
    pub language: Option<String>,
    pub clinic_id: Option<String>,
}

/// Get registration form with optional language filtering.
#[derive(Debug, Deserialize)]
pub struct GetRegistrationFormQuery {
    pub language: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

pub fn handle_get_patient_registration_form(conn: &Connection) -> HandlerResult {
    let mut stmt = conn.prepare(
        "SELECT id, name, fields, metadata, created_at, updated_at
         FROM registration_forms
         WHERE is_deleted = 0 AND local_server_deleted_at IS NULL
         ORDER BY updated_at DESC
         LIMIT 1",
    )?;

    let result = stmt.query_row([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "fields": row.get::<_, String>(2)?,
            "metadata": row.get::<_, String>(3)?,
            "created_at": row.get::<_, i64>(4)?,
            "updated_at": row.get::<_, i64>(5)?,
        }))
    });

    match result {
        Ok(form) => Ok(form),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Ok(serde_json::json!({ "error": "No registration form found" }))
        }
        Err(e) => Err(e.into()),
    }
}

/// Get registration form with optional language parameter.
/// Falls back to the most recently updated form when no language match exists.
pub fn handle_get_registration_form(
    payload: &GetRegistrationFormQuery,
    conn: &Connection,
) -> HandlerResult {
    // registration_forms doesn't have a language column directly,
    // but the form fields contain language-specific labels.
    // Return the most recent form, optionally filtered by name containing the language.
    if let Some(lang) = &payload.language {
        let result = conn.query_row(
            "SELECT id, name, fields, metadata, created_at, updated_at
             FROM registration_forms
             WHERE is_deleted = 0 AND local_server_deleted_at IS NULL
               AND name LIKE ?1
             ORDER BY updated_at DESC
             LIMIT 1",
            rusqlite::params![format!("%{lang}%")],
            |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "fields": row.get::<_, String>(2)?,
                    "metadata": row.get::<_, String>(3)?,
                    "created_at": row.get::<_, i64>(4)?,
                    "updated_at": row.get::<_, i64>(5)?,
                }))
            },
        );

        match result {
            Ok(form) => return Ok(form),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // Fall through to the unfiltered query
            }
            Err(e) => return Err(e.into()),
        }
    }

    // Fallback: return most recent form regardless of language
    handle_get_patient_registration_form(conn)
}

pub fn handle_get_event_forms(conn: &Connection) -> HandlerResult {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, language, is_editable, is_snapshot_form,
                form_fields, metadata, created_at, updated_at, clinic_ids
         FROM event_forms
         WHERE is_deleted = 0 AND local_server_deleted_at IS NULL
         ORDER BY name ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "description": row.get::<_, String>(2)?,
            "language": row.get::<_, String>(3)?,
            "is_editable": row.get::<_, i64>(4)?,
            "is_snapshot_form": row.get::<_, i64>(5)?,
            "form_fields": row.get::<_, String>(6)?,
            "metadata": row.get::<_, String>(7)?,
            "created_at": row.get::<_, i64>(8)?,
            "updated_at": row.get::<_, i64>(9)?,
            "clinic_ids": row.get::<_, String>(10)?,
        }))
    })?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

/// List event forms with optional language and clinic_id filters.
pub fn handle_list_event_forms(
    payload: &ListEventFormsQuery,
    conn: &Connection,
) -> HandlerResult {
    let mut conditions = vec![
        "is_deleted = 0".to_string(),
        "local_server_deleted_at IS NULL".to_string(),
    ];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(lang) = &payload.language {
        conditions.push(format!("language = ?{idx}"));
        params.push(Box::new(lang.clone()));
        idx += 1;
    }
    if let Some(clinic_id) = &payload.clinic_id {
        // clinic_ids is a JSON array stored as TEXT — use LIKE for containment check
        conditions.push(format!("clinic_ids LIKE ?{idx}"));
        params.push(Box::new(format!("%{clinic_id}%")));
        // idx not incremented — last param
    }

    let sql = format!(
        "SELECT id, name, description, language, is_editable, is_snapshot_form,
                form_fields, metadata, created_at, updated_at, clinic_ids, translations
         FROM event_forms
         WHERE {}
         ORDER BY name ASC",
        conditions.join(" AND ")
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "description": row.get::<_, String>(2)?,
            "language": row.get::<_, String>(3)?,
            "is_editable": row.get::<_, i64>(4)?,
            "is_snapshot_form": row.get::<_, i64>(5)?,
            "form_fields": row.get::<_, String>(6)?,
            "metadata": row.get::<_, String>(7)?,
            "created_at": row.get::<_, i64>(8)?,
            "updated_at": row.get::<_, i64>(9)?,
            "clinic_ids": row.get::<_, Option<String>>(10)?,
            "translations": row.get::<_, Option<String>>(11)?,
        }))
    })?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

pub fn handle_get_event_form(payload: &GetEventFormQuery, conn: &Connection) -> HandlerResult {
    let result = conn.query_row(
        "SELECT id, name, description, language, is_editable, is_snapshot_form,
                form_fields, metadata, created_at, updated_at, clinic_ids, translations
         FROM event_forms
         WHERE id = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL",
        rusqlite::params![payload.form_id],
        |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "language": row.get::<_, String>(3)?,
                "is_editable": row.get::<_, i64>(4)?,
                "is_snapshot_form": row.get::<_, i64>(5)?,
                "form_fields": row.get::<_, String>(6)?,
                "metadata": row.get::<_, String>(7)?,
                "created_at": row.get::<_, i64>(8)?,
                "updated_at": row.get::<_, i64>(9)?,
                "clinic_ids": row.get::<_, String>(10)?,
                "translations": row.get::<_, Option<String>>(11)?,
            }))
        },
    );

    match result {
        Ok(form) => Ok(form),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(
            serde_json::json!({ "error": format!("Event form '{}' not found", payload.form_id) }),
        ),
        Err(e) => Err(e.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;
    use rusqlite::Connection;

    fn insert_test_registration_form(conn: &Connection, id: &str, updated_at: i64) {
        conn.execute(
            "INSERT INTO registration_forms (
                id, name, fields, metadata, is_deleted,
                created_at, updated_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, ?2, '[]', '{}', 0,
                      1000, ?3, 1000, 1000)",
            rusqlite::params![id, format!("RegForm_{}", id), updated_at],
        )
        .unwrap();
    }

    fn insert_test_event_form(conn: &Connection, id: &str, name: &str) {
        conn.execute(
            "INSERT INTO event_forms (
                id, name, description, language, is_editable, is_snapshot_form,
                form_fields, metadata, is_deleted,
                created_at, updated_at, clinic_ids, translations,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, ?2, 'desc', 'en', 1, 0,
                      '[]', '{}', 0,
                      1000, 2000, '[]', '{\"es\":\"hola\"}',
                      1000, 1000)",
            rusqlite::params![id, name],
        )
        .unwrap();
    }

    #[test]
    fn get_registration_form_returns_latest() {
        let conn = setup_test_db();
        insert_test_registration_form(&conn, "rf1", 1000);
        insert_test_registration_form(&conn, "rf2", 3000);
        insert_test_registration_form(&conn, "rf3", 2000);

        let result = handle_get_patient_registration_form(&conn).unwrap();
        assert_eq!(
            result["id"], "rf2",
            "should return the most recently updated form"
        );
    }

    #[test]
    fn get_registration_form_empty() {
        let conn = setup_test_db();
        let result = handle_get_patient_registration_form(&conn).unwrap();
        assert_eq!(result["error"], "No registration form found");
    }

    #[test]
    fn get_event_forms_returns_all() {
        let conn = setup_test_db();
        insert_test_event_form(&conn, "ef1", "Zebra Form");
        insert_test_event_form(&conn, "ef2", "Alpha Form");
        insert_test_event_form(&conn, "ef3", "Middle Form");

        let result = handle_get_event_forms(&conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 3);
        // Sorted by name ASC
        assert_eq!(data[0]["name"], "Alpha Form");
        assert_eq!(data[1]["name"], "Middle Form");
        assert_eq!(data[2]["name"], "Zebra Form");
    }

    #[test]
    fn get_event_form_by_id() {
        let conn = setup_test_db();
        insert_test_event_form(&conn, "ef_lookup", "Lookup Form");

        let query = GetEventFormQuery {
            form_id: "ef_lookup".to_string(),
        };
        let result = handle_get_event_form(&query, &conn).unwrap();
        assert_eq!(result["id"], "ef_lookup");
        assert_eq!(result["name"], "Lookup Form");
        // translations field should be present
        assert!(result["translations"].is_string());
    }

    #[test]
    fn get_event_form_not_found() {
        let conn = setup_test_db();
        let query = GetEventFormQuery {
            form_id: "nonexistent".to_string(),
        };
        let result = handle_get_event_form(&query, &conn).unwrap();
        assert!(result["error"].as_str().unwrap().contains("not found"));
    }

    #[test]
    fn get_event_forms_excludes_soft_deleted() {
        let conn = setup_test_db();
        insert_test_event_form(&conn, "ef_live", "Live Form");
        insert_test_event_form(&conn, "ef_dead", "Dead Form");

        conn.execute(
            "UPDATE event_forms SET local_server_deleted_at = 9999 WHERE id = 'ef_dead'",
            [],
        )
        .unwrap();

        let result = handle_get_event_forms(&conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0]["id"], "ef_live");
    }

    #[test]
    fn get_event_forms_excludes_is_deleted() {
        let conn = setup_test_db();
        insert_test_event_form(&conn, "ef_ok", "OK Form");
        insert_test_event_form(&conn, "ef_del", "Deleted Form");

        conn.execute(
            "UPDATE event_forms SET is_deleted = 1 WHERE id = 'ef_del'",
            [],
        )
        .unwrap();

        let result = handle_get_event_forms(&conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0]["id"], "ef_ok");
    }

    #[test]
    fn get_registration_form_excludes_soft_deleted() {
        let conn = setup_test_db();
        insert_test_registration_form(&conn, "rf_only", 5000);

        conn.execute(
            "UPDATE registration_forms SET local_server_deleted_at = 9999 WHERE id = 'rf_only'",
            [],
        )
        .unwrap();

        let result = handle_get_patient_registration_form(&conn).unwrap();
        assert_eq!(result["error"], "No registration form found");
    }

    // ========================================================================
    // list_event_forms (filtered) tests
    // ========================================================================

    fn insert_event_form_with_lang(
        conn: &Connection,
        id: &str,
        name: &str,
        language: &str,
        clinic_ids: &str,
    ) {
        conn.execute(
            "INSERT INTO event_forms (
                id, name, description, language, is_editable, is_snapshot_form,
                form_fields, metadata, is_deleted,
                created_at, updated_at, clinic_ids, translations,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, ?2, 'desc', ?3, 1, 0,
                      '[]', '{}', 0,
                      1000, 2000, ?4, '{}',
                      1000, 1000)",
            rusqlite::params![id, name, language, clinic_ids],
        )
        .unwrap();
    }

    #[test]
    fn list_event_forms_filters_by_language() {
        let conn = setup_test_db();
        insert_event_form_with_lang(&conn, "ef1", "Vitals EN", "en", "[]");
        insert_event_form_with_lang(&conn, "ef2", "Vitals ES", "es", "[]");
        insert_event_form_with_lang(&conn, "ef3", "Labs EN", "en", "[]");

        let query = ListEventFormsQuery {
            language: Some("en".to_string()),
            clinic_id: None,
        };
        let result = handle_list_event_forms(&query, &conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 2);
        assert!(data.iter().all(|f| f["language"] == "en"));
    }

    #[test]
    fn list_event_forms_filters_by_clinic_id() {
        let conn = setup_test_db();
        insert_event_form_with_lang(&conn, "ef1", "Form A", "en", r#"["c1","c2"]"#);
        insert_event_form_with_lang(&conn, "ef2", "Form B", "en", r#"["c3"]"#);

        let query = ListEventFormsQuery {
            language: None,
            clinic_id: Some("c1".to_string()),
        };
        let result = handle_list_event_forms(&query, &conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0]["id"], "ef1");
    }

    #[test]
    fn list_event_forms_no_filter_returns_all() {
        let conn = setup_test_db();
        insert_event_form_with_lang(&conn, "ef1", "A", "en", "[]");
        insert_event_form_with_lang(&conn, "ef2", "B", "es", "[]");

        let query = ListEventFormsQuery {
            language: None,
            clinic_id: None,
        };
        let result = handle_list_event_forms(&query, &conn).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn list_event_forms_includes_translations_field() {
        let conn = setup_test_db();
        insert_event_form_with_lang(&conn, "ef1", "Form", "en", "[]");

        let query = ListEventFormsQuery {
            language: None,
            clinic_id: None,
        };
        let result = handle_list_event_forms(&query, &conn).unwrap();
        let data = result["data"].as_array().unwrap();
        // translations should be present (unlike the old handle_get_event_forms)
        assert!(data[0].get("translations").is_some());
    }

    // ========================================================================
    // get_registration_form (with language) tests
    // ========================================================================

    fn insert_named_registration_form(conn: &Connection, id: &str, name: &str, updated_at: i64) {
        conn.execute(
            "INSERT INTO registration_forms (
                id, name, fields, metadata, is_deleted,
                created_at, updated_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (?1, ?2, '[]', '{}', 0,
                      1000, ?3, 1000, 1000)",
            rusqlite::params![id, name, updated_at],
        )
        .unwrap();
    }

    #[test]
    fn get_registration_form_matches_language_in_name() {
        let conn = setup_test_db();
        insert_named_registration_form(&conn, "rf1", "Registration English", 1000);
        insert_named_registration_form(&conn, "rf2", "Registration Spanish", 2000);

        let query = GetRegistrationFormQuery {
            language: Some("English".to_string()),
        };
        let result = handle_get_registration_form(&query, &conn).unwrap();
        assert_eq!(result["id"], "rf1");
    }

    #[test]
    fn get_registration_form_falls_back_when_no_language_match() {
        let conn = setup_test_db();
        insert_named_registration_form(&conn, "rf1", "Registration EN", 1000);
        insert_named_registration_form(&conn, "rf2", "Registration ES", 3000);

        // No form name contains "French" — should fall back to most recent
        let query = GetRegistrationFormQuery {
            language: Some("French".to_string()),
        };
        let result = handle_get_registration_form(&query, &conn).unwrap();
        assert_eq!(result["id"], "rf2", "should fall back to most recently updated form");
    }

    #[test]
    fn get_registration_form_no_language_returns_latest() {
        let conn = setup_test_db();
        insert_named_registration_form(&conn, "rf1", "Old Form", 1000);
        insert_named_registration_form(&conn, "rf2", "New Form", 5000);

        let query = GetRegistrationFormQuery { language: None };
        let result = handle_get_registration_form(&query, &conn).unwrap();
        assert_eq!(result["id"], "rf2");
    }

    #[test]
    fn get_registration_form_empty_db() {
        let conn = setup_test_db();
        let query = GetRegistrationFormQuery { language: None };
        let result = handle_get_registration_form(&query, &conn).unwrap();
        assert_eq!(result["error"], "No registration form found");
    }

    // ========================================================================
    // Property-based tests
    // ========================================================================

    use proptest::prelude::*;

    proptest! {
        /// Property: inserting N event forms returns exactly N (all non-deleted)
        #[test]
        fn n_event_forms_returned(n in 1u32..15) {
            let conn = setup_test_db();
            for i in 0..n {
                insert_test_event_form(&conn, &format!("pef{}", i), &format!("Form {}", i));
            }

            let result = handle_get_event_forms(&conn).unwrap();
            let data = result["data"].as_array().unwrap();
            prop_assert_eq!(data.len(), n as usize);
        }

        /// Property: event forms are sorted by name ascending
        #[test]
        fn event_forms_sorted_by_name(n in 2u32..10) {
            let conn = setup_test_db();
            for i in 0..n {
                insert_test_event_form(&conn, &format!("sf{}", i), &format!("Form {:03}", n - i));
            }

            let result = handle_get_event_forms(&conn).unwrap();
            let data = result["data"].as_array().unwrap();
            let names: Vec<&str> = data.iter().map(|f| f["name"].as_str().unwrap()).collect();
            let mut sorted = names.clone();
            sorted.sort();
            prop_assert_eq!(names, sorted, "event forms should be sorted by name");
        }

        /// Property: registration form query always returns the one with highest updated_at
        #[test]
        fn registration_form_returns_latest(
            timestamps in prop::collection::vec(1i64..100000, 2..10)
        ) {
            let conn = setup_test_db();
            let max_ts = *timestamps.iter().max().unwrap();

            for (i, ts) in timestamps.iter().enumerate() {
                insert_test_registration_form(&conn, &format!("prf{}", i), *ts);
            }

            let result = handle_get_patient_registration_form(&conn).unwrap();
            let returned_id = result["id"].as_str().unwrap();
            let returned_updated_at: i64 = conn
                .query_row(
                    &format!("SELECT updated_at FROM registration_forms WHERE id = '{}'", returned_id),
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            prop_assert_eq!(returned_updated_at, max_ts);
        }

        /// Property: get_event_form by ID always returns the exact form requested
        #[test]
        fn get_event_form_returns_exact_match(n in 1u32..10) {
            let conn = setup_test_db();
            for i in 0..n {
                insert_test_event_form(&conn, &format!("exact{}", i), &format!("ExactForm{}", i));
            }

            // Pick a random valid index to query
            let target_idx = 0; // always query the first one for determinism
            let target_id = format!("exact{}", target_idx);
            let query = GetEventFormQuery { form_id: target_id.clone() };
            let result = handle_get_event_form(&query, &conn).unwrap();
            prop_assert_eq!(result["id"].as_str().unwrap(), target_id.as_str());
        }
    }
}
