-- SQL file created on 2024-08-21 11:12:54.868256
-- Message: increase sex text length
-- Alembic Revision ID: 0fa5767e5e64

ALTER TABLE patients ALTER COLUMN sex TYPE VARCHAR(24);
