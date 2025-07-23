-- SQL file created on initial migration
-- Message: initial tables
-- Alembic Revision ID: 47dc360e825a

CREATE TABLE string_ids (
  id uuid PRIMARY KEY,
  last_modified timestamp with time zone default now(),
  server_created_at timestamp with time zone default now(),
  is_deleted boolean default false,
  deleted_at timestamp with time zone default null
);

CREATE TABLE string_content (
  id uuid REFERENCES string_ids(id) ON DELETE CASCADE,
  language varchar(5),
  content text,
  updated_at timestamp with time zone,
  last_modified timestamp with time zone default now(),
  server_created_at timestamp with time zone default now(),
  is_deleted boolean default false,
  deleted_at timestamp with time zone default null
);

CREATE UNIQUE INDEX ON string_content (id, language);

CREATE TABLE patients (
  id uuid PRIMARY KEY,
  given_name TEXT,
  surname TEXT,
  date_of_birth DATE,
  citizenship TEXT,
  hometown TEXT,
  phone TEXT,
  sex varchar(8),
  camp varchar(50),
  additional_data JSONB NOT NULL DEFAULT '{}',
  image_timestamp timestamp with time zone,
  metadata JSONB NOT NULL DEFAULT '{}',
  photo_url TEXT,
  is_deleted boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_modified timestamp with time zone default now(),
  server_created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

CREATE TABLE clinics (
  id uuid PRIMARY KEY,
  name TEXT,
  is_deleted boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_modified timestamp with time zone default now(),
  server_created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  name text not null,
  role text not null,
  email text not null,
  hashed_password text not null,
  instance_url text,
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  is_deleted boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_modified timestamp with time zone default now(),
  server_created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

CREATE UNIQUE INDEX ON users (email);

CREATE TABLE tokens (
  user_id uuid REFERENCES users (id),
  token text not null,
  expiry timestamptz not null default now() + INTERVAL '60 minutes'
);

CREATE INDEX ON tokens (token);

CREATE TABLE visits (
  id uuid PRIMARY KEY,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES users(id) ON DELETE CASCADE,
  provider_name TEXT,
  check_in_timestamp timestamp with time zone,
  is_deleted boolean default false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_modified timestamp with time zone default now(),
  server_created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

CREATE TABLE event_forms (
    id uuid PRIMARY KEY,
    name TEXT,
    description TEXT,
    language TEXT NOT NULL DEFAULT 'en',
    is_editable boolean default true,
    is_snapshot_form boolean default false,
    form_fields JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    is_deleted boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    last_modified timestamp with time zone default now(),
    server_created_at timestamp with time zone default now(),
    deleted_at timestamp with time zone default null
);

CREATE TABLE events (
    id uuid PRIMARY KEY,
    patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
    visit_id uuid REFERENCES visits(id) ON DELETE CASCADE DEFAULT NULL,
    form_id uuid REFERENCES event_forms(id) ON DELETE CASCADE DEFAULT NULL,
    event_type TEXT,
    form_data JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    is_deleted boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    last_modified timestamp with time zone default now(),
    server_created_at timestamp with time zone default now(),
    deleted_at timestamp with time zone default null
);

CREATE TABLE patient_registration_forms (
    id uuid PRIMARY KEY,
    clinic_id uuid REFERENCES clinics(id),
    name text NOT NULL DEFAULT '',
    fields JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    is_deleted boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    last_modified timestamp with time zone default now(),
    server_created_at timestamp with time zone default now(),
    deleted_at timestamp with time zone default null
);

CREATE FUNCTION get_string(uuid, text) RETURNS text
AS 'SELECT content FROM string_content WHERE id = $1 AND language = $2;'
LANGUAGE SQL IMMUTABLE RETURNS NULL ON NULL INPUT;
