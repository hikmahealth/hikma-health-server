-- SQL file created on 2025-04-01 00:22:55.705506
-- Message: make resources syncable
-- Alembic Revision ID: 86ebf93a362c

ALTER TABLE resources
ADD COLUMN is_deleted boolean default false;
