// Crypto module for SQLCipher encryption key management
// Provides secure key derivation, storage, and rotation capabilities

pub mod jwt;
pub mod pairing;

use rusqlite::Connection;
use std::path::Path;

/// Key derivation parameters for PBKDF2
const PBKDF2_ITERATIONS: u32 = 600_000;
const KEY_LENGTH: usize = 32; // 256-bit key for SQLCipher

/// Derives an encryption key from the user's passphrase using PBKDF2
/// The salt is stored in Stronghold for consistency across sessions
pub fn derive_key_from_passphrase(passphrase: &str, salt: &[u8]) -> Vec<u8> {
    use std::num::NonZeroU32;

    let iterations = NonZeroU32::new(PBKDF2_ITERATIONS).unwrap();
    let mut key = vec![0u8; KEY_LENGTH];

    ring::pbkdf2::derive(
        ring::pbkdf2::PBKDF2_HMAC_SHA256,
        iterations,
        salt,
        passphrase.as_bytes(),
        &mut key,
    );

    key
}

/// Generates a cryptographically secure random salt
pub fn generate_salt() -> Vec<u8> {
    use ring::rand::{SecureRandom, SystemRandom};

    let rng = SystemRandom::new();
    let mut salt = vec![0u8; 32];
    rng.fill(&mut salt).expect("Failed to generate random salt");
    salt
}

/// Converts a key to the hex string format required by SQLCipher PRAGMA
pub fn key_to_hex(key: &[u8]) -> String {
    format!("x'{}'", hex::encode(key))
}

/// Opens an encrypted SQLite database connection with the given key.
///
/// Uses raw SQL for the PRAGMA key statement because SQLCipher hex keys
/// (format `x'...'`) must appear as literal SQL, not as bound parameters.
pub fn open_encrypted_db(db_path: &Path, key: &[u8]) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Apply the encryption key using raw PRAGMA (hex keys need literal SQL)
    let key_hex = key_to_hex(key);
    let pragma_sql = format!("PRAGMA key = \"{}\";", key_hex);
    conn.execute_batch(&pragma_sql)
        .map_err(|e| format!("Failed to set encryption key: {}", e))?;

    // Verify the key by reading from sqlite_master.
    // NOTE: must use query_row (not execute) because SELECT returns rows —
    // rusqlite's execute() errors on any statement that produces SQLITE_ROW.
    conn.query_row("SELECT count(*) FROM sqlite_master;", [], |row| {
        row.get::<_, i64>(0)
    })
    .map_err(|_| "Invalid encryption key or corrupted database".to_string())?;

    Ok(conn)
}

/// Re-encrypts the database with a new key (key rotation).
/// Must be called on an already-opened encrypted connection.
pub fn rotate_key(conn: &Connection, new_key: &[u8]) -> Result<(), String> {
    let new_key_hex = key_to_hex(new_key);
    let pragma_sql = format!("PRAGMA rekey = \"{}\";", new_key_hex);

    conn.execute_batch(&pragma_sql)
        .map_err(|e| format!("Failed to rotate encryption key: {}", e))?;

    Ok(())
}

/// Encrypts an existing unencrypted database.
/// Creates a new encrypted copy and replaces the original.
pub fn encrypt_existing_database(db_path: &Path, key: &[u8]) -> Result<(), String> {
    let temp_path = db_path.with_extension("db.encrypted");

    // Open the unencrypted source database
    let source_conn =
        Connection::open(db_path).map_err(|e| format!("Failed to open source database: {}", e))?;

    // Attach an encrypted database and export data.
    // The hex key must be double-quoted for SQLCipher's ATTACH KEY syntax.
    let key_hex = key_to_hex(key);
    let attach_sql = format!(
        "ATTACH DATABASE '{}' AS encrypted KEY \"{}\";",
        temp_path.to_string_lossy(),
        key_hex
    );

    source_conn
        .execute_batch(&attach_sql)
        .map_err(|e| format!("Failed to attach encrypted database: {}", e))?;

    // Export schema and data to encrypted database
    source_conn
        .execute_batch("SELECT sqlcipher_export('encrypted');")
        .map_err(|e| format!("Failed to export to encrypted database: {}", e))?;

    source_conn
        .execute_batch("DETACH DATABASE encrypted;")
        .map_err(|e| format!("Failed to detach encrypted database: {}", e))?;

    drop(source_conn);

    // Replace original with encrypted version
    std::fs::rename(&temp_path, db_path)
        .map_err(|e| format!("Failed to replace database with encrypted version: {}", e))?;

    Ok(())
}

