#!/bin/bash

# Get the message from command line argument or prompt for it
if [ $# -eq 0 ]; then
    echo "Usage: $0 \"your message here\""
    echo "Or: $0 your message words"
    exit 1
fi

# Check if SOURCE_DATABASE_URL is defined
if [ -z "$SOURCE_DATABASE_URL" ]; then
    echo "Error: SOURCE_DATABASE_URL environment variable is not set"
    exit 1
fi

# Join all arguments with spaces, trim leading/trailing spaces, then replace spaces with underscores
message=$(echo "$*" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr ' ' '_')

# Get current date in YYYYMMDD format
current_date=$(date +%Y%m%d)

# Create filename
filename="${current_date}_${message}.sql"

# Folder to contain the migration folder
migration_folder="${FOLDER:-./db/migrations}"
mkdir -p $migration_folder

latest_migration_file="$migration_folder/$filename"

# Echo content into the file (you can customize what gets written)
echo "-- SQL file created on $(date)" > "$latest_migration_file"
echo "-- Message: $*" >> "$latest_migration_file"
echo "" >> "$latest_migration_file"
npx dotenv -e .env -- npx prisma migrate diff --from-url $SOURCE_DATABASE_URL --to-schema-datasource ./db/schema.prisma --script >> "$latest_migration_file"

echo "created migrations file: $latest_migration_file"
