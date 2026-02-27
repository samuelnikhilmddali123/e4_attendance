-- Migration script to update tasks table schema
-- Run this to migrate from old schema to new schema

USE work_monitoring_db;

-- Step 1: Backup existing data
DROP TABLE IF EXISTS tasks_backup;
CREATE TABLE tasks_backup AS SELECT * FROM tasks;

-- Step 2: Modify table structure
ALTER TABLE tasks 
  -- Rename date to assigned_date
  CHANGE COLUMN date assigned_date DATE NOT NULL,
  -- Add new date fields
  ADD COLUMN due_date DATE NOT NULL AFTER assigned_date,
  ADD COLUMN completed_date DATE DEFAULT NULL AFTER due_date,
  -- Update status enum
  MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed', 'overdue') DEFAULT 'pending',
  -- Add updated_at timestamp
  ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Step 3: Migrate existing data
-- Set due_date same as assigned_date for existing tasks
UPDATE tasks SET due_date = assigned_date WHERE due_date IS NULL;

-- Update status based on completion_percentage
UPDATE tasks SET status = 'completed' WHERE completion_percentage = 100;
UPDATE tasks SET status = 'in_progress' WHERE completion_percentage > 0 AND completion_percentage < 100;
UPDATE tasks SET status = 'pending' WHERE completion_percentage = 0;

-- Set completed_date for already completed tasks
UPDATE tasks SET completed_date = assigned_date WHERE status = 'completed';

-- Mark overdue tasks (tasks with due_date in the past that are not completed)
UPDATE tasks 
SET status = 'overdue' 
WHERE due_date < CURDATE() AND status != 'completed';

-- Step 4: Add indexes for performance
CREATE INDEX idx_emp_status ON tasks(emp_no, status);
CREATE INDEX idx_due_date ON tasks(due_date);

-- Verify migration
SELECT 'Migration completed successfully!' as message;
SELECT COUNT(*) as total_tasks FROM tasks;
SELECT status, COUNT(*) as count FROM tasks GROUP BY status;
