use rusqlite::Connection;
use std::env;
use std::path::PathBuf;

use crate::crypto;

pub fn get_database_path() -> PathBuf {
    let mut exe = env::current_exe().expect("Failed to get current exe path");
    exe.set_file_name("hikma-health.db");
    exe
}

/// Opens the database with encryption using the provided key
pub fn open_encrypted(db_path: &PathBuf, key: &[u8]) -> Result<Connection, String> {
    crypto::open_encrypted_db(db_path, key)
}

/// Creates an encrypted database if it doesn't exist
pub fn create_encrypted(db_path: &PathBuf, key: &[u8]) -> Result<(), String> {
    if !db_path.exists() {
        let conn = crypto::open_encrypted_db(db_path, key)?;
        println!("Created encrypted db at {:?}", db_path);
        drop(conn);
    } else {
        println!("Database already exists at {:?}", db_path);
    }
    Ok(())
}

/// Checks if the database at the given path is encrypted
pub fn is_encrypted(db_path: &PathBuf) -> bool {
    crypto::is_database_encrypted(db_path)
}

/// Encrypts an existing unencrypted database
pub fn encrypt_existing(db_path: &PathBuf, key: &[u8]) -> Result<(), String> {
    crypto::encrypt_existing_database(db_path, key)
}

/// Rotates the encryption key on an open database connection
pub fn rotate_encryption_key(conn: &Connection, new_key: &[u8]) -> Result<(), String> {
    crypto::rotate_key(conn, new_key)
}

#[allow(dead_code)]
pub fn create(db_path: &PathBuf) {
    if !db_path.exists() {
        match Connection::open(db_path) {
            Ok(_) => println!("Create db success at {:?}", db_path),
            Err(error) => panic!("error creating database: {}", error),
        }
    } else {
        println!("Database already exists at {:?}", db_path);
    }
}

#[allow(dead_code)]
pub fn get_database() -> String {
    let db_path = get_database_path();
    db_path
        .into_os_string()
        .into_string()
        .unwrap_or_else(|_| "hikma-health.db".to_string())
}
