-- SQL file created on 2024-09-01 16:58:25.334801
-- Message: Adding support for Appointments
-- Alembic Revision ID: 80e8c595e01e

CREATE TABLE appointments (
    id UUID NOT NULL,
    provider_id UUID,
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    user_id UUID NOT NULL,
    current_visit_id UUID NOT NULL,
    fulfilled_visit_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    duration SMALLINT NOT NULL DEFAULT 60,
    reason VARCHAR NOT NULL DEFAULT '',
    notes VARCHAR NOT NULL DEFAULT '',
    status VARCHAR NOT NULL DEFAULT 'pending',
    metadata JSON NOT NULL DEFAULT '{}',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_modified TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    server_created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create index on timestamp
CREATE INDEX ix_timestamp ON appointments (timestamp);

-- Create primary key
ALTER TABLE appointments ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);

-- Create foreign key constraints
ALTER TABLE appointments ADD CONSTRAINT fk_appointment_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id);
ALTER TABLE appointments ADD CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id) REFERENCES patients (id);
ALTER TABLE appointments ADD CONSTRAINT fk_appointment_user FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE appointments ADD CONSTRAINT fk_appointment_provider FOREIGN KEY (provider_id) REFERENCES users (id);
ALTER TABLE appointments ADD CONSTRAINT fk_appointment_current_visit FOREIGN KEY (current_visit_id) REFERENCES visits (id);
ALTER TABLE appointments ADD CONSTRAINT fk_appointment_fulfilled_visit FOREIGN KEY (fulfilled_visit_id) REFERENCES visits (id);
