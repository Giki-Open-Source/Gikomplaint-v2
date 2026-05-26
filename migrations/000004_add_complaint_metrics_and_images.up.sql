-- Add metrics and media columns to complaints table
ALTER TABLE complaints ADD COLUMN reach INT NOT NULL DEFAULT 1;
ALTER TABLE complaints ADD COLUMN disruption INT NOT NULL DEFAULT 1;
ALTER TABLE complaints ADD COLUMN gpi INT NOT NULL DEFAULT 0;
ALTER TABLE complaints ADD COLUMN images TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
ALTER TABLE complaints ADD COLUMN assigned_to VARCHAR(255) DEFAULT NULL;
ALTER TABLE complaints ADD COLUMN resolution_notes TEXT DEFAULT NULL;

-- Create index for GPI priority sorting
CREATE INDEX idx_complaints_gpi ON complaints(gpi DESC);