/// Checks if a database file is encrypted by inspecting the file header.
///
/// SQLite databases start with the 16-byte magic string "SQLite format 3\0".
/// SQLCipher-encrypted databases have a randomized header (the first page is
/// encrypted), so the magic string will be absent. This approach is reliable
/// regardless of whether the linked SQLite library is plain SQLite or SQLCipher.
pub fn is_database_encrypted(db_path: &Path) -> bool {
    if !db_path.exists() {
        return false;
    }

    let header = match std::fs::read(db_path) {
        Ok(data) if data.len() >= 16 => data,
        // Empty or very small files are not valid databases
        _ => return false,
    };

    // Standard SQLite magic: "SQLite format 3\0"
    let sqlite_magic = b"SQLite format 3\0";
    header[..16] != sqlite_magic[..]
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // PBKDF2 with 600k iterations is intentionally slow (~200-800ms per call).
    // Limit property tests that invoke it to a small number of cases.
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(5))]

        /// Property: key derivation is deterministic for same inputs
        #[test]
        fn key_derivation_deterministic(passphrase in "\\PC+", salt in prop::collection::vec(any::<u8>(), 16..64)) {
            let key1 = derive_key_from_passphrase(&passphrase, &salt);
            let key2 = derive_key_from_passphrase(&passphrase, &salt);
            prop_assert_eq!(key1, key2);
        }

        /// Property: different passphrases produce different keys
        #[test]
        fn different_passphrases_different_keys(
            pass1 in "\\PC{1,50}",
            pass2 in "\\PC{1,50}",
            salt in prop::collection::vec(any::<u8>(), 32..33)
        ) {
            prop_assume!(pass1 != pass2);
            let key1 = derive_key_from_passphrase(&pass1, &salt);
            let key2 = derive_key_from_passphrase(&pass2, &salt);
            prop_assert_ne!(key1, key2);
        }

        /// Property: key length is always 32 bytes (256 bits)
        #[test]
        fn key_length_consistent(passphrase in "\\PC*", salt in prop::collection::vec(any::<u8>(), 1..100)) {
            let key = derive_key_from_passphrase(&passphrase, &salt);
            prop_assert_eq!(key.len(), KEY_LENGTH);
        }

        /// Property: different salts produce different keys for same passphrase
        #[test]
        fn different_salts_different_keys(
            passphrase in "\\PC{1,20}",
            salt1 in prop::collection::vec(any::<u8>(), 32..33),
            salt2 in prop::collection::vec(any::<u8>(), 32..33),
        ) {
            prop_assume!(salt1 != salt2);
            let key1 = derive_key_from_passphrase(&passphrase, &salt1);
            let key2 = derive_key_from_passphrase(&passphrase, &salt2);
            prop_assert_ne!(key1, key2);
        }
    }

    // These property tests are fast (no PBKDF2), so default case count is fine.
    proptest! {
        /// Property: salt generation produces unique values
        #[test]
        fn salt_unique(_dummy in 0..100i32) {
            let salt1 = generate_salt();
            let salt2 = generate_salt();
            prop_assert_ne!(salt1, salt2);
        }

        /// Property: hex encoding produces valid SQLCipher key format
        #[test]
        fn hex_format_valid(key in prop::collection::vec(any::<u8>(), 32..33)) {
            let hex_key = key_to_hex(&key);
            prop_assert!(hex_key.starts_with("x'"));
            prop_assert!(hex_key.ends_with("'"));
            prop_assert_eq!(hex_key.len(), 2 + 64 + 1); // x' + 64 hex chars + '
        }

        /// Property: hex encoding roundtrips — inner hex is valid lowercase hex
        #[test]
        fn hex_encoding_contains_only_valid_chars(key in prop::collection::vec(any::<u8>(), 1..64)) {
            let hex_key = key_to_hex(&key);
            let inner = &hex_key[2..hex_key.len()-1]; // strip x' and '
            prop_assert!(inner.chars().all(|c| c.is_ascii_hexdigit()),
                "hex inner '{}' contains non-hex chars", inner);
            prop_assert_eq!(inner.len(), key.len() * 2);
        }
    }

    // ========================================================================
    // File-based DB encryption tests
    // ========================================================================

    #[test]
    fn salt_length_is_32_bytes() {
        let salt = generate_salt();
        assert_eq!(salt.len(), 32);
    }

    #[test]
    fn open_encrypted_db_create_and_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let key = derive_key_from_passphrase("test-pass", b"test-salt-32-bytes-long-enough!!");

        // Create encrypted DB
        let conn = open_encrypted_db(&db_path, &key).unwrap();
        conn.execute("CREATE TABLE t (id TEXT PRIMARY KEY)", [])
            .unwrap();
        conn.execute("INSERT INTO t VALUES ('hello')", []).unwrap();
        drop(conn);

        // Reopen with same key — should work
        let conn2 = open_encrypted_db(&db_path, &key).unwrap();
        let val: String = conn2
            .query_row("SELECT id FROM t", [], |r| r.get(0))
            .unwrap();
        assert_eq!(val, "hello");
    }

    #[test]
    fn open_encrypted_db_wrong_key_fails() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let key = derive_key_from_passphrase("correct", b"salt-32-bytes-long-enough-here!!");
        let wrong_key = derive_key_from_passphrase("wrong", b"salt-32-bytes-long-enough-here!!");

        let conn = open_encrypted_db(&db_path, &key).unwrap();
        conn.execute("CREATE TABLE t (id TEXT)", []).unwrap();
        drop(conn);

        let result = open_encrypted_db(&db_path, &wrong_key);
        assert!(
            result.is_err(),
            "wrong key should fail to open encrypted DB"
        );
    }

    #[test]
    fn is_database_encrypted_detects_encrypted() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("encrypted.db");
        let key = derive_key_from_passphrase("pass", b"salt-32-bytes-long-enough-here!!");

        let conn = open_encrypted_db(&db_path, &key).unwrap();
        conn.execute("CREATE TABLE t (id TEXT)", []).unwrap();
        drop(conn);

        assert!(is_database_encrypted(&db_path));
    }

    #[test]
    fn is_database_encrypted_detects_unencrypted() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("plain.db");

        let conn = Connection::open(&db_path).unwrap();
        conn.execute("CREATE TABLE t (id TEXT)", []).unwrap();
        drop(conn);

        assert!(!is_database_encrypted(&db_path));
    }

    #[test]
    fn is_database_encrypted_nonexistent_returns_false() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("nonexistent.db");
        assert!(!is_database_encrypted(&db_path));
    }

    #[test]
    fn encrypt_existing_database_works() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("to_encrypt.db");
        let key = derive_key_from_passphrase("pass", b"salt-32-bytes-long-enough-here!!");

        // Create unencrypted DB with data
        let conn = Connection::open(&db_path).unwrap();
        conn.execute("CREATE TABLE t (id TEXT PRIMARY KEY, val TEXT)", [])
            .unwrap();
        conn.execute("INSERT INTO t VALUES ('k1', 'v1')", [])
            .unwrap();
        drop(conn);

        assert!(!is_database_encrypted(&db_path));

        // Encrypt it
        encrypt_existing_database(&db_path, &key).unwrap();

        assert!(is_database_encrypted(&db_path));

        // Verify data survived encryption
        let conn2 = open_encrypted_db(&db_path, &key).unwrap();
        let val: String = conn2
            .query_row("SELECT val FROM t WHERE id = 'k1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(val, "v1");
    }

    #[test]
    fn rotate_key_allows_reopening_with_new_key() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("rotate.db");
        let old_key = derive_key_from_passphrase("old", b"salt-32-bytes-long-enough-here!!");
        let new_key = derive_key_from_passphrase("new", b"salt-32-bytes-long-enough-here!!");

        // Create encrypted DB
        let conn = open_encrypted_db(&db_path, &old_key).unwrap();
        conn.execute("CREATE TABLE t (id TEXT PRIMARY KEY)", [])
            .unwrap();
        conn.execute("INSERT INTO t VALUES ('rotated')", [])
            .unwrap();

        // Rotate key
        rotate_key(&conn, &new_key).unwrap();
        drop(conn);

        // Old key should fail
        let result = open_encrypted_db(&db_path, &old_key);
        assert!(result.is_err(), "old key should fail after rotation");

        // New key should work
        let conn2 = open_encrypted_db(&db_path, &new_key).unwrap();
        let val: String = conn2
            .query_row("SELECT id FROM t", [], |r| r.get(0))
            .unwrap();
        assert_eq!(val, "rotated");
    }

    #[test]
    fn key_to_hex_empty_key() {
        let hex = key_to_hex(&[]);
        assert_eq!(hex, "x''");
    }

    #[test]
    fn key_to_hex_known_value() {
        let hex = key_to_hex(&[0xDE, 0xAD, 0xBE, 0xEF]);
        assert_eq!(hex, "x'deadbeef'");
    }
}
