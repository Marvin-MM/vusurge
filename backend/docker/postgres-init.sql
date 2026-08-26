-- Initialization script for local development.
-- Creates a non-superuser role that owns the database, matching the permissions
-- of a managed PostgreSQL provider like Neon.

CREATE ROLE ip_app WITH LOGIN PASSWORD 'ip_app_local_dev' CREATEDB CREATEROLE;

CREATE DATABASE innovation_platform OWNER ip_app;
CREATE DATABASE innovation_platform_test OWNER ip_app;
