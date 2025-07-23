#!/usr/bin/env python3

import os
import sys
import csv
import argparse
import subprocess
from pathlib import Path


MIGRATIONS_LOG = "./db/migrations/migrations_log.csv"
MIGRATIONS_HEAD = "./db/migrations/migration.head"


def get_migration_count():
    """Get total migration count using wc"""
    if not os.path.exists(MIGRATIONS_LOG):
        return 0
    try:
        result = subprocess.run(
            ["wc", "-l", MIGRATIONS_LOG], capture_output=True, text=True
        )
        # Subtract 1 for header line
        return max(0, int(result.stdout.split()[0]) - 1)
    except:
        return 0


def get_status_counts():
    """Get counts by status using grep"""
    if not os.path.exists(MIGRATIONS_LOG):
        return {"success": 0, "failed": 0, "skipped": 0}

    counts = {}
    for status in ["success", "failed", "skipped"]:
        try:
            result = subprocess.run(
                ["grep", "-c", f",{status}$", MIGRATIONS_LOG],
                capture_output=True,
                text=True,
            )
            counts[status] = int(result.stdout.strip()) if result.returncode == 0 else 0
        except:
            counts[status] = 0

    return counts


def read_migrations_log():
    """Read and return all migration entries"""
    if not os.path.exists(MIGRATIONS_LOG):
        return []

    migrations = []
    with open(MIGRATIONS_LOG, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            migrations.append(row)
    return migrations


def filter_migrations(migrations, status=None, recent=None):
    """Filter migrations by status and/or recent count"""
    filtered = migrations

    if status:
        filtered = [m for m in filtered if m["status"] == status]

    if recent:
        filtered = filtered[-recent:]

    return filtered


def display_migrations(migrations):
    """Display migrations in a formatted table"""
    if not migrations:
        print("No migrations found matching the criteria.")
        return

    print(f"{'ID':<8} {'Migration Version':<40} {'Status':<10}")
    print("-" * 60)

    for migration in migrations:
        status = migration["status"]
        # Add color coding
        if status == "success":
            status_colored = f"\033[32m{status}\033[0m"  # Green
        elif status == "failed":
            status_colored = f"\033[31m{status}\033[0m"  # Red
        elif status == "skipped":
            status_colored = f"\033[33m{status}\033[0m"  # Yellow
        else:
            status_colored = status

        print(f"{migration['id']:<8} {migration['version']:<40} {status_colored}")


def show_summary():
    """Show migration summary statistics"""
    print("\n📊 Migration Summary")
    print("=" * 20)

    total = get_migration_count()
    counts = get_status_counts()

    print(f"Total migrations: {total}")
    print(f"✅ Successful: {counts['success']}")
    print(f"❌ Failed: {counts['failed']}")
    print(f"⏭️  Skipped: {counts['skipped']}")

    if total > 0:
        success_rate = (counts["success"] * 100) // total
        print(f"Success rate: {success_rate}%")

    # Show current head
    if os.path.exists(MIGRATIONS_HEAD):
        with open(MIGRATIONS_HEAD, "r") as f:
            current_head = f.read().strip()
        if current_head:
            print(f"\nCurrent head: {current_head}")


def show_recent_activity():
    """Show recent migration activity"""
    migrations = read_migrations_log()
    recent = migrations[-5:] if migrations else []

    print("\n🕒 Recent Activity (Last 5 migrations)")
    print("=" * 35)

    if not recent:
        print("No recent activity found.")
        return

    for migration in recent:
        status = migration["status"]
        status_icon = {
            "success": "✅",
            "failed": "❌",
            "skipped": "⏭️",
        }.get(status, "")

        print(f"  {status_icon} {migration['version']} - ID: {migration['id']}")


def main():
    parser = argparse.ArgumentParser(description="View migration log history")
    parser.add_argument(
        "--status",
        choices=["success", "failed", "skipped"],
        help="Filter by status",
    )
    parser.add_argument(
        "--recent", type=int, help="Show only the N most recent migrations"
    )
    parser.add_argument(
        "--summary", action="store_true", help="Show summary statistics"
    )

    args = parser.parse_args()

    if not os.path.exists(MIGRATIONS_LOG):
        print("Migration log file not found.")
        print("No migrations have been run yet, or the log file has been deleted.")
        return

    print("📋 Migration History")
    print("=" * 20)

    # Read all migrations
    migrations = read_migrations_log()

    # Apply filters
    filtered_migrations = filter_migrations(
        migrations, status=args.status, recent=args.recent
    )

    # Display migrations
    display_migrations(filtered_migrations)

    # Show summary if requested or if no specific filters applied
    if args.summary or (not args.status and not args.recent):
        show_summary()

    # Show recent activity if no specific filters applied
    if not args.status and not args.recent and not args.summary:
        show_recent_activity()

    print(f"\n💡 Tip: Use --help to see all available options")


if __name__ == "__main__":
    main()
