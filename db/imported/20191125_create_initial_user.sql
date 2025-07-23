-- SQL file created on 2019-11-25 18:33:30.688004
-- Message: Create initial user
-- Alembic Revision ID: 657ba64ed784

-- Insert initial clinic
INSERT INTO clinics (id, name)
VALUES (gen_random_uuid(), 'Hikma Clinic');

-- Insert initial admin user
INSERT INTO users (id, clinic_id, name, role, email, hashed_password, instance_url, created_at, updated_at, is_deleted)
VALUES (
    gen_random_uuid(),
    (SELECT id FROM clinics WHERE name = 'Hikma Clinic' LIMIT 1),
    'Hikma Admin',
    'super_admin',
    'admin@hikmahealth.org',
    '$2b$14$PPY9X2ZxFG93IU9CK4FUtOJW0d11zjHuODO6oJM5UNn59aXjp5h..',
    NULL,
    NOW(),
    NOW(),
    FALSE
);
