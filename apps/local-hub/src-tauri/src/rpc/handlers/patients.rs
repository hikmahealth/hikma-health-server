// Patient domain: registration, update, deletion, search, and retrieval.
//
// The registration form (stored in `registration_forms`) drives the schema:
// base fields live directly on the `patients` table, dynamic fields go to
// `patient_additional_attributes` with typed value columns.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::serde_flexible::{
    flexible_bool_i64, flexible_opt_timestamp, flexible_timestamp, stringify_json,
};
use super::{now_millis, HandlerResult, PaginatedResponse};
use crate::rpc::auth::{self, AuthContext};

// ============================================================================
// Shared types — registration form field definition
// ============================================================================

/// A single field in the patient registration form.
///
/// Deserialized from the JSON array in `registration_forms.fields`.
/// The `base_field` flag determines whether the value lives on the `patients`
/// table (true) or in `patient_additional_attributes` (false).
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationFormField {
    pub id: String,
    pub position: i64,
    pub column: String,
    pub label: serde_json::Map<String, serde_json::Value>,
    pub field_type: String,
    pub options: Vec<serde_json::Map<String, serde_json::Value>>,
    pub required: bool,
    pub base_field: bool,
    pub visible: bool,
    pub is_search_field: bool,
    pub deleted: bool,
}

/// Maps a field's type to the column name in `patient_additional_attributes`.
fn value_column_for_field_type(field_type: &str) -> &'static str {
    match field_type {
        "number" => "number_value",
        "date" => "date_value",
        "boolean" => "boolean_value",
        // text, select, and anything unknown → string_value
        _ => "string_value",
    }
}

/// Converts a rusqlite Value to a serde_json Value.
fn sqlite_to_json(val: rusqlite::types::Value) -> serde_json::Value {
    match val {
        rusqlite::types::Value::Null => serde_json::Value::Null,
        rusqlite::types::Value::Integer(i) => serde_json::json!(i),
        rusqlite::types::Value::Real(f) => serde_json::json!(f),
        rusqlite::types::Value::Text(s) => serde_json::json!(s),
        rusqlite::types::Value::Blob(b) => {
            // Blobs are unusual here but encode as base64 to be safe
            use base64::Engine;
            serde_json::json!(base64::engine::general_purpose::STANDARD.encode(b))
        }
    }
}

// ============================================================================
// Payloads
// ============================================================================

/// Register or update a patient. Upserts into both `patients` and
/// `patient_additional_attributes` for dynamic fields.
#[derive(Debug, Deserialize)]
pub struct RegisterPatientCommand {
    pub patient: PatientRecord,
    pub additional_attributes: Vec<PatientAdditionalAttribute>,
}

#[derive(Debug, Deserialize)]
pub struct PatientRecord {
    pub id: String,
    pub given_name: String,
    pub surname: String,
    pub date_of_birth: String,
    pub citizenship: String,
    pub hometown: String,
    pub phone: String,
    pub sex: String,
    pub camp: Option<String>,
    #[serde(deserialize_with = "stringify_json")]
    pub additional_data: String, // JSON text — client may send string or object
    #[serde(deserialize_with = "stringify_json")]
    pub metadata: String, // JSON text — client may send string or object
    pub photo_url: Option<String>,
    pub government_id: String,
    pub external_patient_id: String,
    pub primary_clinic_id: Option<String>,
    pub last_modified_by: Option<String>,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub created_at: i64,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct PatientAdditionalAttribute {
    pub id: String,
    pub patient_id: String,
    pub attribute_id: String,
    pub attribute: String,
    pub number_value: Option<f64>,
    pub string_value: Option<String>,
    #[serde(default, deserialize_with = "flexible_opt_timestamp")]
    pub date_value: Option<i64>,
    pub boolean_value: Option<i64>, // SQLite INTEGER 0/1
    #[serde(deserialize_with = "stringify_json")]
    pub metadata: String, // client may send string or object
    #[serde(deserialize_with = "flexible_bool_i64")]
    pub is_deleted: i64,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub created_at: i64,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub updated_at: i64,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub last_modified: i64,
    #[serde(deserialize_with = "flexible_timestamp")]
    pub server_created_at: i64,
}

/// Retrieve a single patient with form fields and reconstructed values.
#[derive(Debug, Deserialize)]
pub struct GetPatientQuery {
    pub patient_id: String,
}

/// Delete a patient (cascading soft delete).
#[derive(Debug, Deserialize)]
pub struct DeletePatientCommand {
    pub patient_id: String,
}

/// Check whether a government ID already exists.
#[derive(Debug, Deserialize)]
pub struct CheckGovernmentIdQuery {
    pub government_id: String,
}

/// Search patients by dynamic field filters.
#[derive(Debug, Deserialize)]
pub struct SearchPatientsQuery {
    pub filters: serde_json::Map<String, serde_json::Value>,
    #[serde(default = "super::default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

/// Paginated patient list, sorted by most recently updated first.
#[derive(Debug, Deserialize)]
pub struct GetPatientsListQuery {
    #[serde(default = "super::default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

/// Similar patient search for duplicate detection.
#[derive(Debug, Deserialize)]
pub struct SimilarPatientsQuery {
    pub given_name: String,
    pub surname: String,
    #[serde(default = "default_similar_limit")]
    pub limit: usize,
}

fn default_similar_limit() -> usize {
    10
}

/// The response shape for get_patient — matches the mobile app's PatientRecord.
#[derive(Debug, Serialize)]
pub struct PatientFormRecord {
    pub fields: Vec<RegistrationFormField>,
    pub values: HashMap<String, serde_json::Value>,
}

// ============================================================================
// Internal helpers
// ============================================================================

/// Fetches and parses the first non-deleted registration form's fields.
fn load_form_fields(
    conn: &Connection,
) -> Result<Vec<RegistrationFormField>, Box<dyn std::error::Error>> {
    let fields_json: String = conn
        .query_row(
            "SELECT fields FROM registration_forms
         WHERE is_deleted = 0 AND local_server_deleted_at IS NULL
         ORDER BY updated_at DESC
         LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| -> Box<dyn std::error::Error> {
            match e {
                rusqlite::Error::QueryReturnedNoRows => "No registration form found".into(),
                other => other.into(),
            }
        })?;

    let fields: Vec<RegistrationFormField> = serde_json::from_str(&fields_json)?;
    Ok(fields)
}

/// Reads a patient row as a dynamic column map via SELECT *.
/// Excludes internal tracking columns from the result.
fn load_patient_as_map(
    conn: &Connection,
    patient_id: &str,
) -> Result<HashMap<String, serde_json::Value>, Box<dyn std::error::Error>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM patients WHERE id = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL",
    )?;
    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let map = stmt
        .query_row(rusqlite::params![patient_id], |row| {
            let mut m = HashMap::new();
            for (i, name) in column_names.iter().enumerate() {
                let val: rusqlite::types::Value = row.get(i)?;
                m.insert(name.clone(), sqlite_to_json(val));
            }
            Ok(m)
        })
        .map_err(|e| -> Box<dyn std::error::Error> {
            match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    format!("Patient '{}' not found", patient_id).into()
                }
                other => other.into(),
            }
        })?;

    Ok(map)
}

