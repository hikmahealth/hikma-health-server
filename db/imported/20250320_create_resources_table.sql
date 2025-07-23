-- SQL file created on 2025-03-20 14:35:57.492606
-- Message: create resources table
-- Alembic Revision ID: fbcd98789c00

CREATE TABLE resources (
    id uuid PRIMARY KEY,
    description TEXT,
    store varchar(42) NOT NULL,
    store_version varchar(42) NOT NULL,
    uri TEXT NOT NULL,
    hash varchar(512) default NULL,
    mimetype TEXT NOT NULL,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    last_modified timestamp with time zone default now(),
    server_created_at timestamp with time zone default now(),
    deleted_at timestamp with time zone default NULL
);

CREATE UNIQUE INDEX unique_resource_ix ON resources (store, uri);
CREATE INDEX store_type_ix ON resources (store);
