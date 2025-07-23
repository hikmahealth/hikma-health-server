-- SQL file created on 2024-07-11 23:08:19.705851
-- Message: restoring patient attribute indices and primary keys
-- Alembic Revision ID: 19c8d4aed7fa

-- Make patient_id non-nullable
ALTER TABLE patient_additional_attributes ALTER COLUMN patient_id SET NOT NULL;

-- Create the primary key constraint
ALTER TABLE patient_additional_attributes ADD CONSTRAINT patient_additional_attributes_pkey PRIMARY KEY (patient_id, attribute_id);

-- Create an index on patient_id
CREATE INDEX ix_patient_additional_attributes_patient_id ON patient_additional_attributes (patient_id);
