# to apply the latest schema changes to the production database.
# This makes sure the we aleays have an updated working copy
update_schema:
    npx dotenv -e .env -- npx prisma db push --skip-generate --schema=./db/schema.prisma

# generates the migrations script needed to migrate the database from old database state (i.e. whatever you have),
# to the latest schema Hikma Health supports (represented by the schema.[prisma/sql] files)
migrate_from psql_url message: update_schema
    mkdir -p db/migrations
    npx dotenv -e .env -- npx prisma migrate diff --from-url {{psql_url}} --to-schema-datasource ./db/schema.prisma --script > db/migrations/$(date +%Y%m%d)_$(message | tr ' ' '_').sql