/// Builds the clinic permission filter clause for list/search queries.
/// Returns (sql_fragment, params) to be appended to WHERE.
fn clinic_filter_clause(
    conn: &Connection,
    auth: &AuthContext,
) -> Result<(String, Vec<String>), String> {
    let clinic_ids = auth::permitted_clinic_ids(conn, &auth.user_id, "can_view_history")?;

    if clinic_ids.is_empty() {
        // User has no view permissions — can only see NULL-clinic patients
        return Ok(("(primary_clinic_id IS NULL)".to_string(), vec![]));
    }

    let placeholders: Vec<String> = clinic_ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 100)) // high offset to avoid collisions
        .collect();

    let clause = format!(
        "(primary_clinic_id IN ({}) OR primary_clinic_id IS NULL)",
        placeholders.join(", ")
    );

    Ok((clause, clinic_ids))
}

/// Selects all core patient columns for list/search results.
const PATIENT_LIST_COLUMNS: &str =
    "id, given_name, surname, date_of_birth, citizenship, hometown, phone, sex, camp,
     photo_url, government_id, external_patient_id, additional_data, metadata,
     primary_clinic_id, last_modified_by, created_at, updated_at";

/// Maps a patient row (from PATIENT_LIST_COLUMNS) to a JSON object.
fn row_to_patient_json(row: &rusqlite::Row) -> rusqlite::Result<serde_json::Value> {
    Ok(serde_json::json!({
        "id": row.get::<_, String>(0)?,
        "given_name": row.get::<_, Option<String>>(1)?,
        "surname": row.get::<_, Option<String>>(2)?,
        "date_of_birth": row.get::<_, Option<String>>(3)?,
        "citizenship": row.get::<_, Option<String>>(4)?,
        "hometown": row.get::<_, Option<String>>(5)?,
        "phone": row.get::<_, Option<String>>(6)?,
        "sex": row.get::<_, Option<String>>(7)?,
        "camp": row.get::<_, Option<String>>(8)?,
        "photo_url": row.get::<_, Option<String>>(9)?,
        "government_id": row.get::<_, Option<String>>(10)?,
        "external_patient_id": row.get::<_, Option<String>>(11)?,
        "additional_data": row.get::<_, Option<String>>(12)?,
        "metadata": row.get::<_, Option<String>>(13)?,
        "primary_clinic_id": row.get::<_, Option<String>>(14)?,
        "last_modified_by": row.get::<_, Option<String>>(15)?,
        "created_at": row.get::<_, i64>(16)?,
        "updated_at": row.get::<_, i64>(17)?,
    }))
}

// ============================================================================
// Handlers
// ============================================================================

/// Registers or updates a patient. Wraps patient row + all additional attribute
/// rows in a single transaction for atomicity.
pub fn handle_register_patient(
    payload: &RegisterPatientCommand,
    conn: &Connection,
    auth: &AuthContext,
) -> HandlerResult {
    let p = &payload.patient;
    let patient_id = if p.id.is_empty() {
        uuid::Uuid::now_v7().to_string()
    } else {
        p.id.clone()
    };

    // Permission: check against target clinic, fall back to home clinic for NULL
    auth::require_clinic_permission(
        conn,
        auth,
        p.primary_clinic_id.as_deref(),
        |perms| perms.can_register_patients,
        "can_register_patients",
    )
    .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

    let now = now_millis();

    // Atomic: patient row + all attribute rows in one transaction
    conn.execute_batch("BEGIN")?;

    let result = (|| -> HandlerResult {
        conn.execute(
            r#"INSERT INTO patients (
                id, given_name, surname, date_of_birth, citizenship, hometown,
                phone, sex, camp, additional_data, metadata, photo_url,
                is_deleted, government_id, external_patient_id, primary_clinic_id,
                last_modified_by, created_at, updated_at,
                local_server_created_at, local_server_last_modified_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6,
                ?7, ?8, ?9, ?10, ?11, ?12,
                0, ?13, ?14, ?15,
                ?16, ?17, ?18,
                ?19, ?20
            )
            ON CONFLICT(id) DO UPDATE SET
                given_name = excluded.given_name,
                surname = excluded.surname,
                date_of_birth = excluded.date_of_birth,
                citizenship = excluded.citizenship,
                hometown = excluded.hometown,
                phone = excluded.phone,
                sex = excluded.sex,
                camp = excluded.camp,
                additional_data = excluded.additional_data,
                metadata = excluded.metadata,
                photo_url = excluded.photo_url,
                government_id = excluded.government_id,
                external_patient_id = excluded.external_patient_id,
                primary_clinic_id = excluded.primary_clinic_id,
                last_modified_by = excluded.last_modified_by,
                updated_at = excluded.updated_at,
                local_server_last_modified_at = excluded.local_server_last_modified_at
            "#,
            rusqlite::params![
                patient_id,
                p.given_name,
                p.surname,
                p.date_of_birth,
                p.citizenship,
                p.hometown,
                p.phone,
                p.sex,
                p.camp,
                p.additional_data,
                p.metadata,
                p.photo_url,
                p.government_id,
                p.external_patient_id,
                p.primary_clinic_id,
                p.last_modified_by,
                p.created_at,
                p.updated_at,
                now,
                now,
            ],
        )?;

        for attr in &payload.additional_attributes {
            conn.execute(
                r#"INSERT INTO patient_additional_attributes (
                    id, patient_id, attribute_id, attribute,
                    number_value, string_value, date_value, boolean_value,
                    metadata, is_deleted, created_at, updated_at,
                    last_modified, server_created_at,
                    local_server_created_at, local_server_last_modified_at
                ) VALUES (
                    ?1, ?2, ?3, ?4,
                    ?5, ?6, ?7, ?8,
                    ?9, ?10, ?11, ?12,
                    ?13, ?14,
                    ?15, ?16
                )
                ON CONFLICT(id) DO UPDATE SET
                    attribute_id = excluded.attribute_id,
                    attribute = excluded.attribute,
                    number_value = excluded.number_value,
                    string_value = excluded.string_value,
                    date_value = excluded.date_value,
                    boolean_value = excluded.boolean_value,
                    metadata = excluded.metadata,
                    is_deleted = excluded.is_deleted,
                    updated_at = excluded.updated_at,
                    last_modified = excluded.last_modified,
                    local_server_last_modified_at = excluded.local_server_last_modified_at
                "#,
                rusqlite::params![
                    attr.id,
                    attr.patient_id,
                    attr.attribute_id,
                    attr.attribute,
                    attr.number_value,
                    attr.string_value,
                    attr.date_value,
                    attr.boolean_value,
                    attr.metadata,
                    attr.is_deleted,
                    attr.created_at,
                    attr.updated_at,
                    attr.last_modified,
                    attr.server_created_at,
                    now,
                    now,
                ],
            )?;
        }

        Ok(serde_json::json!({
            "patient_id": patient_id,
            "attributes_count": payload.additional_attributes.len(),
        }))
    })();

    match &result {
        Ok(_) => conn.execute_batch("COMMIT")?,
        Err(_) => conn.execute_batch("ROLLBACK")?,
    }

    result
}

