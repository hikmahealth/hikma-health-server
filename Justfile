# applies the schema.prisma to working database
update_schema:
    npx dotenv -e .env -- npx prisma db push --skip-generate --schema=./db/schema.prisma

# generates the migrations script needed to migrate the database from old database state (i.e. whatever you have),
# to the latest schema Hikma Health supports (represented by the schema.[prisma/sql] files)
migrate_from args: update_schema
    mkdir -p db/migrations
    npx dotenv -e .env -- npx prisma migrate diff --from-url {{args}} --to-schema-datasource ./db/schema.prisma --script > db/migrations/to_latest.sql
    echo "Would run 'db/migrations/to_latest.sql' on {{args}}."
