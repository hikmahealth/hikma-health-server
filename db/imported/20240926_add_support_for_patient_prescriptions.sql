-- SQL file created on 2024-09-26 16:01:59.120977
-- Message: add support for patient prescriptions
-- Alembic Revision ID: db77872add9f

CREATE TABLE prescriptions (
    id UUID NOT NULL,
    patient_id UUID NOT NULL,
    provider_id UUID NOT NULL,
    filled_by UUID DEFAULT NULL,
    pickup_clinic_id UUID NOT NULL,
    visit_id UUID DEFAULT NULL,
    priority VARCHAR DEFAULT 'normal',
    expiration_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    prescribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    filled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    status VARCHAR NOT NULL DEFAULT 'pending',
    items JSON NOT NULL DEFAULT '[]',
    notes VARCHAR NOT NULL DEFAULT '',
    metadata JSON NOT NULL DEFAULT '{}',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    last_modified TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    server_created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create primary key
ALTER TABLE prescriptions ADD CONSTRAINT pk_prescriptions PRIMARY KEY (id);

-- Create foreign key constraints
ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_patient FOREIGN KEY (patient_id) REFERENCES patients (id);
ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_provider FOREIGN KEY (provider_id) REFERENCES users (id);
ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_pickup_clinic FOREIGN KEY (pickup_clinic_id) REFERENCES clinics (id);

-- Create indexes
CREATE INDEX ix_prescriptions_patient_id ON prescriptions (patient_id);
CREATE INDEX ix_prescriptions_pickup_clinic_id ON prescriptions (pickup_clinic_id);