/// Retrieves a single patient with full form reconstruction.
///
/// Returns `{ fields, values }` matching the mobile app's PatientRecord shape.
/// Base fields are read from the patient row; dynamic fields from additional
/// attributes, using the registration form's field_type to pick the right column.
pub fn handle_get_patient(
    payload: &GetPatientQuery,
    conn: &Connection,
    auth: &AuthContext,
) -> HandlerResult {
    // Load patient first to check clinic permission
    let patient_map = load_patient_as_map(conn, &payload.patient_id)?;
    let patient_clinic = patient_map
        .get("primary_clinic_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // View: NULL clinic is open to all, otherwise check can_view_history
    if patient_clinic.is_some() {
        auth::require_clinic_permission(
            conn,
            auth,
            patient_clinic.as_deref(),
            |p| p.can_view_history,
            "can_view_history",
        )
        .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
    }

    let fields = load_form_fields(conn)?;
    let mut values: HashMap<String, serde_json::Value> = HashMap::new();

    // Map base fields: form field.column → patient row column → values[field.id]
    for field in &fields {
        if field.base_field && !field.deleted {
            if let Some(val) = patient_map.get(&field.column) {
                values.insert(field.id.clone(), val.clone());
            }
        }
    }

    // Build a lookup from attribute_id → field for dynamic fields
    let dynamic_fields: HashMap<&str, &RegistrationFormField> = fields
        .iter()
        .filter(|f| !f.base_field && !f.deleted)
        .map(|f| (f.id.as_str(), f))
        .collect();

    // Fetch additional attributes, ordered by updated_at ASC so newer overwrites
    let mut stmt = conn.prepare(
        "SELECT attribute_id, number_value, string_value, date_value, boolean_value
         FROM patient_additional_attributes
         WHERE patient_id = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL
         ORDER BY updated_at ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![payload.patient_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<f64>>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<i64>>(3)?,
            row.get::<_, Option<i64>>(4)?,
        ))
    })?;

    for row in rows {
        let (attr_id, num_val, str_val, date_val, bool_val) = row?;

        // Find the field definition to know which value column to read
        let value = if let Some(field) = dynamic_fields.get(attr_id.as_str()) {
            match value_column_for_field_type(&field.field_type) {
                "number_value" => num_val.map(|v| serde_json::json!(v)),
                "date_value" => date_val.map(|v| serde_json::json!(v)),
                "boolean_value" => bool_val.map(|v| serde_json::json!(v != 0)),
                _ => str_val.map(|v| serde_json::json!(v)),
            }
        } else {
            // Field not in form — fall back to string_value
            str_val.map(|v| serde_json::json!(v))
        };

        if let Some(v) = value {
            values.insert(attr_id, v);
        }
    }

    let record = PatientFormRecord { fields, values };
    Ok(serde_json::to_value(record)?)
}

/// Cascading soft delete across patients and all related tables.
///
/// Sets is_deleted = 1, deleted_at, and local_server_deleted_at on:
/// patients, patient_additional_attributes, visits, events, appointments.
pub fn handle_delete_patient(
    payload: &DeletePatientCommand,
    conn: &Connection,
    auth: &AuthContext,
) -> HandlerResult {
    // Load patient to check clinic permission
    let clinic_id: Option<String> = conn.query_row(
        "SELECT primary_clinic_id FROM patients WHERE id = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL",
        rusqlite::params![payload.patient_id],
        |row| row.get(0),
    ).map_err(|e| -> Box<dyn std::error::Error> {
        match e {
            rusqlite::Error::QueryReturnedNoRows => {
                format!("Patient '{}' not found", payload.patient_id).into()
            }
            other => other.into(),
        }
    })?;

    // Write: NULL clinic → check home clinic
    auth::require_clinic_permission(
        conn,
        auth,
        clinic_id.as_deref(),
        |p| p.can_delete_patient_records,
        "can_delete_patient_records",
    )
    .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

    let now = now_millis();

    conn.execute_batch("BEGIN")?;

    let result = (|| -> Result<(), Box<dyn std::error::Error>> {
        // Soft delete across all related tables
        let tables_and_fks: &[(&str, &str)] = &[
            ("patients", "id"),
            ("patient_additional_attributes", "patient_id"),
            ("visits", "patient_id"),
            ("events", "patient_id"),
            ("appointments", "patient_id"),
        ];

        for (table, fk_column) in tables_and_fks {
            let sql = format!(
                "UPDATE {} SET is_deleted = 1, deleted_at = ?1, local_server_deleted_at = ?2
                 WHERE {} = ?3 AND is_deleted = 0",
                table, fk_column
            );
            conn.execute(&sql, rusqlite::params![now, now, payload.patient_id])?;
        }

        Ok(())
    })();

    match &result {
        Ok(_) => {
            conn.execute_batch("COMMIT")?;
            Ok(serde_json::json!({ "deleted": true, "patient_id": payload.patient_id }))
        }
        Err(e) => {
            conn.execute_batch("ROLLBACK")?;
            Err(e.to_string().into())
        }
    }
}

/// Checks whether a government ID already exists in the patients table.
pub fn handle_check_government_id(
    payload: &CheckGovernmentIdQuery,
    conn: &Connection,
) -> HandlerResult {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(
            SELECT 1 FROM patients
            WHERE government_id = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL
        )",
        rusqlite::params![payload.government_id],
        |row| row.get(0),
    )?;

    Ok(serde_json::json!({ "exists": exists }))
}

