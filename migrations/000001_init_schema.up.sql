-- Create custom types / enums
CREATE TYPE user_role AS ENUM ('student', 'faculty', 'staff', 'admin');
CREATE TYPE complaint_status AS ENUM ('pending', 'assigned', 'in_progress', 'resolved', 'closed');
CREATE TYPE complaint_category AS ENUM ('hostel', 'mess', 'academic', 'it_services', 'electricity', 'plumbing', 'security', 'other');
CREATE TYPE complaint_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- 1. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Complaints Table
CREATE TABLE complaints (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category complaint_category NOT NULL DEFAULT 'other',
    status complaint_status NOT NULL DEFAULT 'pending',
    severity complaint_severity NOT NULL DEFAULT 'medium',
    upvotes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Complaint Assignments Table (to Maintenance Staff)
CREATE TABLE complaint_assignments (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    staff_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    remarks TEXT,
    CONSTRAINT unique_assignment UNIQUE (complaint_id, staff_id)
);

-- 4. Complaint Upvotes Table (high-concurrency public tracking)
CREATE TABLE complaint_upvotes (
    complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (complaint_id, user_id)
);

-- 5. Complaint Comments (discussion logs, updates from admin/staff)
CREATE TABLE complaint_comments (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for optimized querying under load
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_complaints_user_id ON complaints(user_id);
CREATE INDEX idx_complaints_status_category ON complaints(status, category);
CREATE INDEX idx_complaints_upvotes ON complaints(upvotes DESC);
CREATE INDEX idx_complaint_assignments_staff ON complaint_assignments(staff_id);
CREATE INDEX idx_complaint_comments_complaint ON complaint_comments(complaint_id);

-- Automatic triggers for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_complaints_modtime
    BEFORE UPDATE ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
