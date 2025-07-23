-- SQL file created on 2025-03-13 12:25:28.654822
-- Message: creating server variable table
-- Alembic Revision ID: 90b1fbe863b7

CREATE TABLE server_variables (
    id uuid PRIMARY KEY,
    key varchar(128) NOT NULL,
    description text,
    value_type varchar(42) NOT NULL,
    value_data bytea default NULL,
    value_hash varchar(512) default NULL,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

CREATE UNIQUE INDEX unique_server_key ON server_variables (key);

CREATE INDEX server_value_hash ON server_variables USING hash (value_type);
