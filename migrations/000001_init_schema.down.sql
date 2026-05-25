-- Drop triggers
DROP TRIGGER IF EXISTS update_complaints_modtime ON complaints;
DROP TRIGGER IF EXISTS update_users_modtime ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_modified_column();

-- Drop tables (order matters to satisfy foreign keys)
DROP TABLE IF EXISTS complaint_comments;
DROP TABLE IF EXISTS complaint_upvotes;
DROP TABLE IF EXISTS complaint_assignments;
DROP TABLE IF EXISTS complaints;
DROP TABLE IF EXISTS users;

-- Drop custom enums / types
DROP TYPE IF EXISTS complaint_severity;
DROP TYPE IF EXISTS complaint_category;
DROP TYPE IF EXISTS complaint_status;
DROP TYPE IF EXISTS user_role;
