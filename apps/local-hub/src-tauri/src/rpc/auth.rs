// Auth context for RPC handlers.
//
// Verifies JWT tokens and loads per-user clinic permissions from SQLite.
// Pure functions — no globals, no side effects.

use crate::crypto::jwt;
use rusqlite::Connection;

/// Authenticated user context, available to handlers after JWT verification.
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: String,
    pub clinic_id: String,
    pub role: String,
    pub provider_name: String,
    pub clinic_name: String,
    pub permissions: ClinicPermissions,
}

/// Mirrors the 11 boolean permission columns from user_clinic_permissions.
#[derive(Debug, Clone, Default)]
pub struct ClinicPermissions {
    pub can_register_patients: bool,
    pub can_view_history: bool,
    pub can_edit_records: bool,
    pub can_delete_records: bool,
    pub is_clinic_admin: bool,
    pub can_edit_other_provider_event: bool,
    pub can_download_patient_reports: bool,
    pub can_prescribe_medications: bool,
    pub can_dispense_medications: bool,
    pub can_delete_patient_visits: bool,
    pub can_delete_patient_records: bool,
}

/// Verifies a JWT token and loads the user's clinic permissions.
///
/// Returns an AuthContext on success, or a human-readable error string.
pub fn authenticate(token: &str, jwt_key: &[u8], conn: &Connection) -> Result<AuthContext, String> {
    let claims =
        jwt::verify(token, jwt_key).map_err(|e| format!("JWT verification failed: {}", e))?;

    let permissions = load_permissions(conn, &claims.sub, &claims.clinic_id)?;
    let provider_name = load_provider_name(conn, &claims.sub)?;
    let clinic_name = load_clinic_name(conn, &claims.clinic_id)?;

    Ok(AuthContext {
        user_id: claims.sub,
        clinic_id: claims.clinic_id,
        role: claims.role,
        provider_name,
        clinic_name,
        permissions,
    })
}

/// Checks that the auth context has a specific permission, returning an error if not.
pub fn require_permission(
    ctx: &AuthContext,
    perm: fn(&ClinicPermissions) -> bool,
    perm_name: &str,
) -> Result<(), String> {
    if perm(&ctx.permissions) {
        Ok(())
    } else {
        Err(format!(
            "User '{}' lacks permission '{}' for clinic '{}'",
            ctx.user_id, perm_name, ctx.clinic_id
        ))
    }
}

/// Checks a permission against a specific clinic, which may differ from the auth clinic.
///
/// For patient operations the target clinic is the patient's primary_clinic_id,
/// not necessarily the clinic the user logged into. Falls back to the auth clinic
/// when `target_clinic_id` is None (patients with no assigned clinic).
pub fn require_clinic_permission(
    conn: &Connection,
    auth: &AuthContext,
    target_clinic_id: Option<&str>,
    perm: fn(&ClinicPermissions) -> bool,
    perm_name: &str,
) -> Result<(), String> {
    let clinic_id = target_clinic_id.unwrap_or(&auth.clinic_id);

    // Fast path: if target matches auth clinic, reuse already-loaded permissions
    if clinic_id == auth.clinic_id {
        return require_permission(auth, perm, perm_name);
    }

    let perms = load_permissions(conn, &auth.user_id, clinic_id)?;
    if perm(&perms) {
        Ok(())
    } else {
        Err(format!(
            "User '{}' lacks permission '{}' for clinic '{}'",
            auth.user_id, perm_name, clinic_id
        ))
    }
}

