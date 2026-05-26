-- Remove metrics and media columns from complaints table
ALTER TABLE complaints DROP COLUMN IF EXISTS reach;
ALTER TABLE complaints DROP COLUMN IF EXISTS disruption;
ALTER TABLE complaints DROP COLUMN IF EXISTS gpi;
ALTER TABLE complaints DROP COLUMN IF EXISTS images;
ALTER TABLE complaints DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE complaints DROP COLUMN IF EXISTS resolution_notes;

-- Drop indices
DROP INDEX IF EXISTS idx_complaints_gpi;
