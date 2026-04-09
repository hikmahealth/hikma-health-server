// Login RPC handler.
//
// Authenticates a user by email + password (bcrypt verification),
// then issues a JWT for subsequent authenticated RPC calls.

use crate::crypto::jwt;
use rusqlite::Connection;

use super::HandlerResult;

/// Handles the "login" command: verifies email + password, issues JWT.
///
/// Expected data: `{ "email": "...", "password": "..." }`
/// Returns: `{ "token": "...", "user_id": "...", "clinic_id": "...", "role": "...", "provider_name": "...", "clinic_name": "..." }`
pub fn handle_login(data: &serde_json::Value, conn: &Connection, jwt_key: &[u8]) -> HandlerResult {
    let email = data
        .get("email")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'email' field")?;
    let password = data
        .get("password")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'password' field")?;

    log::debug!("Login attempt for email: {}", email);

    // Look up user by email (non-deleted only), joining clinics for clinic_name
    let (user_id, clinic_id, role, hashed_password, provider_name, clinic_name) = conn
        .query_row(
            "SELECT u.id, u.clinic_id, u.role, u.hashed_password, u.name,
                    COALESCE(c.name, '')
             FROM users u
             LEFT JOIN clinics c ON c.id = u.clinic_id
             WHERE u.email = ?1 AND u.is_deleted = 0 AND u.local_server_deleted_at IS NULL",
            rusqlite::params![email],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .map_err(|e| {
            log::debug!("User lookup failed for email '{}': {}", email, e);
            "Invalid email or password"
        })?;

    log::debug!(
        "User found: user_id={}, clinic_id={}, role={}",
        user_id,
        clinic_id,
        role
    );

    // Verify bcrypt password hash
    let valid = bcrypt::verify(password, &hashed_password).map_err(|e| {
        log::debug!("Bcrypt verification error for user_id={}: {}", user_id, e);
        "Invalid email or password"
    })?;
    if !valid {
        log::debug!("Password mismatch for user_id={}", user_id);
        return Err("Invalid email or password".into());
    }

    // Issue JWT
    let claims = jwt::JwtClaims::new(user_id.clone(), clinic_id.clone(), role.clone());
    let token = jwt::sign(&claims, jwt_key).map_err(|e| {
        log::error!("Failed to issue JWT for user_id={}: {}", user_id, e);
        format!("Failed to issue token: {}", e)
    })?;

    log::debug!("Login successful for user_id={}, role={}", user_id, role);

    Ok(serde_json::json!({
        "token": token,
        "user_id": user_id,
        "clinic_id": clinic_id,
        "role": role,
        "provider_name": provider_name,
        "clinic_name": clinic_name,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::setup_test_db;

    const TEST_KEY: &[u8] = b"test-jwt-signing-key-32-bytes!!";

    /// Hashes a password with bcrypt for test fixtures.
    fn hash_password(password: &str) -> String {
        bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap()
    }

    fn insert_user_with_password(conn: &Connection, email: &str, password: &str) -> String {
        let hashed = hash_password(password);
        let now = 1000i64;
        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted, is_archived, attributes, metadata,
                                  created_at, updated_at,
                                  local_server_created_at, local_server_last_modified_at)
             VALUES ('c1', 'Test Clinic', 0, 0, '[]', '{}', ?1, ?1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO users (id, clinic_id, name, role, email, hashed_password,
                                created_at, updated_at, is_deleted,
                                local_server_created_at, local_server_last_modified_at)
             VALUES ('u1', 'c1', 'Test User', 'admin', ?1, ?2, ?3, ?3, 0, ?3, ?3)",
            rusqlite::params![email, hashed, now],
        )
        .unwrap();
        hashed
    }

    #[test]
    fn login_success() {
        let conn = setup_test_db();
        insert_user_with_password(&conn, "user@test.com", "correct-password");

        let data = serde_json::json!({
            "email": "user@test.com",
            "password": "correct-password"
        });
        let result = handle_login(&data, &conn, TEST_KEY).unwrap();
        assert!(result.get("token").is_some());
        assert_eq!(result["user_id"], "u1");
        assert_eq!(result["clinic_id"], "c1");
        assert_eq!(result["role"], "admin");
        assert_eq!(result["provider_name"], "Test User");
        assert_eq!(result["clinic_name"], "Test Clinic");

        // Verify the issued token is valid
        let token = result["token"].as_str().unwrap();
        let claims = crate::crypto::jwt::verify(token, TEST_KEY).unwrap();
        assert_eq!(claims.sub, "u1");
    }

    #[test]
    fn login_wrong_password() {
        let conn = setup_test_db();
        insert_user_with_password(&conn, "user@test.com", "correct-password");

        let data = serde_json::json!({
            "email": "user@test.com",
            "password": "wrong-password"
        });
        let result = handle_login(&data, &conn, TEST_KEY);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Invalid email or password"));
    }

    #[test]
    fn login_nonexistent_user() {
        let conn = setup_test_db();

        let data = serde_json::json!({
            "email": "nobody@test.com",
            "password": "anything"
        });
        let result = handle_login(&data, &conn, TEST_KEY);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Invalid email or password"));
    }

    #[test]
    fn login_invalid_hash_format() {
        let conn = setup_test_db();
        // Insert user with an invalid hash — simulates corrupted or incompatible data
        conn.execute(
            "INSERT INTO users (id, clinic_id, name, role, email, hashed_password,
                                created_at, updated_at, is_deleted,
                                local_server_created_at, local_server_last_modified_at)
             VALUES ('u1', 'c1', 'Test', 'admin', 'user@test.com', 'not-a-valid-hash',
                     1000, 1000, 0, 1000, 1000)",
            [],
        )
        .unwrap();

        let data = serde_json::json!({
            "email": "user@test.com",
            "password": "anything"
        });
        let result = handle_login(&data, &conn, TEST_KEY);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Invalid email or password"));
    }

    #[test]
    fn login_missing_email_field() {
        let conn = setup_test_db();
        let data = serde_json::json!({ "password": "pass" });
        let result = handle_login(&data, &conn, TEST_KEY);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Missing 'email'"));
    }

    #[test]
    fn login_missing_password_field() {
        let conn = setup_test_db();
        let data = serde_json::json!({ "email": "a@b.com" });
        let result = handle_login(&data, &conn, TEST_KEY);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Missing 'password'"));
    }

    #[test]
    fn login_deleted_user_rejected() {
        let conn = setup_test_db();
        let hashed = hash_password("pass");
        conn.execute(
            "INSERT INTO users (id, clinic_id, name, role, email, hashed_password,
                                created_at, updated_at, is_deleted,
                                local_server_created_at, local_server_last_modified_at)
             VALUES ('u1', 'c1', 'Test', 'admin', 'del@test.com', ?1, 1000, 1000, 1, 1000, 1000)",
            rusqlite::params![hashed],
        )
        .unwrap();

        let data = serde_json::json!({
            "email": "del@test.com",
            "password": "pass"
        });
        let result = handle_login(&data, &conn, TEST_KEY);
        assert!(result.is_err());
    }

    #[test]
    fn login_soft_deleted_user_rejected() {
        let conn = setup_test_db();
        let hashed = hash_password("pass");
        conn.execute(
            "INSERT INTO users (id, clinic_id, name, role, email, hashed_password,
                                created_at, updated_at, is_deleted,
                                local_server_created_at, local_server_last_modified_at,
                                local_server_deleted_at)
             VALUES ('u1', 'c1', 'Test', 'admin', 'soft@test.com', ?1, 1000, 1000, 0, 1000, 1000, 1000)",
            rusqlite::params![hashed],
        )
        .unwrap();

        let data = serde_json::json!({
            "email": "soft@test.com",
            "password": "pass"
        });
        let result = handle_login(&data, &conn, TEST_KEY);
        assert!(result.is_err());
    }
}
