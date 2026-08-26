-- Explicitly revoke destructive privileges on audit_event from the table owner.
-- In a single-role architecture where the application connects as the database
-- owner (e.g. ip_app), the owner implicitly has ALL PRIVILEGES on every table.
-- To satisfy the strict security requirement that audit logs are append-only
-- and immutable (even by the application itself), we must explicitly revoke
-- UPDATE, DELETE, and TRUNCATE from CURRENT_USER (which is the owner who runs
-- this migration).

REVOKE UPDATE, DELETE, TRUNCATE ON audit_event FROM CURRENT_USER;
