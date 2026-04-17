// Database migrations using refinery
// Runs on encrypted SQLite database after user unlocks with passphrase

use refinery::embed_migrations;
use rusqlite::Connection;

// Embed migrations from the migrations directory
// Refinery expects files named V{version}__{description}.sql
embed_migrations!("src/migrations/sql");

/// Runs all pending migrations on the provided database connection
pub fn run_migrations(conn: &mut Connection) -> Result<(), String> {
    migrations::runner()
        .run(conn)
        .map_err(|e| format!("Failed to run migrations: {}", e))?;

    println!("Migrations completed successfully");
    Ok(())
}

/// Check if migrations have been run (useful for status checks)
pub fn get_applied_migrations(conn: &mut Connection) -> Result<Vec<String>, String> {
    let applied = migrations::runner()
        .get_applied_migrations(conn)
        .map_err(|e| format!("Failed to get applied migrations: {}", e))?;

    Ok(applied.iter().map(|m| m.name().to_string()).collect())
}
