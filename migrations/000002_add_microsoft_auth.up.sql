ALTER TABLE users ADD COLUMN microsoft_id VARCHAR(255) UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Index for fast Microsoft ID lookups under load
CREATE INDEX idx_users_microsoft_id ON users(microsoft_id);