/// Returns all clinic IDs where the user has the given permission.
///
/// Used to build WHERE primary_clinic_id IN (...) filters for list/search queries.
/// The `perm_column` must be one of the known permission column names.
pub fn permitted_clinic_ids(
    conn: &Connection,
    user_id: &str,
    perm_column: &str,
) -> Result<Vec<String>, String> {
    // Only allow known permission columns to prevent SQL injection
    const ALLOWED: &[&str] = &[
        "can_register_patients",
        "can_view_history",
        "can_edit_records",
        "can_delete_records",
        "is_clinic_admin",
        "can_edit_other_provider_event",
        "can_download_patient_reports",
        "can_prescribe_medications",
        "can_dispense_medications",
        "can_delete_patient_visits",
        "can_delete_patient_records",
    ];
    if !ALLOWED.contains(&perm_column) {
        return Err(format!("Unknown permission column: {}", perm_column));
    }

    let sql = format!(
        "SELECT clinic_id FROM user_clinic_permissions
         WHERE user_id = ?1 AND {} = 1
           AND local_server_deleted_at IS NULL",
        perm_column
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![user_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn load_permissions(
    conn: &Connection,
    user_id: &str,
    clinic_id: &str,
) -> Result<ClinicPermissions, String> {
    conn.query_row(
        "SELECT can_register_patients, can_view_history, can_edit_records,
                can_delete_records, is_clinic_admin, can_edit_other_provider_event,
                can_download_patient_reports, can_prescribe_medications,
                can_dispense_medications, can_delete_patient_visits,
                can_delete_patient_records
         FROM user_clinic_permissions
         WHERE user_id = ?1 AND clinic_id = ?2
           AND local_server_deleted_at IS NULL
         LIMIT 1",
        rusqlite::params![user_id, clinic_id],
        |row| {
            Ok(ClinicPermissions {
                can_register_patients: row.get::<_, i64>(0)? != 0,
                can_view_history: row.get::<_, i64>(1)? != 0,
                can_edit_records: row.get::<_, i64>(2)? != 0,
                can_delete_records: row.get::<_, i64>(3)? != 0,
                is_clinic_admin: row.get::<_, i64>(4)? != 0,
                can_edit_other_provider_event: row.get::<_, i64>(5)? != 0,
                can_download_patient_reports: row.get::<_, i64>(6)? != 0,
                can_prescribe_medications: row.get::<_, i64>(7)? != 0,
                can_dispense_medications: row.get::<_, i64>(8)? != 0,
                can_delete_patient_visits: row.get::<_, i64>(9)? != 0,
                can_delete_patient_records: row.get::<_, i64>(10)? != 0,
            })
        },
    )
    .map_err(|e| format!("Failed to load permissions for user '{}': {}", user_id, e))
}

fn load_provider_name(conn: &Connection, user_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT name FROM users WHERE id = ?1 AND is_deleted = 0 AND local_server_deleted_at IS NULL",
        rusqlite::params![user_id],
        |row| row.get::<_, String>(0),
    )
    .map_err(|e| format!("Failed to load provider name for user '{}': {}", user_id, e))
}

fn load_clinic_name(conn: &Connection, clinic_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT COALESCE(name, '') FROM clinics WHERE id = ?1 AND is_deleted = 0",
        rusqlite::params![clinic_id],
        |row| row.get::<_, String>(0),
    )
    .map_err(|e| {
        format!(
            "Failed to load clinic name for clinic '{}': {}",
            clinic_id, e
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::jwt::{self, JwtClaims};
    use crate::test_utils::{hash_password_for_test, setup_test_db};

    const TEST_KEY: &[u8] = b"test-jwt-signing-key-32-bytes!!";

    /// Inserts a clinic, user, and full permissions into the test DB.
    fn insert_user_with_permissions(conn: &Connection, user_id: &str, clinic_id: &str) {
        let now = 1000i64;
        let hashed = hash_password_for_test("test-password");

        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted, is_archived, attributes, metadata,
                                  created_at, updated_at,
                                  local_server_created_at, local_server_last_modified_at)
             VALUES (?1, 'Test Clinic', 0, 0, '[]', '{}', ?2, ?2, ?2, ?2)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO users (id, clinic_id, name, role, email, hashed_password, created_at, updated_at,
                                is_deleted, local_server_created_at, local_server_last_modified_at)
             VALUES (?1, ?2, 'Test User', 'admin', 'test@example.com', ?4, ?3, ?3, 0, ?3, ?3)",
            rusqlite::params![user_id, clinic_id, now, hashed],
        )
        .unwrap();

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
             VALUES ('perm1', ?1, ?2, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0, ?3, ?3, ?3, ?3)",
            rusqlite::params![user_id, clinic_id, now],
        )
        .unwrap();
    }

    #[test]
    fn authenticate_valid_token() {
        let conn = setup_test_db();
        insert_user_with_permissions(&conn, "u1", "c1");

        let claims = JwtClaims::new("u1".into(), "c1".into(), "admin".into());
        let token = jwt::sign(&claims, TEST_KEY).unwrap();

        let ctx = authenticate(&token, TEST_KEY, &conn).unwrap();
        assert_eq!(ctx.user_id, "u1");
        assert_eq!(ctx.clinic_id, "c1");
        assert_eq!(ctx.provider_name, "Test User");
        assert_eq!(ctx.clinic_name, "Test Clinic");
        assert!(ctx.permissions.can_register_patients);
        assert!(ctx.permissions.can_view_history);
        assert!(!ctx.permissions.can_delete_records);
    }

    #[test]
    fn authenticate_expired_token() {
        let conn = setup_test_db();
        insert_user_with_permissions(&conn, "u1", "c1");

        let claims = JwtClaims {
            sub: "u1".into(),
            clinic_id: "c1".into(),
            role: "admin".into(),
            iat: 1000,
            exp: 1001,
        };
        let token = jwt::sign(&claims, TEST_KEY).unwrap();

        let result = authenticate(&token, TEST_KEY, &conn);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("expired"));
    }

    #[test]
    fn authenticate_no_permissions_row() {
        let conn = setup_test_db();
        // Insert clinic and user but no permissions
        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted, is_archived, attributes, metadata,
                                  created_at, updated_at,
                                  local_server_created_at, local_server_last_modified_at)
             VALUES ('c1', 'Test Clinic', 0, 0, '[]', '{}', 1000, 1000, 1000, 1000)",
            [],
        )
        .unwrap();
        let hashed = hash_password_for_test("test-password");
        conn.execute(
            "INSERT INTO users (id, clinic_id, name, role, email, hashed_password, created_at, updated_at,
                                is_deleted, local_server_created_at, local_server_last_modified_at)
             VALUES ('u1', 'c1', 'Test', 'admin', 'test@example.com', ?1, 1000, 1000, 0, 1000, 1000)",
            rusqlite::params![hashed],
        )
        .unwrap();

        let claims = JwtClaims::new("u1".into(), "c1".into(), "admin".into());
        let token = jwt::sign(&claims, TEST_KEY).unwrap();

        let result = authenticate(&token, TEST_KEY, &conn);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to load permissions"));
    }

    #[test]
    fn require_permission_granted() {
        let ctx = AuthContext {
            user_id: "u1".into(),
            clinic_id: "c1".into(),
            role: "admin".into(),
            provider_name: "Test User".into(),
            clinic_name: "Test Clinic".into(),
            permissions: ClinicPermissions {
                can_register_patients: true,
                ..Default::default()
            },
        };
        let result = require_permission(&ctx, |p| p.can_register_patients, "can_register_patients");
        assert!(result.is_ok());
    }

    #[test]
    fn require_clinic_permission_same_clinic() {
        let conn = setup_test_db();
        insert_user_with_permissions(&conn, "u1", "c1");

        let claims = JwtClaims::new("u1".into(), "c1".into(), "admin".into());
        let token = jwt::sign(&claims, TEST_KEY).unwrap();
        let ctx = authenticate(&token, TEST_KEY, &conn).unwrap();

        // Same clinic as auth → should use fast path
        let result = require_clinic_permission(
            &conn,
            &ctx,
            Some("c1"),
            |p| p.can_register_patients,
            "can_register_patients",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn require_clinic_permission_different_clinic() {
        let conn = setup_test_db();
        insert_user_with_permissions(&conn, "u1", "c1");

        // Add permissions for a second clinic (view only, no register)
        let now = 1000i64;
        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted, is_archived, attributes, metadata,
                                  created_at, updated_at,
                                  local_server_created_at, local_server_last_modified_at)
             VALUES ('c2', 'Clinic 2', 0, 0, '[]', '{}', ?1, ?1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();
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
             VALUES ('perm2', 'u1', 'c2', 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?1, ?1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();

        let claims = JwtClaims::new("u1".into(), "c1".into(), "admin".into());
        let token = jwt::sign(&claims, TEST_KEY).unwrap();
        let ctx = authenticate(&token, TEST_KEY, &conn).unwrap();

        // Can view at c2
        let result = require_clinic_permission(
            &conn,
            &ctx,
            Some("c2"),
            |p| p.can_view_history,
            "can_view_history",
        );
        assert!(result.is_ok());

        // Cannot register at c2
        let result = require_clinic_permission(
            &conn,
            &ctx,
            Some("c2"),
            |p| p.can_register_patients,
            "can_register_patients",
        );
        assert!(result.is_err());
    }

    #[test]
    fn require_clinic_permission_null_falls_back_to_home() {
        let conn = setup_test_db();
        insert_user_with_permissions(&conn, "u1", "c1");

        let claims = JwtClaims::new("u1".into(), "c1".into(), "admin".into());
        let token = jwt::sign(&claims, TEST_KEY).unwrap();
        let ctx = authenticate(&token, TEST_KEY, &conn).unwrap();

        // None clinic → falls back to auth.clinic_id ("c1")
        let result = require_clinic_permission(
            &conn,
            &ctx,
            None,
            |p| p.can_edit_records,
            "can_edit_records",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn permitted_clinic_ids_returns_matching() {
        let conn = setup_test_db();
        insert_user_with_permissions(&conn, "u1", "c1");

        let now = 1000i64;
        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted, is_archived, attributes, metadata,
                                  created_at, updated_at,
                                  local_server_created_at, local_server_last_modified_at)
             VALUES ('c2', 'Clinic 2', 0, 0, '[]', '{}', ?1, ?1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();
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
             VALUES ('perm2', 'u1', 'c2', 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?1, ?1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();

        // u1 has can_view_history at both c1 and c2
        let ids = permitted_clinic_ids(&conn, "u1", "can_view_history").unwrap();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"c1".to_string()));
        assert!(ids.contains(&"c2".to_string()));

        // u1 has can_register_patients only at c1
        let ids = permitted_clinic_ids(&conn, "u1", "can_register_patients").unwrap();
        assert_eq!(ids.len(), 1);
        assert_eq!(ids[0], "c1");
    }

    #[test]
    fn permitted_clinic_ids_rejects_unknown_column() {
        let conn = setup_test_db();
        let result = permitted_clinic_ids(&conn, "u1", "drop_table_users");
        assert!(result.is_err());
    }

    #[test]
    fn require_permission_denied() {
        let ctx = AuthContext {
            user_id: "u1".into(),
            clinic_id: "c1".into(),
            role: "viewer".into(),
            provider_name: "Test User".into(),
            clinic_name: "Test Clinic".into(),
            permissions: ClinicPermissions::default(),
        };
        let result = require_permission(&ctx, |p| p.can_edit_records, "can_edit_records");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("lacks permission"));
    }

    #[test]
    fn soft_deleted_permissions_ignored() {
        let conn = setup_test_db();
        let now = 1000i64;

        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted, is_archived, attributes, metadata,
                                  created_at, updated_at,
                                  local_server_created_at, local_server_last_modified_at)
             VALUES ('c1', 'Test Clinic', 0, 0, '[]', '{}', ?1, ?1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();

        let hashed = hash_password_for_test("test-password");
        conn.execute(
            "INSERT INTO users (id, clinic_id, name, role, email, hashed_password, created_at, updated_at,
                                is_deleted, local_server_created_at, local_server_last_modified_at)
             VALUES ('u1', 'c1', 'Test', 'admin', 'test@example.com', ?2, ?1, ?1, 0, ?1, ?1)",
            rusqlite::params![now, hashed],
        )
        .unwrap();

        // Insert soft-deleted permissions
        conn.execute(
            "INSERT INTO user_clinic_permissions
                (id, user_id, clinic_id,
                 can_register_patients, can_view_history, can_edit_records,
                 can_delete_records, is_clinic_admin, can_edit_other_provider_event,
                 can_download_patient_reports, can_prescribe_medications,
                 can_dispense_medications, can_delete_patient_visits,
                 can_delete_patient_records,
                 created_at, updated_at,
                 local_server_created_at, local_server_last_modified_at,
                 local_server_deleted_at)
             VALUES ('perm1', 'u1', 'c1', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, ?1, ?1, ?1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();

        let claims = JwtClaims::new("u1".into(), "c1".into(), "admin".into());
        let token = jwt::sign(&claims, TEST_KEY).unwrap();

        let result = authenticate(&token, TEST_KEY, &conn);
        assert!(
            result.is_err(),
            "soft-deleted permissions should not be loaded"
        );
    }
}
