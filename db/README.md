## About this folder

Contains details from the DB related experimentation.
Understanding the contents:
- `schema.sql` - SQL file containing DDL+DML needed to create the latest database HikmaHealth is supporting. Can be thought of the database schema as a result of collapsing the `src/db/migrations`. Created using `prisma migrate diff` (see the Justfile)
- `schema.prisma` - The prisma model representing the database in `schema.sql`. With a couple of modifications (@ally: we should take a look an confirm these changes before running them to DB)
- `migrations/to_latest.sql` - SQL file containing DDL+DML scripts to migration the from current db to latest database (represented by `schema.prisma`)