/// Searches patients by base columns and/or dynamic attribute fields.
///
/// Uses prefix match (LIKE 'value%') for sex to prevent "female" matching "male".
/// Uses substring match (LIKE '%value%') for all other text fields.
/// Permission-filtered: only returns patients from clinics where user has can_view_history.
pub fn handle_search_patients(
    payload: &SearchPatientsQuery,
    conn: &Connection,
    auth: &AuthContext,
) -> HandlerResult {
    let allowed_columns = [
        "given_name",
        "surname",
        "date_of_birth",
        "citizenship",
        "hometown",
        "phone",
        "sex",
        "camp",
        "government_id",
        "external_patient_id",
        "id",
    ];

    let (_, clinic_ids) =
        clinic_filter_clause(conn, auth).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

    // Build WHERE clause with sequential param indices for rusqlite binding
    let mut final_conditions = vec![
        "is_deleted = 0".to_string(),
        "local_server_deleted_at IS NULL".to_string(),
    ];
    let mut final_params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_idx = 1usize;

    // Clinic filter
    if clinic_ids.is_empty() {
        final_conditions.push("(primary_clinic_id IS NULL)".to_string());
    } else {
        let placeholders: Vec<String> = clinic_ids
            .iter()
            .map(|_| {
                let p = format!("?{}", param_idx);
                param_idx += 1;
                p
            })
            .collect();
        final_conditions.push(format!(
            "(primary_clinic_id IN ({}) OR primary_clinic_id IS NULL)",
            placeholders.join(", ")
        ));
        for cid in &clinic_ids {
            final_params.push(Box::new(cid.clone()));
        }
    }

    // Filter params
    for (key, value) in &payload.filters {
        let raw_val = match value {
            serde_json::Value::String(s) => s.clone(),
            other => other.to_string(),
        };

        if allowed_columns.contains(&key.as_str()) {
            let search_val = if key == "sex" {
                format!("{}%", raw_val)
            } else {
                format!("%{}%", raw_val)
            };
            final_conditions.push(format!("{} LIKE ?{}", key, param_idx));
            param_idx += 1;
            final_params.push(Box::new(search_val));
        } else {
            let search_val = format!("%{}%", raw_val);
            final_conditions.push(format!(
                "EXISTS (\
                    SELECT 1 FROM patient_additional_attributes a \
                    WHERE a.patient_id = patients.id \
                      AND a.attribute_id = ?{} \
                      AND a.is_deleted = 0 \
                      AND a.local_server_deleted_at IS NULL \
                      AND (\
                        a.string_value LIKE ?{} \
                        OR CAST(a.number_value AS TEXT) LIKE ?{} \
                      )\
                )",
                param_idx,
                param_idx + 1,
                param_idx + 2
            ));
            param_idx += 3;
            final_params.push(Box::new(key.clone()));
            final_params.push(Box::new(search_val.clone()));
            final_params.push(Box::new(search_val));
        }
    }

    let where_clause = final_conditions.join(" AND ");

    // Count query
    let count_sql = format!("SELECT COUNT(*) FROM patients WHERE {}", where_clause);
    let total: i64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        stmt.query_row(
            rusqlite::params_from_iter(
                final_params
                    .iter()
                    .map(|p| p as &dyn rusqlite::types::ToSql),
            ),
            |row| row.get(0),
        )?
    };

    // Data query with pagination
    let query_sql = format!(
        "SELECT {} FROM patients WHERE {} ORDER BY updated_at DESC LIMIT ?{} OFFSET ?{}",
        PATIENT_LIST_COLUMNS,
        where_clause,
        param_idx,
        param_idx + 1
    );
    final_params.push(Box::new(payload.limit));
    final_params.push(Box::new(payload.offset));

    let mut stmt = conn.prepare(&query_sql)?;
    let rows = stmt.query_map(
        rusqlite::params_from_iter(
            final_params
                .iter()
                .map(|p| p as &dyn rusqlite::types::ToSql),
        ),
        row_to_patient_json,
    )?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!(PaginatedResponse {
        data,
        total,
        limit: payload.limit,
        offset: payload.offset,
    }))
}

/// Paginated patient list, filtered by clinic permissions.
pub fn handle_get_patients(
    payload: &GetPatientsListQuery,
    conn: &Connection,
    auth: &AuthContext,
) -> HandlerResult {
    let clinic_ids = auth::permitted_clinic_ids(conn, &auth.user_id, "can_view_history")
        .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

    let mut conditions = vec![
        "is_deleted = 0".to_string(),
        "local_server_deleted_at IS NULL".to_string(),
    ];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_idx = 1usize;

    if clinic_ids.is_empty() {
        conditions.push("(primary_clinic_id IS NULL)".to_string());
    } else {
        let placeholders: Vec<String> = clinic_ids
            .iter()
            .map(|_| {
                let p = format!("?{}", param_idx);
                param_idx += 1;
                p
            })
            .collect();
        conditions.push(format!(
            "(primary_clinic_id IN ({}) OR primary_clinic_id IS NULL)",
            placeholders.join(", ")
        ));
        for cid in &clinic_ids {
            params.push(Box::new(cid.clone()));
        }
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM patients WHERE {}", where_clause);
    let total: i64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        stmt.query_row(
            rusqlite::params_from_iter(params.iter().map(|p| p as &dyn rusqlite::types::ToSql)),
            |row| row.get(0),
        )?
    };

    let query_sql = format!(
        "SELECT {} FROM patients WHERE {} ORDER BY updated_at DESC LIMIT ?{} OFFSET ?{}",
        PATIENT_LIST_COLUMNS,
        where_clause,
        param_idx,
        param_idx + 1
    );
    params.push(Box::new(payload.limit));
    params.push(Box::new(payload.offset));

    let mut stmt = conn.prepare(&query_sql)?;
    let rows = stmt.query_map(
        rusqlite::params_from_iter(params.iter().map(|p| p as &dyn rusqlite::types::ToSql)),
        row_to_patient_json,
    )?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!(PaginatedResponse {
        data,
        total,
        limit: payload.limit,
        offset: payload.offset,
    }))
}

// ============================================================================
// Registration form handlers
// ============================================================================

/// Returns all registration forms (including deleted, for admin use).
pub fn handle_get_all_registration_forms(conn: &Connection) -> HandlerResult {
    let mut stmt = conn.prepare(
        "SELECT id, name, fields, metadata, is_deleted, created_at, updated_at
         FROM registration_forms
         WHERE local_server_deleted_at IS NULL
         ORDER BY updated_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "fields": row.get::<_, String>(2)?,
            "metadata": row.get::<_, String>(3)?,
            "is_deleted": row.get::<_, i64>(4)?,
            "created_at": row.get::<_, i64>(5)?,
            "updated_at": row.get::<_, i64>(6)?,
        }))
    })?;

    let data: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "data": data }))
}

// ============================================================================
// Similar patient search
// ============================================================================

/// Simple Levenshtein distance for ranking name similarity.
/// Levenshtein edit distance over Unicode codepoints (case-insensitive).
fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.to_lowercase().chars().collect();
    let b: Vec<char> = b.to_lowercase().chars().collect();
    let a_len = a.len();
    let b_len = b.len();
    let mut matrix = vec![vec![0usize; b_len + 1]; a_len + 1];

    for i in 0..=a_len {
        matrix[i][0] = i;
    }
    for j in 0..=b_len {
        matrix[0][j] = j;
    }

    for i in 0..a_len {
        for j in 0..b_len {
            let cost = if a[i] == b[j] { 0 } else { 1 };
            matrix[i + 1][j + 1] = (matrix[i][j + 1] + 1)
                .min(matrix[i + 1][j] + 1)
                .min(matrix[i][j] + cost);
        }
    }
    matrix[a_len][b_len]
}

