-- Create departments table
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create department staff junction table
CREATE TABLE department_staff (
    department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (department_id, user_id)
);

-- Alter complaints table to reference departments
ALTER TABLE complaints ADD COLUMN department_id INT REFERENCES departments(id) ON DELETE SET NULL;

-- Index for optimized department-based queries
CREATE INDEX idx_complaints_department_id ON complaints(department_id);
CREATE INDEX idx_department_staff_user ON department_staff(user_id);

-- Seed standard campus departments
INSERT INTO departments (name, description) VALUES
('IT Helpdesk & Networks', 'wifi outages, network speeds, active portal issues, and hardware repairs.'),
('Plumbing & Water Management', 'Hostel washroom leakages, water supply outages, and pipes replacement.'),
('Electricity & Power Maintenance', 'Flickering lights, fused corridor switches, backup generators, and socket failures.'),
('Mess & Dining Operations', 'Uncooked food issues, kitchen hygiene, dining hall operations, and meal timings.'),
('Hostel Facility Maintenance', 'Hostel wing issues, room fixtures, painting requests, and general dorm maintenance.'),
('Campus Safety & Security', 'Main gate checks, corridor patrols, residential area security, and lock updates.'),
('Other Infrastructure & Support', 'General campus support, academic building repairs, and miscellaneous items.');

-- Create triggers function for auto-routing complaints based on categories on insert
CREATE OR REPLACE FUNCTION auto_route_complaint()
RETURNS TRIGGER AS $$
DECLARE
    target_dept_id INT;
BEGIN
    -- Query the matching department based on incoming category state
    IF NEW.category = 'it_services' THEN
        SELECT id INTO target_dept_id FROM departments WHERE name = 'IT Helpdesk & Networks';
    ELSIF NEW.category = 'plumbing' THEN
        SELECT id INTO target_dept_id FROM departments WHERE name = 'Plumbing & Water Management';
    ELSIF NEW.category = 'electricity' THEN
        SELECT id INTO target_dept_id FROM departments WHERE name = 'Electricity & Power Maintenance';
    ELSIF NEW.category = 'mess' THEN
        SELECT id INTO target_dept_id FROM departments WHERE name = 'Mess & Dining Operations';
    ELSIF NEW.category = 'hostel' THEN
        SELECT id INTO target_dept_id FROM departments WHERE name = 'Hostel Facility Maintenance';
    ELSIF NEW.category = 'security' THEN
        SELECT id INTO target_dept_id FROM departments WHERE name = 'Campus Safety & Security';
    ELSE
        SELECT id INTO target_dept_id FROM departments WHERE name = 'Other Infrastructure & Support';
    END IF;

    -- Assign the resolved department reference
    NEW.department_id := target_dept_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply auto-routing trigger to complaints inserts
CREATE TRIGGER trigger_auto_route_complaint
    BEFORE INSERT ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION auto_route_complaint();
