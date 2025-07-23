#!/usr/bin/env python3

import os
import sys
import argparse
import subprocess
import csv


MIGRATIONS_HEAD = "./db/migrations/migration.head"
MIGRATIONS_LOG = "./db/migrations/migrations_log.csv"
MIGRATIONS_DIR = "./db/migrations"


def get_current_head():
    """Get the current migration head"""
    if not os.path.exists(MIGRATIONS_HEAD):
        return None

    with open(MIGRATIONS_HEAD, "r") as f:
        return f.read().strip()


def get_migration_details(migration_name):
    """Get details about a specific migration from the log"""
    if not os.path.exists(MIGRATIONS_LOG):
        return None

    with open(MIGRATIONS_LOG, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["version"] == migration_name:
                return row
    return None


def get_pending_migrations(current_head):
    """Get list of migrations that come after current head"""
    try:
        # Get all migration files sorted
        result = subprocess.run(
            ["find", MIGRATIONS_DIR, "-name", "*.sql", "-type", "f"],
            capture_output=True,
            text=True,
        )
        all_files = sorted(
            [
                os.path.basename(f).replace(".sql", "")
                for f in result.stdout.strip().split("\n")
                if f
            ]
        )

        if not current_head or current_head not in all_files:
            return all_files

        # Find index of current head and return everything after it
        head_index = all_files.index(current_head)
        return all_files[head_index + 1 :]
    except:
        return []


def show_basic_head():
    """Show basic head information"""
    current_head = get_current_head()

    if not current_head:
        print("🚫 No migration head found")
        print()
        print("This usually means:")
        print("  • No migrations have been successfully applied yet")
        print("  • The migration.head file has been deleted")
        print()
        print("To run migrations: python scripts/run_migrations.py")
        return

    print("🎯 Current Migration Head")
    print("=" * 25)
    print(f"Latest applied migration: {current_head}")


def show_verbose_head():
    """Show detailed head information"""
    current_head = get_current_head()

    if not current_head:
        show_basic_head()
        return

    show_basic_head()

    # Show migration details from log
    print(f"\n📋 Head Migration Details")
    print("=" * 25)

    details = get_migration_details(current_head)
    if details:
        print(f"Migration ID: {details['id']}")
        print(f"Version: {details['version']}")
        print(f"Status: {details['status']}")
    else:
        print("⚠️  Migration details not found in log file")

    # Check if migration file exists
    print(f"\n📁 Migration File Status")
    print("=" * 24)

    migration_file = os.path.join(MIGRATIONS_DIR, f"{current_head}.sql")
    if os.path.exists(migration_file):
        print(f"✅ Migration file exists: {migration_file}")

        # Get file stats using wc
        try:
            size_result = subprocess.run(
                ["wc", "-c", migration_file], capture_output=True, text=True
            )
            lines_result = subprocess.run(
                ["wc", "-l", migration_file], capture_output=True, text=True
            )

            size = size_result.stdout.split()[0]
            lines = lines_result.stdout.split()[0]

            print(f"   Size: {size} bytes")
            print(f"   Lines: {lines}")
        except:
            pass
    else:
        print(f"❌ Migration file not found: {migration_file}")

    # Show migration status
    print(f"\n📊 Migration Status")
    print("=" * 18)

    # Get total migration files using find
    try:
        result = subprocess.run(
            ["find", MIGRATIONS_DIR, "-name", "*.sql", "-type", "f"],
            capture_output=True,
            text=True,
        )
        total_files = len([f for f in result.stdout.strip().split("\n") if f])

        pending = get_pending_migrations(current_head)
        pending_count = len(pending)

        if total_files > 0:
            # Calculate position
            applied_count = total_files - pending_count
            print(f"Position: {applied_count} of {total_files} migrations")

            if pending_count > 0:
                print(f"Pending migrations: {pending_count}")
                print(f"\n📋 Next migrations to be applied:")

                # Show first 5 pending migrations
                for migration in pending[:5]:
                    print(f"  • {migration}")

                if pending_count > 5:
                    print(f"  ... and {pending_count - 5} more")
            else:
                print("✅ All migrations are up to date")

    except Exception as e:
        print(f"⚠️  Could not determine migration status: {e}")


def main():
    parser = argparse.ArgumentParser(description="Show current migration head")
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Show additional details about the head migration",
    )

    args = parser.parse_args()

    if args.verbose:
        show_verbose_head()
    else:
        show_basic_head()

    print(
        f"\n💡 Tip: Use --verbose for more details or python scripts/view_migrations_log.py to see full history"
    )


if __name__ == "__main__":
    main()
