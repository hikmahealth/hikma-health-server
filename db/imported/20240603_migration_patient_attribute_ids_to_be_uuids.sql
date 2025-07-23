-- SQL file created on 2024-06-03 20:39:09.023041
-- Message: migration patient attribute ids to be UUIDs
-- Alembic Revision ID: a93b05fad7db

-- Add a new UUID column
ALTER TABLE patient_additional_attributes ADD COLUMN patient_uuid_column UUID;

-- Convert existing string values to UUID
UPDATE patient_additional_attributes
SET patient_uuid_column = patient_id::UUID;

-- Drop the old string column
ALTER TABLE patient_additional_attributes DROP COLUMN patient_id;

-- Rename the new UUID column to the original column name
ALTER TABLE patient_additional_attributes RENAME COLUMN patient_uuid_column TO patient_id;
