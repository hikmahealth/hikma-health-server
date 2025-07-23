#!/usr/bin/env python3

import os
import sys
import subprocess
import csv
import glob
import argparse
from pathlib import Path

MIGRATIONS_DIR = "./db/migrations"
MIGRATIONS_LOG = "./db/migrations_log.csv"
MIGRATIONS_HEAD = "./db/migration.head"


def load_env_file(env_file=".env"):
    """Load environment variables from file"""
    if not os.path.exists(env_file):
        print(f"Warning: Environment file {env_file} not found")
        return

    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()


def get_database_url():
    """Get database URL from environment"""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL environment variable is not set")
        sys.exit(1)
    return db_url


def create_migrations_log():
    """Create CSV log file if it doesn't exist"""
    if not os.path.exists(MIGRATIONS_LOG):
        with open(MIGRATIONS_LOG, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["id", "version", "status"])


def get_next_id():
    """Get next available ID for migration log"""
    if not os.path.exists(MIGRATIONS_LOG):
        return 1

    try:
        result = subprocess.run(
            ["tail", "-n", "1", MIGRATIONS_LOG], capture_output=True, text=True
        )
        last_line = result.stdout.strip()
        if last_line and "," in last_line:
            last_id = last_line.split(",")[0]
            if last_id.isdigit():
                return int(last_id) + 1
    except:
        pass

    return 1


def get_applied_migrations():
    """Get list of successfully applied migrations"""
    if not os.path.exists(MIGRATIONS_LOG):
        return set()

    applied = set()
    with open(MIGRATIONS_LOG, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["status"] == "success":
                applied.add(row["version"])
    return applied


def mark_migration_applied(migration_name, status="success"):
    """Mark migration as applied in CSV log"""
    next_id = get_next_id()
    with open(MIGRATIONS_LOG, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([next_id, migration_name, status])

    # Update head file for successful migrations
    if status == "success":
        with open(MIGRATIONS_HEAD, "w") as f:
            f.write(migration_name)


def is_migration_empty(migration_file):
    """Check if migration file is empty or contains only comments"""
    try:
        result = subprocess.run(["grep", "-q", "^[^-[:space:]]", migration_file])
        return result.returncode != 0
    except:
        return True


def run_sql_file(db_url, migration_file):
    """Execute SQL file using psql"""
    try:
        result = subprocess.run(
            ["psql", db_url, "-f", migration_file], capture_output=True, text=True
        )
        if result.returncode == 0:
            return True, None
        else:
            return False, result.stderr
    except Exception as e:
        return False, str(e)


def get_migration_files():
    """Get sorted list of migration files"""
    pattern = os.path.join(MIGRATIONS_DIR, "*.sql")
    files = glob.glob(pattern)
    return sorted(files)


def run_migration(migration_file, dry_run=False):
    """Run a single migration"""
    migration_name = os.path.basename(migration_file).replace(".sql", "")
    print(f"Running migration: {migration_name}")

    if dry_run:
        print(f"  [DRY RUN] Would execute: {migration_file}")
        return True

    # Check if migration is empty
    if is_migration_empty(migration_file):
        print(f"  ⏭ Skipping (empty migration): {migration_name}")
        mark_migration_applied(migration_name, "skipped")
        return True

    # Execute migration
    db_url = get_database_url()
    success, error = run_sql_file(db_url, migration_file)

    if success:
        mark_migration_applied(migration_name, "success")
        print(f"  ✓ Successfully applied migration: {migration_name}")
        return True
    else:
        mark_migration_applied(migration_name, "failed")
        print(f"  ✗ Failed to apply migration: {migration_name}")
        if error:
            print(f"  Error: {error}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Run database migrations")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be executed without running",
    )
    parser.add_argument(
        "--env-file", default=".env", help="Environment file to load (default: .env)"
    )

    args = parser.parse_args()

    print("Starting database migrations...")
    print(f"Migrations directory: {MIGRATIONS_DIR}")

    # Load environment
    load_env_file(args.env_file)

    if args.dry_run:
        print("DRY RUN MODE - No changes will be made")
    else:
        # Check for psql
        try:
            subprocess.run(["which", "psql"], check=True, capture_output=True)
        except subprocess.CalledProcessError:
            print(
                "Error: psql command not found. Please install PostgreSQL client tools."
            )
            sys.exit(1)

        # Verify database connection
        get_database_url()
        create_migrations_log()

    # Get migration files
    migration_files = get_migration_files()
    if not migration_files:
        print("No migration files found")
        return

    # Get already applied migrations
    applied_migrations = get_applied_migrations() if not args.dry_run else set()

    print(f"Found {len(migration_files)} migration files")

    applied_count = 0
    skipped_count = 0

    for i, migration_file in enumerate(migration_files, 1):
        migration_name = os.path.basename(migration_file).replace(".sql", "")
        print(f"[{i}/{len(migration_files)}] Processing: {migration_name}")

        # Skip if already applied
        if migration_name in applied_migrations:
            print(f"  ⏭ Skipping (already applied): {migration_name}")
            skipped_count += 1
            continue

        # Run migration
        if run_migration(migration_file, args.dry_run):
            applied_count += 1
        else:
            print("Migration failed, stopping execution")
            sys.exit(1)

    print(f"\nMigration summary:")
    print(f"  Total migrations: {len(migration_files)}")
    print(f"  Applied: {applied_count}")
    print(f"  Skipped: {skipped_count}")

    if args.dry_run:
        print(
            "\nThis was a dry run. To actually apply migrations, run without --dry-run flag."
        )
    else:
        print("\n✓ All migrations completed successfully!")


if __name__ == "__main__":
    main()