/// Searches for patients with similar given_name and surname.
/// Uses LIKE to narrow candidates, then ranks by Levenshtein distance.
pub fn handle_similar_patients(
    payload: &SimilarPatientsQuery,
    conn: &Connection,
    auth: &AuthContext,
) -> HandlerResult {
    let (_clinic_filter, clinic_ids) =
        clinic_filter_clause(conn, auth).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

    // Build param list: clinic_ids first, then LIKE patterns
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1usize;

    // Clinic filter params
    let clinic_condition = if clinic_ids.is_empty() {
        "(primary_clinic_id IS NULL)".to_string()
    } else {
        let phs: Vec<String> = clinic_ids
            .iter()
            .map(|_| {
                let p = format!("?{idx}");
                idx += 1;
                p
            })
            .collect();
        for cid in &clinic_ids {
            params.push(Box::new(cid.clone()));
        }
        format!(
            "(primary_clinic_id IN ({}) OR primary_clinic_id IS NULL)",
            phs.join(", ")
        )
    };

    // LIKE patterns for given_name and surname (broad match)
    let given_like = format!("%{}%", payload.given_name);
    let surname_like = format!("%{}%", payload.surname);
    params.push(Box::new(given_like));
    let given_idx = idx;
    idx += 1;
    params.push(Box::new(surname_like));
    let surname_idx = idx;

    let sql = format!(
        "SELECT {PATIENT_LIST_COLUMNS} FROM patients
         WHERE is_deleted = 0 AND local_server_deleted_at IS NULL
           AND {clinic_condition}
           AND (given_name LIKE ?{given_idx} OR surname LIKE ?{surname_idx})
         LIMIT 100"
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(param_refs.as_slice(), row_to_patient_json)?;

    let mut candidates: Vec<(usize, serde_json::Value)> = rows
        .filter_map(|r| r.ok())
        .map(|patient| {
            let pg = patient["given_name"].as_str().unwrap_or("");
            let ps = patient["surname"].as_str().unwrap_or("");
            let dist = levenshtein(pg, &payload.given_name) + levenshtein(ps, &payload.surname);
            (dist, patient)
        })
        .collect();

    candidates.sort_by_key(|(dist, _)| *dist);
    let data: Vec<serde_json::Value> = candidates
        .into_iter()
        .take(payload.limit)
        .map(|(_, p)| p)
        .collect();

    Ok(serde_json::json!({ "data": data }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{hash_password_for_test, setup_test_db};
    use proptest::prelude::*;

    // -- Test helpers --

    fn insert_test_clinic(conn: &Connection, id: &str) {
        let now = 1000i64;
        conn.execute(
            "INSERT OR IGNORE INTO clinics (id, name, is_deleted, is_archived, attributes, metadata,
                                  created_at, updated_at,
                                  local_server_created_at, local_server_last_modified_at)
             VALUES (?1, ?2, 0, 0, '[]', '{}', ?3, ?3, ?3, ?3)",
            rusqlite::params![id, format!("Clinic_{}", id), now],
        ).unwrap();
    }

    fn insert_test_user(conn: &Connection, user_id: &str, clinic_id: &str) {
        let now = 1000i64;
        let hashed = hash_password_for_test("test-password");
        insert_test_clinic(conn, clinic_id);

        conn.execute(
            "INSERT OR IGNORE INTO users (id, clinic_id, name, role, email, hashed_password,
                                created_at, updated_at, is_deleted,
                                local_server_created_at, local_server_last_modified_at)
             VALUES (?1, ?2, 'Test User', 'admin', ?4, ?5, ?3, ?3, 0, ?3, ?3)",
            rusqlite::params![
                user_id,
                clinic_id,
                now,
                format!("{}@test.com", user_id),
                hashed
            ],
        )
        .unwrap();
    }

    fn insert_permissions(
        conn: &Connection,
        perm_id: &str,
        user_id: &str,
        clinic_id: &str,
        register: bool,
        view: bool,
        edit: bool,
        delete_records: bool,
    ) {
        let now = 1000i64;
        conn.execute(
            "INSERT INTO user_clinic_permissions
                (id, user_id, clinic_id,
                 can_register_patients, can_view_history, can_edit_records,
                 can_delete_records, is_clinic_admin, can_edit_other_provider_event,
                 can_download_patient_reports, can_prescribe_medications,
                 can_dispense_medications, can_delete_patient_visits,
                 can_delete_patient_records,
                 created_at, updated_at,
                 local_server_created_at, local_server_last_modified_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0, 0, 0, 0, 0, ?8, ?9, ?9, ?9, ?9)",
            rusqlite::params![
                perm_id,
                user_id,
                clinic_id,
                register as i64,
                view as i64,
                edit as i64,
                0i64,
                delete_records as i64,
                now
            ],
        )
        .unwrap();
    }

    fn make_auth(user_id: &str, clinic_id: &str, perms: auth::ClinicPermissions) -> AuthContext {
        AuthContext {
            user_id: user_id.to_string(),
            clinic_id: clinic_id.to_string(),
            role: "admin".to_string(),
            provider_name: "Test User".to_string(),
            clinic_name: "Test Clinic".to_string(),
            permissions: perms,
        }
    }

    fn make_auth_full(user_id: &str, clinic_id: &str) -> AuthContext {
        make_auth(
            user_id,
            clinic_id,
            auth::ClinicPermissions {
                can_register_patients: true,
                can_view_history: true,
                can_edit_records: true,
                can_delete_records: true,
                can_delete_patient_records: true,
                is_clinic_admin: true,
                ..Default::default()
            },
        )
    }

    fn setup_user_with_perms(conn: &Connection) -> AuthContext {
        insert_test_user(conn, "u1", "c1");
        insert_permissions(conn, "perm1", "u1", "c1", true, true, true, true);
        make_auth_full("u1", "c1")
    }

    fn insert_test_registration_form(conn: &Connection) {
        let fields = serde_json::json!([
            { "id": "f1", "position": 0, "column": "given_name", "label": {"en": "First Name"},
              "fieldType": "text", "options": [], "required": true, "baseField": true,
              "visible": true, "isSearchField": true, "deleted": false },
            { "id": "f2", "position": 1, "column": "surname", "label": {"en": "Last Name"},
              "fieldType": "text", "options": [], "required": true, "baseField": true,
              "visible": true, "isSearchField": true, "deleted": false },
            { "id": "f3", "position": 2, "column": "date_of_birth", "label": {"en": "DOB"},
              "fieldType": "date", "options": [], "required": true, "baseField": true,
              "visible": true, "isSearchField": false, "deleted": false },
            { "id": "f4", "position": 3, "column": "sex", "label": {"en": "Sex"},
              "fieldType": "select", "options": [{"en":"male"},{"en":"female"}],
              "required": true, "baseField": true, "visible": true,
              "isSearchField": true, "deleted": false },
            { "id": "f5", "position": 4, "column": "blood_type", "label": {"en": "Blood Type"},
              "fieldType": "select", "options": [{"en":"A+"},{"en":"B+"},{"en":"O+"},{"en":"AB+"}],
              "required": false, "baseField": false, "visible": true,
              "isSearchField": true, "deleted": false },
            { "id": "f6", "position": 5, "column": "height", "label": {"en": "Height (cm)"},
              "fieldType": "number", "options": [], "required": false, "baseField": false,
              "visible": true, "isSearchField": false, "deleted": false }
        ]);
        conn.execute(
            "INSERT INTO registration_forms (id, name, fields, metadata, is_deleted,
                created_at, updated_at,
                local_server_created_at, local_server_last_modified_at)
             VALUES ('rf1', 'Patient Registration', ?1, '{}', 0, 1000, 1000, 1000, 1000)",
            rusqlite::params![fields.to_string()],
        )
        .unwrap();
    }

    fn make_test_patient(id: &str) -> RegisterPatientCommand {
        RegisterPatientCommand {
            patient: PatientRecord {
                id: id.to_string(),
                given_name: format!("Given_{}", id),
                surname: format!("Surname_{}", id),
                date_of_birth: "1990-01-01".to_string(),
                citizenship: "TestCountry".to_string(),
                hometown: "TestTown".to_string(),
                phone: "+1234567890".to_string(),
                sex: "male".to_string(),
                camp: None,
                additional_data: "{}".to_string(),
                metadata: "{}".to_string(),
                photo_url: None,
                government_id: format!("GOV-{}", id),
                external_patient_id: format!("EXT-{}", id),
                primary_clinic_id: None,
                last_modified_by: Some("u1".to_string()),
                created_at: 1000,
                updated_at: 2000,
            },
            additional_attributes: vec![],
        }
    }

    fn make_attr(
        id: &str,
        patient_id: &str,
        attribute_id: &str,
        string_value: Option<&str>,
        number_value: Option<f64>,
    ) -> PatientAdditionalAttribute {
        PatientAdditionalAttribute {
            id: id.to_string(),
            patient_id: patient_id.to_string(),
            attribute_id: attribute_id.to_string(),
            attribute: attribute_id.to_string(),
            number_value,
            string_value: string_value.map(|s| s.to_string()),
            date_value: None,
            boolean_value: None,
            metadata: "{}".to_string(),
            is_deleted: 0,
            created_at: 1000,
            updated_at: 2000,
            last_modified: 2000,
            server_created_at: 1000,
        }
    }

    // -- Registration tests --

    #[test]
    fn register_patient_inserts_into_db() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);
        let cmd = make_test_patient("p1");

        let result = handle_register_patient(&cmd, &conn, &auth).unwrap();
        assert_eq!(result["patient_id"], "p1");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM patients WHERE id = 'p1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn register_patient_with_additional_attributes() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);
        let mut cmd = make_test_patient("p2");
        cmd.additional_attributes
            .push(make_attr("attr1", "p2", "height", None, Some(170.0)));

        let result = handle_register_patient(&cmd, &conn, &auth).unwrap();
        assert_eq!(result["attributes_count"], 1);

        let attr_patient_id: String = conn
            .query_row(
                "SELECT patient_id FROM patient_additional_attributes WHERE id = 'attr1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(attr_patient_id, "p2");
    }

    #[test]
    fn register_patient_upsert_updates() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);
        let cmd = make_test_patient("p3");
        handle_register_patient(&cmd, &conn, &auth).unwrap();

        let mut cmd2 = make_test_patient("p3");
        cmd2.patient.given_name = "UpdatedName".to_string();
        cmd2.patient.updated_at = 3000;
        handle_register_patient(&cmd2, &conn, &auth).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM patients WHERE id = 'p3'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1, "upsert should not duplicate");

        let name: String = conn
            .query_row("SELECT given_name FROM patients WHERE id = 'p3'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(name, "UpdatedName");
    }

    #[test]
    fn register_patient_permission_denied() {
        let conn = setup_test_db();
        insert_test_user(&conn, "u1", "c1");
        // View only — no register permission
        insert_permissions(&conn, "perm1", "u1", "c1", false, true, false, false);
        let auth = make_auth(
            "u1",
            "c1",
            auth::ClinicPermissions {
                can_view_history: true,
                ..Default::default()
            },
        );

        let cmd = make_test_patient("denied1");
        let result = handle_register_patient(&cmd, &conn, &auth);
        assert!(result.is_err());
    }

    // -- Get patient reconstruction tests --

    #[test]
    fn get_patient_reconstructs_base_and_dynamic_fields() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);
        insert_test_registration_form(&conn);

        let mut cmd = make_test_patient("recon1");
        cmd.additional_attributes
            .push(make_attr("a1", "recon1", "f5", Some("B+"), None));
        cmd.additional_attributes
            .push(make_attr("a2", "recon1", "f6", None, Some(175.0)));
        handle_register_patient(&cmd, &conn, &auth).unwrap();

        let query = GetPatientQuery {
            patient_id: "recon1".to_string(),
        };
        let result = handle_get_patient(&query, &conn, &auth).unwrap();

        // Base fields mapped by field id
        assert_eq!(result["values"]["f1"], "Given_recon1");
        assert_eq!(result["values"]["f2"], "Surname_recon1");
        assert_eq!(result["values"]["f4"], "male");

        // Dynamic fields
        assert_eq!(result["values"]["f5"], "B+");
        assert_eq!(result["values"]["f6"], 175.0);

        // Fields array should be present
        assert!(result["fields"].is_array());
    }

    #[test]
    fn get_patient_not_found() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);
        insert_test_registration_form(&conn);

        let query = GetPatientQuery {
            patient_id: "ghost".to_string(),
        };
        let result = handle_get_patient(&query, &conn, &auth);
        assert!(result.is_err());
    }

    // -- Delete tests --

    #[test]
    fn delete_patient_cascades_across_tables() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);

        let mut cmd = make_test_patient("del1");
        cmd.additional_attributes
            .push(make_attr("da1", "del1", "f5", Some("O+"), None));
        handle_register_patient(&cmd, &conn, &auth).unwrap();

        // Insert a visit and event for this patient
        conn.execute(
            "INSERT INTO visits (id, patient_id, clinic_id, provider_id, provider_name,
                check_in_timestamp, metadata, is_deleted, created_at, updated_at,
                local_server_created_at, local_server_last_modified_at)
             VALUES ('v1', 'del1', 'c1', 'u1', 'Dr Test', 1000, '{}', 0, 1000, 2000, 1000, 1000)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO events (id, patient_id, form_id, visit_id, event_type,
                form_data, metadata, is_deleted, created_at, updated_at,
                local_server_created_at, local_server_last_modified_at)
             VALUES ('e1', 'del1', 'f1', 'v1', 'vitals', '{}', '{}', 0, 1000, 2000, 1000, 1000)",
            [],
        )
        .unwrap();

        let delete_cmd = DeletePatientCommand {
            patient_id: "del1".to_string(),
        };
        let result = handle_delete_patient(&delete_cmd, &conn, &auth).unwrap();
        assert_eq!(result["deleted"], true);

        // Verify all related records are soft-deleted
        for (table, col) in &[
            ("patients", "id"),
            ("patient_additional_attributes", "patient_id"),
            ("visits", "patient_id"),
            ("events", "patient_id"),
        ] {
            let sql = format!("SELECT is_deleted FROM {} WHERE {} = 'del1'", table, col);
            let deleted: i64 = conn.query_row(&sql, [], |r| r.get(0)).unwrap();
            assert_eq!(deleted, 1, "{} should be soft-deleted", table);
        }
    }

    #[test]
    fn delete_patient_not_found() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);

        let cmd = DeletePatientCommand {
            patient_id: "ghost".to_string(),
        };
        let result = handle_delete_patient(&cmd, &conn, &auth);
        assert!(result.is_err());
    }

    // -- Government ID check --

    #[test]
    fn check_government_id_exists() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);

        handle_register_patient(&make_test_patient("gov1"), &conn, &auth).unwrap();

        let check = CheckGovernmentIdQuery {
            government_id: "GOV-gov1".to_string(),
        };
        let result = handle_check_government_id(&check, &conn).unwrap();
        assert_eq!(result["exists"], true);
    }

    #[test]
    fn check_government_id_not_exists() {
        let conn = setup_test_db();
        let check = CheckGovernmentIdQuery {
            government_id: "GOV-nope".to_string(),
        };
        let result = handle_check_government_id(&check, &conn).unwrap();
        assert_eq!(result["exists"], false);
    }

    // -- Search tests --

    #[test]
    fn search_patients_by_name() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);

        handle_register_patient(&make_test_patient("s1"), &conn, &auth).unwrap();
        handle_register_patient(&make_test_patient("s2"), &conn, &auth).unwrap();

        let query = SearchPatientsQuery {
            filters: {
                let mut m = serde_json::Map::new();
                m.insert(
                    "given_name".to_string(),
                    serde_json::Value::String("Given_s1".to_string()),
                );
                m
            },
            limit: 20,
            offset: 0,
        };

        let result = handle_search_patients(&query, &conn, &auth).unwrap();
        assert_eq!(result["total"], 1);
        assert_eq!(result["data"][0]["id"], "s1");
    }

    #[test]
    fn search_sex_uses_prefix_match() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);

        let mut male = make_test_patient("sm1");
        male.patient.sex = "male".to_string();
        handle_register_patient(&male, &conn, &auth).unwrap();

        let mut female = make_test_patient("sf1");
        female.patient.sex = "female".to_string();
        handle_register_patient(&female, &conn, &auth).unwrap();

        // Searching for "male" should NOT match "female"
        let query = SearchPatientsQuery {
            filters: {
                let mut m = serde_json::Map::new();
                m.insert(
                    "sex".to_string(),
                    serde_json::Value::String("male".to_string()),
                );
                m
            },
            limit: 20,
            offset: 0,
        };

        let result = handle_search_patients(&query, &conn, &auth).unwrap();
        assert_eq!(result["total"], 1);
        assert_eq!(result["data"][0]["id"], "sm1");
    }

    #[test]
    fn search_by_additional_attribute() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);

        let mut cmd = make_test_patient("pa1");
        cmd.additional_attributes
            .push(make_attr("a1", "pa1", "blood_type", Some("AB+"), None));
        handle_register_patient(&cmd, &conn, &auth).unwrap();

        handle_register_patient(&make_test_patient("pa2"), &conn, &auth).unwrap();

        let query = SearchPatientsQuery {
            filters: {
                let mut m = serde_json::Map::new();
                m.insert(
                    "blood_type".to_string(),
                    serde_json::Value::String("AB".to_string()),
                );
                m
            },
            limit: 20,
            offset: 0,
        };

        let result = handle_search_patients(&query, &conn, &auth).unwrap();
        assert_eq!(result["total"], 1);
        assert_eq!(result["data"][0]["id"], "pa1");
    }

    #[test]
    fn search_returns_all_core_columns() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);

        let mut cmd = make_test_patient("cols1");
        cmd.patient.citizenship = "Jordan".to_string();
        cmd.patient.hometown = "Amman".to_string();
        handle_register_patient(&cmd, &conn, &auth).unwrap();

        let query = SearchPatientsQuery {
            filters: {
                let mut m = serde_json::Map::new();
                m.insert(
                    "id".to_string(),
                    serde_json::Value::String("cols1".to_string()),
                );
                m
            },
            limit: 20,
            offset: 0,
        };

        let result = handle_search_patients(&query, &conn, &auth).unwrap();
        let patient = &result["data"][0];
        // Verify new columns are present
        assert_eq!(patient["citizenship"], "Jordan");
        assert_eq!(patient["hometown"], "Amman");
        assert!(patient.get("created_at").is_some());
        assert!(patient.get("primary_clinic_id").is_some());
    }

    // -- List tests --

    #[test]
    fn get_patients_paginated_and_sorted() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);

        for (i, ts) in [1000i64, 3000, 2000].iter().enumerate() {
            let mut cmd = make_test_patient(&format!("pg{}", i));
            cmd.patient.updated_at = *ts;
            handle_register_patient(&cmd, &conn, &auth).unwrap();
        }

        let query = GetPatientsListQuery {
            limit: 2,
            offset: 0,
        };
        let result = handle_get_patients(&query, &conn, &auth).unwrap();
        assert_eq!(result["total"], 3);
        assert_eq!(result["data"].as_array().unwrap().len(), 2);
        assert_eq!(result["data"][0]["id"], "pg1");
    }

    #[test]
    fn get_patients_empty_db() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);

        let query = GetPatientsListQuery {
            limit: 20,
            offset: 0,
        };
        let result = handle_get_patients(&query, &conn, &auth).unwrap();
        assert_eq!(result["total"], 0);
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    // -- Clinic permission filtering --

    #[test]
    fn get_patients_filters_by_clinic_permission() {
        let conn = setup_test_db();
        insert_test_user(&conn, "u1", "c1");
        insert_test_clinic(&conn, "c2");
        // u1 can view c1 only
        insert_permissions(&conn, "perm1", "u1", "c1", true, true, true, true);
        let auth = make_auth_full("u1", "c1");

        // Patient in c1 — visible
        let mut cmd1 = make_test_patient("vis1");
        cmd1.patient.primary_clinic_id = Some("c1".to_string());
        handle_register_patient(&cmd1, &conn, &auth).unwrap();

        // Patient in c2 — not visible to u1
        conn.execute(
            "INSERT INTO patients (id, given_name, surname, date_of_birth, citizenship, hometown,
                phone, sex, additional_data, metadata, is_deleted, government_id,
                external_patient_id, primary_clinic_id, created_at, updated_at,
                local_server_created_at, local_server_last_modified_at)
             VALUES ('vis2', 'Hidden', 'Patient', '1990-01-01', '', '', '', 'male', '{}', '{}',
                     0, 'GOV-vis2', '', 'c2', 1000, 2000, 1000, 1000)",
            [],
        )
        .unwrap();

        // Patient with NULL clinic — visible to all
        let mut cmd3 = make_test_patient("vis3");
        cmd3.patient.primary_clinic_id = None;
        handle_register_patient(&cmd3, &conn, &auth).unwrap();

        let query = GetPatientsListQuery {
            limit: 20,
            offset: 0,
        };
        let result = handle_get_patients(&query, &conn, &auth).unwrap();
        assert_eq!(
            result["total"], 2,
            "should see c1 patient + NULL clinic patient"
        );
    }

    // -- All registration forms --

    #[test]
    fn get_all_registration_forms() {
        let conn = setup_test_db();
        insert_test_registration_form(&conn);

        conn.execute(
            "INSERT INTO registration_forms (id, name, fields, metadata, is_deleted,
                created_at, updated_at,
                local_server_created_at, local_server_last_modified_at)
             VALUES ('rf2', 'Old Form', '[]', '{}', 1, 500, 500, 500, 500)",
            [],
        )
        .unwrap();

        let result = handle_get_all_registration_forms(&conn).unwrap();
        let data = result["data"].as_array().unwrap();
        assert_eq!(data.len(), 2, "should return all forms including deleted");
    }

    // -- Levenshtein unit tests --

    #[test]
    fn levenshtein_identical() {
        assert_eq!(levenshtein("alice", "alice"), 0);
    }

    #[test]
    fn levenshtein_empty_strings() {
        assert_eq!(levenshtein("", ""), 0);
    }

    #[test]
    fn levenshtein_one_empty() {
        assert_eq!(levenshtein("", "abc"), 3);
        assert_eq!(levenshtein("abc", ""), 3);
    }

    #[test]
    fn levenshtein_single_edit() {
        assert_eq!(levenshtein("cat", "bat"), 1); // substitution
        assert_eq!(levenshtein("cat", "cats"), 1); // insertion
        assert_eq!(levenshtein("cats", "cat"), 1); // deletion
    }

    #[test]
    fn levenshtein_case_insensitive() {
        assert_eq!(levenshtein("Alice", "alice"), 0);
        assert_eq!(levenshtein("SMITH", "smith"), 0);
    }

    #[test]
    fn levenshtein_completely_different() {
        assert_eq!(levenshtein("abc", "xyz"), 3);
    }

    #[test]
    fn levenshtein_unicode() {
        assert_eq!(levenshtein("café", "cafe"), 1);
        assert_eq!(levenshtein("über", "uber"), 1);
    }

    // -- Similar patients tests --

    fn register_named_patient(
        conn: &Connection,
        auth: &AuthContext,
        id: &str,
        given: &str,
        surname: &str,
    ) {
        let mut cmd = make_test_patient(id);
        cmd.patient.given_name = given.to_string();
        cmd.patient.surname = surname.to_string();
        handle_register_patient(&cmd, conn, auth).unwrap();
    }

    #[test]
    fn similar_patients_finds_exact_match() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);
        register_named_patient(&conn, &auth, "p1", "Alice", "Smith");
        register_named_patient(&conn, &auth, "p2", "Bob", "Jones");

        let query = SimilarPatientsQuery {
            given_name: "Alice".to_string(),
            surname: "Smith".to_string(),
            limit: 10,
        };
        let result = handle_similar_patients(&query, &conn, &auth).unwrap();
        let data = result["data"].as_array().unwrap();
        assert!(!data.is_empty());
        // Exact match should be first (distance 0)
        assert_eq!(data[0]["given_name"], "Alice");
        assert_eq!(data[0]["surname"], "Smith");
    }

    #[test]
    fn similar_patients_ranks_by_distance() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);
        register_named_patient(&conn, &auth, "p1", "Alice", "Smith");
        register_named_patient(&conn, &auth, "p2", "Alica", "Smyth"); // close
        register_named_patient(&conn, &auth, "p3", "Alison", "Smithson"); // farther

        let query = SimilarPatientsQuery {
            given_name: "Alice".to_string(),
            surname: "Smith".to_string(),
            limit: 10,
        };
        let result = handle_similar_patients(&query, &conn, &auth).unwrap();
        let data = result["data"].as_array().unwrap();
        assert!(data.len() >= 2);
        // Exact match first, then closest edit distance
        assert_eq!(data[0]["id"], "p1");
    }

    #[test]
    fn similar_patients_respects_limit() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);
        for i in 0..5 {
            register_named_patient(
                &conn,
                &auth,
                &format!("p{i}"),
                "Alice",
                &format!("Surname{i}"),
            );
        }

        let query = SimilarPatientsQuery {
            given_name: "Alice".to_string(),
            surname: "Surname0".to_string(),
            limit: 2,
        };
        let result = handle_similar_patients(&query, &conn, &auth).unwrap();
        assert_eq!(result["data"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn similar_patients_empty_when_no_match() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);
        register_named_patient(&conn, &auth, "p1", "Alice", "Smith");

        let query = SimilarPatientsQuery {
            given_name: "Zzzzz".to_string(),
            surname: "Xxxxx".to_string(),
            limit: 10,
        };
        let result = handle_similar_patients(&query, &conn, &auth).unwrap();
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    #[test]
    fn similar_patients_excludes_soft_deleted() {
        let conn = setup_test_db();
        let auth = setup_user_with_perms(&conn);
        register_named_patient(&conn, &auth, "p1", "Alice", "Smith");
        conn.execute(
            "UPDATE patients SET local_server_deleted_at = 9999 WHERE id = 'p1'",
            [],
        )
        .unwrap();

        let query = SimilarPatientsQuery {
            given_name: "Alice".to_string(),
            surname: "Smith".to_string(),
            limit: 10,
        };
        let result = handle_similar_patients(&query, &conn, &auth).unwrap();
        assert!(result["data"].as_array().unwrap().is_empty());
    }

    // -- Property-based tests --

    proptest! {
        /// Levenshtein is symmetric: dist(a,b) == dist(b,a)
        #[test]
        fn levenshtein_symmetric(a in "[a-z]{0,8}", b in "[a-z]{0,8}") {
            prop_assert_eq!(levenshtein(&a, &b), levenshtein(&b, &a));
        }

        /// Levenshtein is bounded: dist(a,b) <= max(char_count(a), char_count(b))
        #[test]
        fn levenshtein_bounded(a in "[a-z]{0,10}", b in "[a-z]{0,10}") {
            let dist = levenshtein(&a, &b);
            prop_assert!(dist <= a.chars().count().max(b.chars().count()));
        }

        /// Levenshtein works on arbitrary Unicode — symmetric + bounded by char count
        #[test]
        fn levenshtein_unicode_symmetric_and_bounded(
            a in "\\PC{0,8}",
            b in "\\PC{0,8}",
        ) {
            prop_assert_eq!(levenshtein(&a, &b), levenshtein(&b, &a));
            let dist = levenshtein(&a, &b);
            prop_assert!(dist <= a.chars().count().max(b.chars().count()));
        }

        /// Levenshtein satisfies triangle inequality: dist(a,c) <= dist(a,b) + dist(b,c)
        #[test]
        fn levenshtein_triangle_inequality(
            a in "[a-z]{0,6}",
            b in "[a-z]{0,6}",
            c in "[a-z]{0,6}",
        ) {
            let ab = levenshtein(&a, &b);
            let bc = levenshtein(&b, &c);
            let ac = levenshtein(&a, &c);
            prop_assert!(ac <= ab + bc, "triangle inequality violated: d({a},{c})={ac} > d({a},{b})={ab} + d({b},{c})={bc}");
        }
    }

    // DB-heavy property tests get fewer cases to avoid 256× full schema setup
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(25))]

        #[test]
        fn register_then_get_roundtrip(n in 1u32..20) {
            let conn = setup_test_db();
            let auth = setup_user_with_perms(&conn);

            for i in 0..n {
                let cmd = make_test_patient(&format!("rt{}", i));
                handle_register_patient(&cmd, &conn, &auth).unwrap();
            }

            let query = GetPatientsListQuery { limit: 100, offset: 0 };
            let result = handle_get_patients(&query, &conn, &auth).unwrap();
            prop_assert_eq!(result["total"].as_i64().unwrap(), n as i64);
            prop_assert_eq!(result["data"].as_array().unwrap().len(), n as usize);
        }

        #[test]
        fn search_attribute_returns_only_matching(
            total in 2u32..10,
            tagged_ratio in 0.1f64..0.9,
        ) {
            let conn = setup_test_db();
            let auth = setup_user_with_perms(&conn);
            let tagged_count = ((total as f64 * tagged_ratio).ceil() as u32).max(1).min(total - 1);

            for i in 0..total {
                let pid = format!("prop{}", i);
                let mut cmd = make_test_patient(&pid);
                if i < tagged_count {
                    cmd.additional_attributes.push(make_attr(
                        &format!("pattr{}", i), &pid, "test_tag", Some("yes"), None,
                    ));
                }
                handle_register_patient(&cmd, &conn, &auth).unwrap();
            }

            let query = SearchPatientsQuery {
                filters: {
                    let mut m = serde_json::Map::new();
                    m.insert("test_tag".to_string(), serde_json::Value::String("yes".to_string()));
                    m
                },
                limit: 100,
                offset: 0,
            };
            let result = handle_search_patients(&query, &conn, &auth).unwrap();
            prop_assert_eq!(result["total"].as_i64().unwrap(), tagged_count as i64);
        }
    }
}
