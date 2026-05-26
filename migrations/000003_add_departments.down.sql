-- Drop auto-routing trigger
DROP TRIGGER IF EXISTS trigger_auto_route_complaint ON complaints;

-- Drop auto-routing function
DROP FUNCTION IF EXISTS auto_route_complaint();

-- Drop department index columns
DROP INDEX IF EXISTS idx_complaints_department_id;
DROP INDEX IF EXISTS idx_department_staff_user;

-- Alter complaints table to drop column
ALTER TABLE complaints DROP COLUMN IF EXISTS department_id;

-- Drop department tables
DROP TABLE IF EXISTS department_staff;
DROP TABLE IF EXISTS departments;
