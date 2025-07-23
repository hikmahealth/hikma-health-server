-- SQL file created on 2024-05-22 23:57:19.293873
-- Message: Add external ids to patients, and add adopt EAV model for patient attributes
-- Alembic Revision ID: 602ce80e2a7b

-- Add new columns to the patients table
ALTER TABLE patients ADD COLUMN government_id VARCHAR(100);
ALTER TABLE patients ADD COLUMN external_patient_id VARCHAR(100);

-- Create patient_additional_attributes table
CREATE TABLE patient_additional_attributes (
    id UUID NOT NULL,
    patient_id VARCHAR NOT NULL,
    attribute_id VARCHAR NOT NULL,
    attribute VARCHAR NOT NULL DEFAULT '',
    number_value FLOAT,
    string_value VARCHAR,
    date_value TIMESTAMP WITH TIME ZONE,
    boolean_value BOOLEAN,
    metadata JSON NOT NULL DEFAULT '{}',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_modified TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    server_created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT patient_additional_attributes_pkey PRIMARY KEY (patient_id, attribute_id)
);

-- Create indexes
CREATE INDEX ix_patient_additional_attributes_patient_id ON patient_additional_attributes (patient_id);
CREATE INDEX ix_patient_additional_attributes_attribute_id ON patient_additional_attributes (attribute_id);
