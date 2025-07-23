-- SQL file created on 2025-04-01 00:35:00.929848
-- Message: include healthcare provider segmentation
-- Alembic Revision ID: 18edc29dd7fd

ALTER TABLE clinics
ADD COLUMN attributes text[] NOT NULL default ARRAY[]::text[],
ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}',
ADD COLUMN address text default NULL;

CREATE INDEX attributes_hash_ix ON clinics USING hash (attributes);
