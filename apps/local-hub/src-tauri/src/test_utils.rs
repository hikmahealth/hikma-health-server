#[cfg(test)]
use rusqlite::Connection;

/// Opens an in-memory SQLite DB and runs the production migrations.
/// Returns a ready-to-use connection with the full schema.
#[cfg(test)]
pub fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory DB");
    crate::migrations::run_migrations(&mut conn).expect("migrations");
    conn
}

/// Hashes a password with bcrypt for test fixtures.
/// Uses minimum cost (4) — these tests verify application logic, not bcrypt strength.
#[cfg(test)]
pub fn hash_password_for_test(password: &str) -> String {
    bcrypt::hash(password, 4).unwrap()
}
